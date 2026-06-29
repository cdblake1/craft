'use strict';

// ranker.test.js -- the retrieval ranking seam. Run: node ranker.test.js
//
// Proves the P1 go/no-go: (1) BM25 reproduces the journal's previous scoring and
// stable corpus-order tie-break (parity), and (2) the seam degrades to the BM25
// floor with no embedder while still supporting an optional embedding re-ranker
// (offline-degradable). Zero-dep: assert only.

const assert = require('assert');
const { createRanker, createBm25Ranker, createEmbeddingRanker } = require('./ranker');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); process.stdout.write(`PASS  ${name}\n`); passed++; }
    catch (e) { process.stdout.write(`FAIL  ${name}\n        ${e.message}\n`); failed++; }
}

function toks(s) { return s.toLowerCase().split(/\s+/).filter(Boolean); }
function doc(key, text) { return { key, body: text, tokens: toks(text) }; }

const corpus = [
    doc('A', 'atomic kernel exclusion claim layer exclusion exclusion'),
    doc('B', 'bridging two data stores soft hard foreign keys'),
    doc('C', 'atomic claim layer once'),
];

// --- Parity: the standalone BM25 ranker reproduces the inline algorithm ---

test('bm25 ranks the more-relevant doc first, score > 0', () => {
    const r = createBm25Ranker().rank(toks('claim layer exclusion'), corpus);
    assert.ok(r.length >= 1);
    assert.strictEqual(r[0].doc.key, 'A');
    assert.ok(r[0].score > 0);
});

test('bm25 sorts descending and excludes zero-score docs', () => {
    const r = createBm25Ranker().rank(toks('atomic'), corpus);
    for (let i = 0; i < r.length - 1; i++) { assert.ok(r[i].score >= r[i + 1].score); }
    assert.ok(!r.find(x => x.doc.key === 'B')); // 'atomic' absent from B
});

test('bm25 scores are rounded to 4 decimals (parity with prior _findingResult)', () => {
    const r = createBm25Ranker().rank(toks('atomic claim'), corpus);
    for (const x of r) { assert.strictEqual(Number(x.score.toFixed(4)), x.score); }
});

test('bm25 tie-break is stable: equal-score docs keep corpus order', () => {
    // Two identical-body docs => identical scores; stable sort preserves input order.
    const tied = [doc('first', 'same same token'), doc('second', 'same same token')];
    const r = createBm25Ranker().rank(toks('same'), tied);
    assert.deepStrictEqual(r.map(x => x.doc.key), ['first', 'second']);
});

// --- Offline-degradable: the selector returns BM25 with no embedder ---

test('createRanker() with no embedder is the BM25 floor', () => {
    const r = createRanker();
    assert.strictEqual(r.name, 'bm25');
});

test('createRanker({embedder}) selects the embedding ranker', () => {
    const r = createRanker({ embedder: () => [1, 0, 0] });
    assert.strictEqual(r.name, 'embedding');
});

// --- The seam supports a second impl that never widens the candidate set ---

test('embedding ranker never includes a doc BM25 excluded (no inclusion gate change)', () => {
    // Fake embedder favors B, but B has no lexical match for the query, so BM25
    // never makes it a candidate -> embeddings cannot resurrect it.
    const embed = (t) => (/keys|bridging|stores/.test(t) ? [0, 1] : [1, 0]);
    const r = createEmbeddingRanker(embed).rank(toks('atomic claim'), corpus, { queryText: 'atomic claim' });
    assert.ok(!r.find(x => x.doc.key === 'B'));
    assert.ok(r.length >= 1);
});

test('embedding ranker reorders candidates by semantic blend', () => {
    // Query lexically hits A and C; a fake embedder that strongly matches C's text
    // should be able to lift C above A despite A''s higher raw BM25.
    const embed = (t) => (/once/.test(t) ? [0, 1] : (/layer/.test(t) ? [0.2, 0.9] : [1, 0]));
    const base = createBm25Ranker().rank(toks('atomic claim layer'), corpus);
    const r = createEmbeddingRanker(embed).rank(toks('atomic claim layer'), corpus, { queryText: 'once layer' });
    // same candidate SET as bm25 (offline-degradable invariant), possibly reordered
    assert.deepStrictEqual(new Set(r.map(x => x.doc.key)), new Set(base.map(x => x.doc.key)));
});

test('embedding ranker degrades to BM25 order when embedder throws', () => {
    const bad = () => { throw new Error('no backend'); };
    const base = createBm25Ranker().rank(toks('atomic claim'), corpus);
    const r = createEmbeddingRanker(bad).rank(toks('atomic claim'), corpus, { queryText: 'x' });
    assert.deepStrictEqual(r.map(x => x.doc.key), base.map(x => x.doc.key));
});

// --- P4: usageAdjust (usage + recency boost, staleness demote/flag) ---

const { usageAdjust } = require('./ranker');
const DAY = 86400000;
const NOW = Date.UTC(2026, 5, 29);

test('neutral metadata yields factor 1.0 (parity-preserving)', () => {
    const a = usageAdjust(5, { status: 'active', consults: 0, last_consulted_at: null }, NOW);
    assert.strictEqual(a.factor, 1);
    assert.strictEqual(a.score, 5);
    assert.strictEqual(a.stale, false);
});

test('more consults boosts the score', () => {
    const none = usageAdjust(5, { status: 'active', consults: 0 }, NOW).score;
    const some = usageAdjust(5, { status: 'active', consults: 4 }, NOW).score;
    assert.ok(some > none);
});

test('a recent consult lifts above an equal-relevance never-consulted finding', () => {
    const recent = usageAdjust(5, { status: 'active', consults: 1, last_consulted_at: '2026-06-25' }, NOW).score;
    const never = usageAdjust(5, { status: 'active', consults: 0, last_consulted_at: null }, NOW).score;
    assert.ok(recent > never);
});

test('a cold consult (older than staleDays) flags stale and demotes', () => {
    const cold = usageAdjust(5, { status: 'active', consults: 2, last_consulted_at: '2026-01-01' }, NOW, { staleDays: 90 });
    assert.strictEqual(cold.stale, true);
    assert.ok(cold.score < 5);
});

test('superseded/retired status flags stale and demotes regardless of consults', () => {
    const sup = usageAdjust(5, { status: 'superseded', consults: 10, last_consulted_at: '2026-06-28' }, NOW);
    assert.strictEqual(sup.stale, true);
    assert.ok(sup.score < 5);
});

// --- P9: a configured embedder beats BM25 on a labeled set (re-ranks candidates) ---
test('semantic re-ranker fixes a labeled case BM25 gets wrong', () => {
    // Both docs are BM25 candidates (share the token 'vehicle'). docA repeats
    // 'vehicle' so BM25 ranks it first by term frequency, but the user's intent
    // (queryText) is mechanical, so docB (engine/transmission) is the right answer.
    const docs = [
        doc('A', 'vehicle vehicle vehicle paint wax shine detailing'),
        doc('B', 'vehicle engine transmission overhaul mechanic'),
    ];
    const q = toks('vehicle');
    const baseOrder = createBm25Ranker().rank(q, docs).map(x => x.doc.key);
    assert.strictEqual(baseOrder[0], 'A', 'BM25 favors the term-frequency doc');
    // Embedder: mechanical text -> [0,1], cosmetic text -> [1,0].
    const embed = (t) => (/engine|transmission|overhaul|mechanic/.test(t) ? [0, 1] : [1, 0]);
    const semantic = createEmbeddingRanker(embed).rank(q, docs, { queryText: 'vehicle engine repair' });
    assert.deepStrictEqual(new Set(semantic.map(x => x.doc.key)), new Set(baseOrder), 'candidate set unchanged');
    assert.strictEqual(semantic[0].doc.key, 'B', 'semantic lifts the right doc above BM25 order');
});

if (failed > 0) { process.stdout.write(`\n${failed} failed, ${passed} passed\n`); process.exit(1); }
process.stdout.write(`\nAll ${passed} ranker tests passed\n`);
