'use strict';

// storage.js -- craft's storage adapter (document operations).
//
// The adapter is the single data layer beneath both MCPs (journal + compose)
// and every hook: callers address data by a logical, '/'-separated key and
// never touch the filesystem directly. This file is the git-backed file
// adapter; a future multi-user adapter (e.g. GitHub Issues/Projects for the
// node shape) implements the same surface (design decision D2).
//
// Slice 1 is document operations only. Cross-machine sync (git pull/push,
// merge=union, the singleton lock) is a later slice that wraps this adapter.
//
// Root resolution:
//   1. opts.root (tests pass a temp dir)
//   2. $CRAFT_DATA_ROOT
//   3. <per-host home>/craft-data  (~/.claude or ~/.copilot; see lib/host.js)

const fs = require('fs');
const path = require('path');
const { hostHome } = require('./host');

function defaultDataRoot() {
    if (process.env.CRAFT_DATA_ROOT) { return process.env.CRAFT_DATA_ROOT; }
    return path.join(hostHome(), 'craft-data');
}

// Map a logical key ('a/b/c.md') to a native path under the root. Leading
// slashes are stripped so a key can never escape the root.
function _toNative(root, key) {
    const rel = String(key).replace(/^[/\\]+/, '').replace(/\//g, path.sep);
    return path.join(root, rel);
}

function createFileStore(opts) {
    opts = opts || {};
    const root = opts.root || defaultDataRoot();

    function read(key) {
        try { return fs.readFileSync(_toNative(root, key), 'utf8'); }
        catch (_) { return null; }
    }

    // Atomic write: temp file in the target dir, then rename over the target.
    function write(key, content) {
        const target = _toNative(root, key);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        const tmp = target + '.tmp.' + process.pid + '.' + Date.now();
        fs.writeFileSync(tmp, content, 'utf8');
        fs.renameSync(tmp, target);
    }

    function append(key, text) {
        const target = _toNative(root, key);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.appendFileSync(target, text, 'utf8');
    }

    function exists(key) {
        try { fs.accessSync(_toNative(root, key)); return true; }
        catch (_) { return false; }
    }

    function remove(key) {
        try { fs.rmSync(_toNative(root, key), { force: true }); } catch (_) { /* idempotent */ }
    }

    // Logical keys of every file under a prefix, recursively. Forward-slashed,
    // relative to the root. Temp files (mid-write) are excluded.
    function list(prefix) {
        const base = _toNative(root, prefix || '');
        const out = [];
        function walk(dir) {
            let entries;
            try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
            catch (_) { return; }
            for (const e of entries) {
                const full = path.join(dir, e.name);
                if (e.isDirectory()) { walk(full); }
                else if (e.isFile() && !/\.tmp\.\d+\.\d+$/.test(e.name)) {
                    out.push(path.relative(root, full).replace(/\\/g, '/'));
                }
            }
        }
        walk(base);
        return out;
    }

    // Run fn while holding a named advisory lock, so a read-modify-write of a
    // mutable document (a plan/roadmap frontmatter doc) cannot lose an update to
    // a concurrent writer in ANOTHER process (two sessions, or journal + compose
    // sharing this root). The lock is a directory created with mkdir, which is
    // atomic across processes on the shared filesystem -- the same primitive the
    // sync layer uses for its singleton lock.
    //
    // It is:
    //   - re-entrant within this process (a held lock just runs fn), so nested
    //     locked operations never self-deadlock;
    //   - stale-safe: a lock whose recorded PID is no longer alive is stolen;
    //   - best-effort: if it cannot acquire within LOCK_TIMEOUT_MS it runs fn
    //     anyway rather than fail the operation (never freeze a session). Under
    //     that pathological contention the original last-writer-wins is restored,
    //     which is no worse than before the lock existed.
    function withLock(name, fn) {
        const lockPath = _toNative(root, '.locks/' + String(name));
        if (_heldLocks.has(lockPath)) { return fn(); }   // re-entrant
        const acquired = _acquireLock(lockPath);
        if (acquired) { _heldLocks.add(lockPath); }
        try {
            return fn();
        } finally {
            if (acquired) {
                _heldLocks.delete(lockPath);
                try { fs.rmSync(lockPath, { recursive: true, force: true }); } catch (_) { /* idempotent */ }
            }
        }
    }

    return { read, write, append, exists, remove, list, withLock, root };
}

// Locks held by THIS process, keyed by absolute lock path, for re-entrancy.
const _heldLocks = new Set();
const LOCK_TIMEOUT_MS = 4000;
const LOCK_RETRY_MS = 25;

// Block the current thread for ms without a busy-spin (Atomics.wait on a private
// buffer is a real sleep; the lock is held only briefly so waits are short).
function _sleepMs(ms) {
    try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }
    catch (_) { /* SharedArrayBuffer unavailable: fall through, retry sooner */ }
}

// True if the PID recorded in the lock dir is no longer a live process, so the
// lock is abandoned and safe to steal. A missing/unreadable pid file is treated
// as fresh (a writer mid-acquire), not stale.
function _lockIsStale(lockPath) {
    let pid;
    try { pid = parseInt(fs.readFileSync(path.join(lockPath, 'pid'), 'utf8').trim(), 10); }
    catch (_) { return false; }
    if (!Number.isInteger(pid) || pid <= 0) { return false; }
    try { process.kill(pid, 0); return false; }   // signal 0: liveness probe, no-op if alive
    catch (e) { return e.code === 'ESRCH'; }       // ESRCH => no such process => stale
}

// Acquire the directory lock, stealing a stale one, retrying a live one until the
// timeout. Returns true if acquired, false if it gave up (caller proceeds anyway).
function _acquireLock(lockPath) {
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    const deadline = Date.now() + LOCK_TIMEOUT_MS;
    for (;;) {
        try {
            fs.mkdirSync(lockPath);                 // atomic: succeeds for exactly one writer
            try { fs.writeFileSync(path.join(lockPath, 'pid'), String(process.pid)); } catch (_) { /* best effort */ }
            return true;
        } catch (e) {
            if (e.code !== 'EEXIST') { throw e; }
            if (_lockIsStale(lockPath)) {
                try { fs.rmSync(lockPath, { recursive: true, force: true }); } catch (_) { /* race: another stealer */ }
                continue;
            }
            if (Date.now() >= deadline) { return false; }   // give up; proceed best-effort
            _sleepMs(LOCK_RETRY_MS);
        }
    }
}

module.exports = { createFileStore, defaultDataRoot };
