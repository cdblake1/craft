'use strict';

// frontmatter.test.js -- the flat YAML-frontmatter parse/serialize.
// Run: node frontmatter.test.js

const assert = require('assert');
const fm = require('./frontmatter');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); process.stdout.write(`PASS  ${name}\n`); passed++; }
    catch (e) { process.stdout.write(`FAIL  ${name}\n        ${e.message}\n`); failed++; }
}

test('parses a fenced frontmatter block and the body', () => {
    const { data, body } = fm.parse('---\nid: 01J\ntype: plan\nstatus: in-flight\n---\nHello body\n');
    assert.strictEqual(data.id, '01J');
    assert.strictEqual(data.type, 'plan');
    assert.strictEqual(data.status, 'in-flight');
    assert.strictEqual(body, 'Hello body\n');
});

test('coerces integers, booleans, and null', () => {
    const { data } = fm.parse('---\ncompletion_pct: 40\ndone: true\nparent_id: null\nempty:\n---\nx');
    assert.strictEqual(data.completion_pct, 40);
    assert.strictEqual(data.done, true);
    assert.strictEqual(data.parent_id, null);
    assert.strictEqual(data.empty, null);
});

test('a document with no frontmatter is all body', () => {
    const { data, body } = fm.parse('just prose\nmore\n');
    assert.deepStrictEqual(data, {});
    assert.strictEqual(body, 'just prose\nmore\n');
});

test('round-trips data and body, preserving key order', () => {
    const data = { id: '01J', type: 'plan', title: 'Build it', parent_id: null, status: 'open', completion_pct: 0 };
    const text = fm.stringify(data, 'The prose.\n');
    const back = fm.parse(text);
    assert.deepStrictEqual(back.data, data);
    assert.strictEqual(back.body, 'The prose.\n');
    // key order preserved on the wire
    assert.ok(text.indexOf('id:') < text.indexOf('type:'));
    assert.ok(text.indexOf('status:') < text.indexOf('completion_pct:'));
});

test('quotes a title that contains a colon so it round-trips', () => {
    const text = fm.stringify({ title: 'Fix: the thing' }, '');
    const back = fm.parse(text);
    assert.strictEqual(back.data.title, 'Fix: the thing');
});

test('skips malformed frontmatter lines without throwing', () => {
    const { data } = fm.parse('---\ngoodkey: v\nno-colon-here\n: emptykey\n---\nb');
    assert.strictEqual(data.goodkey, 'v');
    assert.strictEqual(Object.keys(data).length, 1);
});

process.stdout.write(`\nTotal: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
