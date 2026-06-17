'use strict';

// sync.test.js -- the cross-machine sync ORCHESTRATION, driven by a fake git
// runner. No real git: the engine's git calls go through an injected runner
// (createSync({ git })), so these tests exercise the logic we own -- the lock,
// the .gitattributes/.gitignore writes, the push retry + rebase-abort decision,
// the pending-push marker -- without spawning git. Real git's own behavior
// (does merge=union actually merge) is git's job, not ours to test. Fast.
//
// Run: node sync.test.js

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createSync, UNION_RULE } = require('./sync');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); process.stdout.write(`PASS  ${name}\n`); passed++; }
    catch (e) { process.stdout.write(`FAIL  ${name}\n        ${e.message}\n`); failed++; }
}

const roots = [];
function freshRoot(withGitDir) {
    const r = fs.mkdtempSync(path.join(os.tmpdir(), 'craft-sync-'));
    if (withGitDir) { fs.mkdirSync(path.join(r, '.git')); } // fake repo presence for isRepo()
    roots.push(r);
    return r;
}

// A fake git runner: records every call and returns whatever `handler(args)`
// decides (default ok/empty). A non-ok result throws unless allowFail is set,
// matching the real runner's contract.
function fakeGit(handler) {
    const calls = [];
    const fn = (args, allowFail) => {
        const key = args.join(' ');
        calls.push(key);
        let r = handler ? handler(args, key) : undefined;
        if (r === undefined) { r = { ok: true, out: '' }; }
        if (!r.ok && !allowFail) { throw new Error('git failed: ' + key); }
        return r;
    };
    fn.calls = calls;
    return fn;
}

// Common handler for an enabled repo on branch main with staged changes.
function enabledHandler(extra) {
    return (args, key) => {
        if (args[0] === 'remote' && args[1] === 'get-url') { return { ok: true, out: 'git@host:me/data.git' }; }
        if (key === 'rev-parse --abbrev-ref HEAD') { return { ok: true, out: 'main' }; }
        if (args[0] === 'diff' && args.indexOf('--quiet') !== -1) { return { ok: false, out: '' }; } // staged
        return extra ? extra(args, key) : { ok: true, out: '' };
    };
}

// === enablement + branch ====================================================

test('isEnabled is true with a .git dir and a configured remote', () => {
    const root = freshRoot(true);
    const s = createSync({ root, git: fakeGit(enabledHandler()) });
    assert.strictEqual(s.isRepo(), true);
    assert.strictEqual(s.isEnabled(), true);
    assert.strictEqual(s.branch(), 'main');
});

test('isEnabled is false when no remote is configured', () => {
    const root = freshRoot(true);
    const git = fakeGit(a => (a[0] === 'remote' && a[1] === 'get-url') ? { ok: false, out: '' } : { ok: true, out: '' });
    assert.strictEqual(createSync({ root, git }).isEnabled(), false);
});

test('sync is a no-op until a remote is wired (local-only is the default)', () => {
    const root = freshRoot(true);
    const git = fakeGit(a => (a[0] === 'remote' && a[1] === 'get-url') ? { ok: false, out: '' } : { ok: true, out: '' });
    const s = createSync({ root, git });
    assert.strictEqual(s.pullStart().enabled, false);
    assert.strictEqual(s.pushEnd().enabled, false);
});

// === ensureRepo (real fs writes; git calls recorded) ========================

test('ensureRepo writes the union attribute and ignores the lock + pending marker', () => {
    const root = freshRoot(false); // no .git yet -> ensureRepo "inits"
    const git = fakeGit();
    createSync({ root, git }).ensureRepo('git@host:me/data.git');

    assert.ok(fs.readFileSync(path.join(root, '.gitattributes'), 'utf8').includes(UNION_RULE));
    const ig = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
    assert.ok(ig.includes('.craft-sync.lock/'), 'lock dir ignored');
    assert.ok(ig.includes('.pending-push'), 'pending marker ignored');
    assert.ok(git.calls.some(c => c.startsWith('init')), 'it initialized the repo');
    assert.ok(git.calls.some(c => c.indexOf('remote add origin') !== -1), 'it wired the remote');
});

test('ensureRepo is idempotent on the union attribute (no duplicate rule)', () => {
    const root = freshRoot(true);
    const s = createSync({ root, git: fakeGit() });
    s.ensureRepo();
    s.ensureRepo();
    const attrs = fs.readFileSync(path.join(root, '.gitattributes'), 'utf8');
    assert.strictEqual(attrs.split(UNION_RULE).length - 1, 1, 'union rule written exactly once');
});

// === pushEnd decision flow ==================================================

test('pushEnd stages, commits, and pushes when there are changes', () => {
    const root = freshRoot(true);
    const git = fakeGit(enabledHandler());
    const r = createSync({ root, git }).pushEnd('my message');
    assert.ok(r.ok && r.committed, JSON.stringify(r));
    assert.ok(git.calls.indexOf('add -A') !== -1);
    assert.ok(git.calls.some(c => c.startsWith('commit')));
    assert.ok(git.calls.some(c => c.startsWith('push origin')));
});

test('pushEnd retries with fetch + rebase when the first push is rejected', () => {
    const root = freshRoot(true);
    let pushes = 0;
    const git = fakeGit(enabledHandler((args) => {
        if (args[0] === 'push') { pushes++; return pushes === 1 ? { ok: false, out: 'rejected' } : { ok: true, out: '' }; }
        if (args[0] === 'rebase') { return { ok: true, out: '' }; } // union-resolved
        return { ok: true, out: '' };
    }));
    const r = createSync({ root, git }).pushEnd();
    assert.ok(r.ok, JSON.stringify(r));
    assert.strictEqual(pushes, 2, 'pushed again after the rebase');
    assert.ok(git.calls.indexOf('fetch origin') !== -1);
    assert.ok(git.calls.some(c => c.startsWith('rebase origin/')));
});

test('an unresolved rebase conflict aborts and defers via .pending-push', () => {
    const root = freshRoot(true);
    const git = fakeGit(enabledHandler((args) => {
        if (args[0] === 'push') { return { ok: false, out: 'rejected' }; }
        if (args[0] === 'rebase' && args[1] !== '--abort') { return { ok: false, out: 'CONFLICT (content)' }; }
        return { ok: true, out: '' };
    }));
    const s = createSync({ root, git });
    const r = s.pushEnd();
    assert.strictEqual(r.ok, false);
    assert.ok(r.pending && r.conflict, JSON.stringify(r));
    assert.ok(s.isPending(), '.pending-push written');
    assert.ok(git.calls.indexOf('rebase --abort') !== -1, 'never left mid-rebase');
});

test('a second failed push (after rebase) also defers via .pending-push', () => {
    const root = freshRoot(true);
    const git = fakeGit(enabledHandler((args) => {
        if (args[0] === 'push') { return { ok: false, out: 'rejected' }; }
        if (args[0] === 'rebase') { return { ok: true, out: '' }; }
        return { ok: true, out: '' };
    }));
    const s = createSync({ root, git });
    const r = s.pushEnd();
    assert.strictEqual(r.ok, false);
    assert.ok(r.pending, JSON.stringify(r));
    assert.ok(s.isPending());
});

test('a successful push clears a prior .pending-push marker', () => {
    const root = freshRoot(true);
    fs.writeFileSync(path.join(root, '.pending-push'), 'earlier\n');
    const s = createSync({ root, git: fakeGit(enabledHandler()) });
    assert.ok(s.isPending(), 'precondition: marker present');
    const r = s.pushEnd();
    assert.ok(r.ok, JSON.stringify(r));
    assert.strictEqual(s.isPending(), false, 'marker cleared on success');
});

test('pushEnd commits nothing (but still ok) when there are no changes', () => {
    const root = freshRoot(true);
    const git = fakeGit((args, key) => {
        if (args[0] === 'remote' && args[1] === 'get-url') { return { ok: true, out: 'url' }; }
        if (key === 'rev-parse --abbrev-ref HEAD') { return { ok: true, out: 'main' }; }
        if (args[0] === 'diff' && args.indexOf('--quiet') !== -1) { return { ok: true, out: '' }; } // NOT staged
        return { ok: true, out: '' };
    });
    const r = createSync({ root, git }).pushEnd();
    assert.ok(r.ok);
    assert.strictEqual(r.committed, false);
    assert.ok(!git.calls.some(c => c.startsWith('commit')), 'no empty commit');
});

// === pullStart ==============================================================

test('pullStart pulls --rebase when enabled', () => {
    const root = freshRoot(true);
    const git = fakeGit(enabledHandler());
    const r = createSync({ root, git }).pullStart();
    assert.ok(r.enabled && r.ok, JSON.stringify(r));
    assert.ok(git.calls.some(c => c.startsWith('pull --rebase origin')));
});

// === the singleton lock (real fs, no git) ===================================

test('the singleton lock is exclusive and releasable', () => {
    const root = freshRoot(false);
    const s = createSync({ root, git: fakeGit() });
    assert.strictEqual(s.acquireLock(), true);
    assert.strictEqual(s.acquireLock(), false, 'second acquire fails while held');
    s.releaseLock();
    assert.strictEqual(s.acquireLock(), true, 're-acquire after release');
    s.releaseLock();
});

test('a stale lock from a dead PID is reclaimed', () => {
    const root = freshRoot(false);
    fs.mkdirSync(path.join(root, '.craft-sync.lock'), { recursive: true });
    fs.writeFileSync(path.join(root, '.craft-sync.lock', 'pid'), '2147483646'); // not a live PID
    assert.strictEqual(createSync({ root, git: fakeGit() }).acquireLock(), true, 'reclaimed a dead-PID lock');
});

test('withLock serializes and reports a held lock', () => {
    const root = freshRoot(false);
    const s = createSync({ root, git: fakeGit() });
    let ran = false;
    const r = s.withLock(() => { ran = true; return { ok: true }; });
    assert.ok(ran && r.ok);
    // lock released after withLock
    assert.strictEqual(s.acquireLock(), true);
    s.releaseLock();
});

for (const d of roots) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* best effort */ } }

process.stdout.write(`\nTotal: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
