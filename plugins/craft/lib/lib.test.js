'use strict';

// lib.test.js -- craft shared-lib unit tests. Run: node lib.test.js
// Zero npm deps: pure assert + temp-dir scratch space.
//
// Slice 1 proves the riskiest design assumption: a single storage adapter
// (document operations) backs the journal's real document access patterns.
// A minimal findings-store consumer drives the adapter end-to-end.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createFileStore } = require('./storage');
const findings = require('./findings-store');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); process.stdout.write(`PASS  ${name}\n`); passed++; }
    catch (e) { process.stdout.write(`FAIL  ${name}\n        ${e.message}\n`); failed++; }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'craft-lib-'));
const store = createFileStore({ root: tmp });

// === storage adapter: document operations ===================================

test('write then read round-trips a document', () => {
    store.write('a/b/c.md', '# hi\nbody');
    assert.strictEqual(store.read('a/b/c.md'), '# hi\nbody');
});

test('read of a missing key returns null', () => {
    assert.strictEqual(store.read('nope/missing.md'), null);
});

test('append adds to an existing document', () => {
    store.write('log.md', 'line1\n');
    store.append('log.md', 'line2\n');
    assert.strictEqual(store.read('log.md'), 'line1\nline2\n');
});

test('append creates the document when absent', () => {
    store.append('fresh.md', 'first\n');
    assert.strictEqual(store.read('fresh.md'), 'first\n');
});

test('list returns logical keys under a prefix, recursively', () => {
    store.write('j/x/findings/01.md', 'a');
    store.write('j/x/findings/02.md', 'b');
    store.write('j/y/findings/01.md', 'c');
    const keys = store.list('j/x/findings').sort();
    assert.deepStrictEqual(keys, ['j/x/findings/01.md', 'j/x/findings/02.md']);
});

test('list of a missing prefix returns empty', () => {
    assert.deepStrictEqual(store.list('does/not/exist'), []);
});

test('exists and remove', () => {
    store.write('tmp.md', 'x');
    assert.ok(store.exists('tmp.md'));
    store.remove('tmp.md');
    assert.ok(!store.exists('tmp.md'));
});

test('write is atomic (no leftover temp files)', () => {
    store.write('atomic/one.md', 'data');
    const leftovers = store.list('atomic').filter(k => k.includes('.tmp.'));
    assert.deepStrictEqual(leftovers, []);
});

// === findings store (the consumer) over the adapter =========================

const BRANCH = 'journals/repo/dev/test/A';

test('createFinding assigns numbered prefix + slug and writes through the adapter', () => {
    const key = findings.createFinding(store, BRANCH, 'Atomic Primitive', '# Atomic Primitive\n\nbody text');
    assert.ok(/\/findings\/01-atomic-primitive\.md$/.test(key), key);
    assert.ok(store.exists(key));
});

test('second finding increments the prefix', () => {
    const key = findings.createFinding(store, BRANCH, 'Second One', '# Second One\n\nmore');
    assert.ok(/\/findings\/02-second-one\.md$/.test(key), key);
});

test('listFindings returns the created findings in order', () => {
    const list = findings.listFindings(store, BRANCH);
    assert.strictEqual(list.length, 2);
    assert.ok(list[0].key.includes('01-'));
    assert.ok(list[1].key.includes('02-'));
});

test('getFinding reads back title (from H1) + body', () => {
    const list = findings.listFindings(store, BRANCH);
    const f = findings.getFinding(store, list[0].key);
    assert.ok(f.title.toLowerCase().includes('atomic'));
    assert.ok(f.body.includes('body text'));
});

test('getFinding of a missing key returns null', () => {
    assert.strictEqual(findings.getFinding(store, 'journals/repo/dev/test/A/findings/99-nope.md'), null);
});

test('createFinding rejects a body with no H1 heading', () => {
    assert.throws(() => findings.createFinding(store, BRANCH, 'No H1', 'no heading here'), /H1/);
});

fs.rmSync(tmp, { recursive: true, force: true });
process.stdout.write(`\nTotal: ${passed + failed}, passed: ${passed}, failed: ${failed}\n`);
process.exit(failed === 0 ? 0 : 1);
