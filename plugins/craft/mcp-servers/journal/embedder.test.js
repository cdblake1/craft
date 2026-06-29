'use strict';

// embedder.test.js -- opt-in embedding backend resolution (P9). Run: node embedder.test.js
// Default is zero-service (null); a bad spec degrades to null, never throws.

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { resolveEmbedder } = require('./embedder');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); process.stdout.write(`PASS  ${name}\n`); passed++; }
    catch (e) { process.stdout.write(`FAIL  ${name}\n        ${e.message}\n`); failed++; }
}

test('no env -> null (zero-service default)', () => {
    assert.strictEqual(resolveEmbedder({}), null);
    assert.strictEqual(resolveEmbedder(), null);
});

test('a non-resolvable spec degrades to null, never throws', () => {
    assert.strictEqual(resolveEmbedder({ CRAFT_JOURNAL_EMBEDDER: './does-not-exist-xyz' }), null);
    assert.strictEqual(resolveEmbedder({ CRAFT_JOURNAL_EMBEDDER: 123 }), null);
});

test('a module exporting embed() resolves to that function', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'craft-embed-'));
    const mod = path.join(dir, 'fake-embedder.js');
    fs.writeFileSync(mod, 'module.exports = { embed: (t) => [t.length, 0, 0] };');
    const fn = resolveEmbedder({ CRAFT_JOURNAL_EMBEDDER: mod });
    assert.strictEqual(typeof fn, 'function');
    assert.deepStrictEqual(fn('abc'), [3, 0, 0]);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('a module that IS a function resolves directly', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'craft-embed-'));
    const mod = path.join(dir, 'fn-embedder.js');
    fs.writeFileSync(mod, 'module.exports = (t) => [1, 2, 3];');
    const fn = resolveEmbedder({ CRAFT_JOURNAL_EMBEDDER: mod });
    assert.strictEqual(typeof fn, 'function');
    assert.deepStrictEqual(fn('x'), [1, 2, 3]);
    fs.rmSync(dir, { recursive: true, force: true });
});

if (failed > 0) { process.stdout.write(`\n${failed} failed, ${passed} passed\n`); process.exit(1); }
process.stdout.write(`\nAll ${passed} embedder tests passed\n`);
