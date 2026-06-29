'use strict';

// findingMeta.test.js -- the finding metadata header. Run: node findingMeta.test.js
//
// The load-bearing case is backward-compatibility: a finding with NO header (every
// finding written before P2) must parse to active/branch/0/[], never error. Then
// round-trip, bounded parsing, and idempotent header insertion. Zero-dep.

const assert = require('assert');
const { defaultMeta, parseFindingMeta, serializeFindingMeta, withFindingMeta } = require('./findingMeta');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); process.stdout.write(`PASS  ${name}\n`); passed++; }
    catch (e) { process.stdout.write(`FAIL  ${name}\n        ${e.message}\n`); failed++; }
}

// --- Backward-compatibility: absent metadata => defaults ---

test('a header-less finding parses to active/branch/0/[]', () => {
    const body = '# Finding: atomic exclusion\n\n## When to read this\n\nBuilding a claim layer.';
    const m = parseFindingMeta(body);
    assert.strictEqual(m.status, 'active');
    assert.strictEqual(m.scope, 'branch');
    assert.strictEqual(m.consults, 0);
    assert.deepStrictEqual(m.relates_to, []);
    assert.strictEqual(m.superseded_by, null);
});

test('empty/null body returns defaults, never throws', () => {
    assert.deepStrictEqual(parseFindingMeta(''), defaultMeta());
    assert.deepStrictEqual(parseFindingMeta(null), defaultMeta());
});

test('a body with no H1 returns defaults', () => {
    assert.deepStrictEqual(parseFindingMeta('no heading here\n**Status:** retired'), defaultMeta());
});

// --- Parsing real headers ---

test('parses all recognized fields', () => {
    const body = [
        '# Title',
        '',
        '**Status:** superseded',
        '**Scope:** repo',
        '**Supersedes:** journals/r/b/findings/01-x.md',
        '**Superseded-by:** journals/r/b/findings/09-y.md',
        '**Last-consulted:** 2026-06-25',
        '**Consults:** 3',
        '**Relates-to:** journals/r/b/findings/02-a.md, journals/r/b/plan.md',
        '',
        '## When to read this',
        'hint',
    ].join('\n');
    const m = parseFindingMeta(body);
    assert.strictEqual(m.status, 'superseded');
    assert.strictEqual(m.scope, 'repo');
    assert.strictEqual(m.supersedes, 'journals/r/b/findings/01-x.md');
    assert.strictEqual(m.superseded_by, 'journals/r/b/findings/09-y.md');
    assert.strictEqual(m.last_consulted_at, '2026-06-25');
    assert.strictEqual(m.consults, 3);
    assert.deepStrictEqual(m.relates_to, ['journals/r/b/findings/02-a.md', 'journals/r/b/plan.md']);
});

test('unrecognized status/scope values fall back to defaults', () => {
    const m = parseFindingMeta('# T\n\n**Status:** draft -- edit me\n**Scope:** galaxy\n');
    assert.strictEqual(m.status, 'active');
    assert.strictEqual(m.scope, 'branch');
});

test('parsing is bounded: a **Status:** deep in the body is not metadata', () => {
    const body = '# T\n\nIntro paragraph.\n\n## Body\n\n**Status:** this is prose, not a header.\n';
    assert.strictEqual(parseFindingMeta(body).status, 'active');
});

// --- Serialize + round-trip ---

test('serialize emits Status + Scope always, optionals only when set', () => {
    assert.strictEqual(serializeFindingMeta({}), '**Status:** active\n**Scope:** branch');
    const s = serializeFindingMeta({ scope: 'user', consults: 2 });
    assert.ok(s.includes('**Scope:** user'));
    assert.ok(s.includes('**Consults:** 2'));
    assert.ok(!s.includes('Supersedes'));
});

test('round-trip: parse(serialize(withMeta(body))) recovers the metadata', () => {
    const body = '# Title\n\n## When to read this\n\nhint';
    const withMeta = withFindingMeta(body, { scope: 'repo', consults: 5, status: 'stale' });
    const m = parseFindingMeta(withMeta);
    assert.strictEqual(m.scope, 'repo');
    assert.strictEqual(m.consults, 5);
    assert.strictEqual(m.status, 'stale');
    assert.ok(/^# Title/.test(withMeta));            // H1 stays first
    assert.ok(withMeta.includes('## When to read this')); // section preserved
});

test('withFindingMeta is idempotent: re-applying does not stack headers', () => {
    const body = '# Title\n\nbody';
    const once = withFindingMeta(body, { scope: 'repo' });
    const twice = withFindingMeta(once, { scope: 'user' });
    assert.strictEqual((twice.match(/\*\*Status:\*\*/g) || []).length, 1);
    assert.strictEqual((twice.match(/\*\*Scope:\*\*/g) || []).length, 1);
    assert.strictEqual(parseFindingMeta(twice).scope, 'user');
});

if (failed > 0) { process.stdout.write(`\n${failed} failed, ${passed} passed\n`); process.exit(1); }
process.stdout.write(`\nAll ${passed} findingMeta tests passed\n`);
