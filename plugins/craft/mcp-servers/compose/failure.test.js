'use strict';

// failure.test.js -- the failure-capture pipeline (fingerprint, sanitize,
// record -> capture into compose items). Run: node failure.test.js

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createFileStore } = require('../../lib/storage');
const { createCompose } = require('./compose');
const { createFailureCapture, fingerprint, sanitize } = require('./failure');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); process.stdout.write(`PASS  ${name}\n`); passed++; }
    catch (e) { process.stdout.write(`FAIL  ${name}\n        ${e.message}\n`); failed++; }
}

function fresh() {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'craft-fail-'));
    const store = createFileStore({ root: tmp });
    return { store, compose: createCompose(store), fc: createFailureCapture({ store, compose: createCompose(store) }) };
}

// === fingerprint ============================================================

test('fingerprint collapses incidental paths/numbers so reruns merge', () => {
    const a = fingerprint({ tool: 'view', error: "ENOENT: no such file 'C:/Users/bob/x/12.txt'", exitCode: 1 });
    const b = fingerprint({ tool: 'view', error: "ENOENT: no such file 'C:/Users/sue/y/98.txt'", exitCode: 1 });
    assert.strictEqual(a, b, `${a} != ${b}`);
});

test('fingerprint distinguishes different tools and error shapes', () => {
    const a = fingerprint({ tool: 'view', error: 'ENOENT', exitCode: 1 });
    const b = fingerprint({ tool: 'bash', error: 'ENOENT', exitCode: 1 });
    const c = fingerprint({ tool: 'view', error: 'EACCES permission denied', exitCode: 1 });
    assert.notStrictEqual(a, b);
    assert.notStrictEqual(a, c);
});

// === sanitize ===============================================================

test('sanitize redacts user paths, emails, and links', () => {
    const s = sanitize('failed at C:/Users/bob/repos/x, ping alice@example.com or aka.ms/foo');
    assert.ok(!/bob/.test(s), s);
    assert.ok(!/alice@example\.com/.test(s), s);
    assert.ok(!/aka\.ms\/foo/.test(s), s);
});

// === record -> capture ======================================================

test('two similar failures dedup to one captured item with a count', () => {
    const { fc, compose } = fresh();
    fc.recordFailure({ sessionId: 's1', tool: 'view', error: "ENOENT 'C:/Users/a/1.txt'", exitCode: 1 });
    fc.recordFailure({ sessionId: 's1', tool: 'view', error: "ENOENT 'C:/Users/b/2.txt'", exitCode: 1 });
    const res = fc.captureSession({ sessionId: 's1' });
    assert.strictEqual(res.failures, 2);
    assert.strictEqual(res.captured, 1);
    assert.strictEqual(res.items[0].count, 2);
    const items = compose.listItems();
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].category, 'failure');
});

test('distinct failures produce distinct items', () => {
    const { fc, compose } = fresh();
    fc.recordFailure({ sessionId: 's1', tool: 'view', error: 'ENOENT', exitCode: 1 });
    fc.recordFailure({ sessionId: 's1', tool: 'bash', error: 'segfault', exitCode: 139 });
    const res = fc.captureSession({ sessionId: 's1' });
    assert.strictEqual(res.captured, 2);
    assert.strictEqual(compose.listItems().length, 2);
});

test('a captured failure item carries no PII even from a dirty error', () => {
    const { fc, compose } = fresh();
    fc.recordFailure({ sessionId: 's1', tool: 'view', error: "denied for alice@corp.com at C:/Users/alice/secret", exitCode: 13 });
    fc.captureSession({ sessionId: 's1' });
    const it = compose.listItems()[0];
    const blob = it.title + ' ' + (it.notes || '');
    assert.ok(!/alice@corp\.com/.test(blob), blob);
    assert.ok(!/Users\/alice/i.test(blob), blob);
});

test('captureSession clears pending so a second run captures nothing', () => {
    const { fc } = fresh();
    fc.recordFailure({ sessionId: 's1', tool: 'view', error: 'ENOENT', exitCode: 1 });
    assert.strictEqual(fc.captureSession({ sessionId: 's1' }).captured, 1);
    assert.strictEqual(fc.captureSession({ sessionId: 's1' }).captured, 0);
});

test('no pending failures is a clean zero', () => {
    const { fc } = fresh();
    const res = fc.captureSession({ sessionId: 'never-failed' });
    assert.deepStrictEqual(res, { failures: 0, captured: 0, items: [] });
});

process.stdout.write(`\nTotal: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
