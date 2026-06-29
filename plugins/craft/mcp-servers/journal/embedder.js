'use strict';

// embedder.js -- optional, opt-in embedding backend resolution for semantic
// re-ranking (P9). Zero-service by default: returns null unless the user points
// $CRAFT_JOURNAL_EMBEDDER at a module that exports an embed(text) -> number[]
// function (or is that function). The journal then re-ranks the BM25 candidate
// set by semantic similarity (ranker.createEmbeddingRanker); with no embedder it
// stays pure BM25 (offline parity, the wedge). Resolution NEVER throws -- a bad
// or missing module degrades silently to the BM25 floor rather than breaking
// retrieval. The embedder only re-orders the BM25 candidate set; it never widens
// it, so a configured backend can sharpen ranking but cannot change which
// findings are eligible.

function resolveEmbedder(env) {
    env = env || {};
    const spec = env.CRAFT_JOURNAL_EMBEDDER;
    if (!spec || typeof spec !== 'string') { return null; }
    try {
        const mod = require(spec);
        const fn = (typeof mod === 'function') ? mod : (mod && mod.embed);
        return (typeof fn === 'function') ? fn : null;
    } catch (_) { return null; }
}

module.exports = { resolveEmbedder };
