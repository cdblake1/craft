'use strict';

// ranker.js -- the retrieval ranking strategy seam for the journal.
//
// One interface: rank(queryTerms, docs, ctx) -> [{ doc, score }] sorted by score
// desc, score > 0. BM25 is the offline floor (no dependencies, always available);
// an optional embedding ranker re-ranks the BM25 candidate set when an embedder
// is configured. The embedder NEVER gates inclusion -- BM25 decides the candidate
// set, embeddings only reorder it -- so retrieval degrades gracefully to pure
// BM25 on a cold/offline box. createRanker(opts) is the selector both the journal
// core and the resume composer call instead of scoring inline (spec 02 §6).
//
// Parity contract: createBm25Ranker().rank reproduces the journal's previous
// inline BM25 exactly -- same scoring, the same 4-decimal rounding, and a stable
// sort that leaves equal-score docs in corpus order (journals.test.js is the gate).

const _BM25_K1 = 1.5;
const _BM25_B = 0.75;

// idf * tf saturation, length-normalized. stats = { N, df, avgdl }.
function _bm25Score(queryTerms, docTokens, stats) {
    const tf = Object.create(null);
    for (const t of docTokens) { tf[t] = (tf[t] || 0) + 1; }
    const dl = docTokens.length || 1;
    let score = 0;
    for (const t of queryTerms) {
        const f = tf[t];
        if (!f) { continue; }
        const df = stats.df[t] || 0;
        const idf = Math.log(1 + (stats.N - df + 0.5) / (df + 0.5));
        score += idf * (f * (_BM25_K1 + 1)) / (f + _BM25_K1 * (1 - _BM25_B + _BM25_B * (dl / stats.avgdl)));
    }
    return score;
}

// The offline floor. docs each carry `.tokens` (pre-tokenized body).
function createBm25Ranker() {
    function rank(queryTerms, docs) {
        const df = Object.create(null);
        let totalLen = 0;
        for (const d of docs) {
            totalLen += d.tokens.length;
            for (const t of new Set(d.tokens)) { df[t] = (df[t] || 0) + 1; }
        }
        const stats = { N: docs.length || 1, df, avgdl: (totalLen / (docs.length || 1)) || 1 };
        const scored = [];
        for (const d of docs) {
            const raw = _bm25Score(queryTerms, d.tokens, stats);
            if (raw <= 0) { continue; }
            scored.push({ doc: d, score: Number(raw.toFixed(4)) });
        }
        scored.sort((a, b) => b.score - a.score);
        return scored;
    }
    return { name: 'bm25', rank };
}

function _cosine(a, b) {
    let dot = 0, na = 0, nb = 0;
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    if (na === 0 || nb === 0) { return 0; }
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Optional semantic re-ranker. Takes the BM25 candidate set (never widens it) and
// reorders it by a blend of the BM25 score and cosine similarity between the query
// embedding and each doc-body embedding. With no usable embedder it returns the
// BM25 order untouched, so the seam always degrades to the floor. ctx.queryText is
// the raw query string (queryTerms are stemmed/stopworded and not embeddable).
// The full production embedding backend is P9; this is the seam the spike proves.
function createEmbeddingRanker(embedder, base) {
    base = base || createBm25Ranker();
    const blend = 0.5;
    function rank(queryTerms, docs, ctx) {
        const candidates = base.rank(queryTerms, docs);
        if (typeof embedder !== 'function' || candidates.length === 0) { return candidates; }
        const qText = (ctx && ctx.queryText) || queryTerms.join(' ');
        let qv;
        try { qv = embedder(qText); } catch (_) { return candidates; }
        if (!Array.isArray(qv)) { return candidates; }
        const maxBm25 = candidates[0].score || 1;
        const rescored = candidates.map(c => {
            let sim = 0;
            try { sim = _cosine(qv, embedder(String(c.doc.body || ''))); } catch (_) { sim = 0; }
            const blended = blend * (c.score / maxBm25) + (1 - blend) * sim;
            return { doc: c.doc, score: c.score, _blended: blended };
        });
        rescored.sort((a, b) => b._blended - a._blended);
        return rescored.map(({ doc, score }) => ({ doc, score }));
    }
    return { name: 'embedding', rank };
}

// The selector the journal calls. No embedder configured -> BM25 floor (the
// offline/cold-box path). An embedder function -> semantic re-ranker over the
// BM25 candidate set. This is the single seam that keeps semantic retrieval
// pluggable and offline-degradable (spec 02 §6, the P1 go/no-go).
function createRanker(opts) {
    opts = opts || {};
    const bm25 = createBm25Ranker();
    if (typeof opts.embedder === 'function') { return createEmbeddingRanker(opts.embedder, bm25); }
    return bm25;
}

// usageAdjust -- the P4 layer that turns the measured consult signal + finding
// lifecycle into a ranking adjustment. Applied OVER a base (BM25) score, never
// inside it, so pure relevance stays parity-exact: a finding with neutral
// metadata (0 consults, active, never consulted) gets factor 1.0 and an unchanged
// score. Returns { score, stale, factor }.
//   - usage boost:   more consults -> higher (multiplicative, log-damped)
//   - recency boost: consulted within staleDays -> a small lift
//   - staleness:     superseded/retired/stale status, or a consult older than
//                    staleDays, demotes the score and flags `stale` for curation.
function usageAdjust(baseScore, meta, nowMs, opts) {
    opts = opts || {};
    const usageWeight = opts.usageWeight != null ? opts.usageWeight : 0.5;
    const recencyWeight = opts.recencyWeight != null ? opts.recencyWeight : 0.2;
    const staleDemote = opts.staleDemote != null ? opts.staleDemote : 0.3;
    const staleDays = opts.staleDays != null ? opts.staleDays : 90;
    const m = meta || {};
    let factor = 1;
    let stale = m.status === 'superseded' || m.status === 'retired' || m.status === 'stale';

    const consults = Number.isFinite(m.consults) ? m.consults : 0;
    if (consults > 0) { factor *= (1 + usageWeight * Math.log(1 + consults)); }

    if (m.last_consulted_at) {
        const t = Date.parse(m.last_consulted_at);
        if (isFinite(t)) {
            const ageDays = (nowMs - t) / 86400000;
            if (ageDays <= staleDays) { factor *= (1 + recencyWeight); }
            else { stale = true; }
        }
    }
    if (stale) { factor *= staleDemote; }
    return { score: baseScore * factor, stale, factor };
}

module.exports = { createRanker, createBm25Ranker, createEmbeddingRanker, usageAdjust, _bm25Score };
