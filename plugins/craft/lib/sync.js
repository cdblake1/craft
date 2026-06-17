'use strict';

// sync.js -- cross-machine sync for the craft data root (design 0001, D2 sync).
//
// The data root is a git repo. Sync happens at session boundaries: pull at
// start, commit + push at end. This is the proven fit for a single-user,
// low-concurrency, append-heavy, small store (gstack / mulch / Obsidian Git all
// do exactly this). It is NOT a CRDT and NOT continuous; it does not need to be.
//
// The hard parts this module owns:
//   - union merge for append-only JSONL (.gitattributes `*.jsonl merge=union`):
//     ULID-keyed replay makes line order irrelevant, so unioning both sides'
//     appended lines is loss-free. Concurrent appends from two machines merge
//     without a hand-resolved conflict.
//   - a singleton lock (mkdir-atomic, PID-checked stale cleanup) so two
//     processes on one host (e.g. fleet workers) never run git concurrently.
//   - one push retry (fetch + rebase + push); on failure a `.pending-push`
//     marker is left and reconciled on the next pull.
//   - stale .git/index.lock cleanup (left by a crashed prior git op).
//
// Sync is OPT-IN: it is a no-op unless the data root is a git repo with an
// `origin` remote (or ensureRepo was called with a remote). Local-only is the
// default, so nothing here runs until the user wires a private data repo.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const LOCK_DIR = '.craft-sync.lock';
const PENDING = '.pending-push';
const GITATTRS = '.gitattributes';
const UNION_RULE = '*.jsonl merge=union';
const DEFAULT_BRANCH = 'main';
const STALE_INDEX_LOCK_MS = 10000;

function createSync(opts) {
    opts = opts || {};
    const root = opts.root;
    if (!root) { throw new Error('createSync requires a root'); }
    const timeout = opts.timeoutMs || 15000;

    // Run git in the data root. allowFail=true returns {ok,out} instead of
    // throwing, so callers can treat git failures as recoverable signals.
    // The runner is injectable (opts.git) so tests can drive the orchestration
    // logic with a fake git, keeping the suite free of real git subprocesses.
    function _realGit(args, allowFail) {
        try {
            const out = execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], timeout: timeout, encoding: 'utf8' });
            return { ok: true, out: String(out).trim() };
        } catch (e) {
            if (allowFail) { return { ok: false, out: String((e.stderr || e.stdout || e.message || '')).trim() }; }
            throw e;
        }
    }
    const _git = opts.git || _realGit;

    function isRepo() { return fs.existsSync(path.join(root, '.git')); }
    function hasRemote() { return isRepo() && _git(['remote', 'get-url', 'origin'], true).ok; }
    function isEnabled() { return hasRemote(); }
    function branch() {
        const r = _git(['rev-parse', '--abbrev-ref', 'HEAD'], true);
        return (r.ok && r.out && r.out !== 'HEAD') ? r.out : DEFAULT_BRANCH;
    }

    // Make root a git repo with the union-merge attribute, optionally wiring a
    // remote. Idempotent: safe to call every session start.
    function ensureRepo(remoteUrl) {
        if (!fs.existsSync(root)) { fs.mkdirSync(root, { recursive: true }); }
        if (!isRepo()) {
            _git(['init', '-q']);
            // Force a deterministic default branch so two hosts agree.
            _git(['symbolic-ref', 'HEAD', 'refs/heads/' + DEFAULT_BRANCH], true);
        }
        const attrsPath = path.join(root, GITATTRS);
        const attrs = fs.existsSync(attrsPath) ? fs.readFileSync(attrsPath, 'utf8') : '';
        if (attrs.indexOf(UNION_RULE) === -1) {
            const sep = (attrs && !attrs.endsWith('\n')) ? '\n' : '';
            fs.writeFileSync(attrsPath, attrs + sep + UNION_RULE + '\n');
        }
        // The lock dir and the pending marker are local-only control files; they
        // must never be staged (a committed lock would propagate to other clones
        // and wedge them). Ignore them idempotently.
        const ignorePath = path.join(root, '.gitignore');
        const ignore = fs.existsSync(ignorePath) ? fs.readFileSync(ignorePath, 'utf8') : '';
        for (const rule of [LOCK_DIR + '/', PENDING]) {
            if (ignore.split(/\r?\n/).indexOf(rule) === -1) {
                const cur = fs.existsSync(ignorePath) ? fs.readFileSync(ignorePath, 'utf8') : '';
                const sep = (cur && !cur.endsWith('\n')) ? '\n' : '';
                fs.appendFileSync(ignorePath, sep + rule + '\n');
            }
        }
        if (remoteUrl && !hasRemote()) { _git(['remote', 'add', 'origin', remoteUrl], true); }
        return { enabled: isEnabled() };
    }

    // === singleton lock (mkdir-atomic + PID-checked stale cleanup) ===
    function _lockPath() { return path.join(root, LOCK_DIR); }
    function _pidAlive(pid) { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } }

    function acquireLock() {
        const lp = _lockPath();
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                fs.mkdirSync(lp);
                fs.writeFileSync(path.join(lp, 'pid'), String(process.pid));
                return true;
            } catch (e) {
                if (e.code !== 'EEXIST') { throw e; }
                const pidFile = path.join(lp, 'pid');
                const pid = parseInt((fs.existsSync(pidFile) ? fs.readFileSync(pidFile, 'utf8') : '').trim(), 10);
                if (!pid || !_pidAlive(pid)) {
                    try { fs.rmSync(lp, { recursive: true, force: true }); } catch (_) { /* retry loop */ }
                    continue;
                }
                return false; // held by a live process
            }
        }
        return false;
    }
    function releaseLock() { try { fs.rmSync(_lockPath(), { recursive: true, force: true }); } catch (_) { /* best effort */ } }
    function withLock(fn) {
        if (!acquireLock()) { return { ok: false, reason: 'locked' }; }
        try { return fn(); } finally { releaseLock(); }
    }

    // === sync operations ===
    function _pendingPath() { return path.join(root, PENDING); }
    function isPending() { return fs.existsSync(_pendingPath()); }

    function _cleanStaleIndexLock() {
        const il = path.join(root, '.git', 'index.lock');
        try {
            const st = fs.statSync(il);
            if (Date.now() - st.mtimeMs > STALE_INDEX_LOCK_MS) { fs.rmSync(il, { force: true }); }
        } catch (_) { /* no lock present */ }
    }

    function _hasUncommitted() { return _git(['status', '--porcelain'], true).out.length > 0; }

    function pullStart() {
        if (!isEnabled()) { return { enabled: false }; }
        return withLock(() => {
            _cleanStaleIndexLock();
            const r = _git(['pull', '--rebase', 'origin', branch()], true);
            return { enabled: true, ok: r.ok, message: r.out, pending: isPending() };
        });
    }

    function pushEnd(message) {
        if (!isEnabled()) { return { enabled: false }; }
        return withLock(() => {
            _cleanStaleIndexLock();
            _git(['add', '-A'], true);
            const staged = !_git(['diff', '--cached', '--quiet'], true).ok;
            if (staged) { _git(['commit', '-q', '-m', message || ('craft sync ' + new Date().toISOString())], true); }

            const br = branch();
            let push = _git(['push', 'origin', br], true);
            if (!push.ok) {
                // remote advanced: fetch + rebase (union-merging JSONL) + push once.
                _git(['fetch', 'origin'], true);
                const rb = _git(['rebase', 'origin/' + br], true);
                if (!rb.ok) {
                    // a conflict union could not resolve (e.g. md frontmatter on
                    // both sides). Never leave the repo mid-rebase: abort and defer.
                    _git(['rebase', '--abort'], true);
                    try { fs.writeFileSync(_pendingPath(), new Date().toISOString() + '\n'); } catch (_) { /* best effort */ }
                    return { enabled: true, ok: false, pending: true, conflict: true, message: rb.out };
                }
                push = _git(['push', 'origin', br], true);
            }
            if (!push.ok) {
                try { fs.writeFileSync(_pendingPath(), new Date().toISOString() + '\n'); } catch (_) { /* best effort */ }
                return { enabled: true, ok: false, pending: true, message: push.out };
            }
            if (isPending()) { try { fs.rmSync(_pendingPath(), { force: true }); } catch (_) { /* best effort */ } }
            return { enabled: true, ok: true, committed: staged };
        });
    }

    function status() { return { enabled: isEnabled(), repo: isRepo(), remote: hasRemote(), pending: isPending(), branch: isRepo() ? branch() : null }; }

    return {
        isRepo, hasRemote, isEnabled, branch, ensureRepo,
        acquireLock, releaseLock, withLock,
        pullStart, pushEnd, isPending, status,
    };
}

module.exports = { createSync, UNION_RULE };
