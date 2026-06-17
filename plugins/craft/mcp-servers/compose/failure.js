'use strict';

// failure.js -- trigger-based, fact-grounded failure capture (design 0001, D6).
//
// Two phases, two hook handlers, joined through the adapter:
//   1. postToolUseFailure accumulates observable failure FACTS (tool, error
//      text, exit code) into a per-session pending log on the adapter.
//   2. sessionEnd fingerprints + deduplicates the pending facts into the compose
//      item layer (category 'failure') and emits an end-of-session notice.
//
// Triggers are observable (a tool failed), never an LLM's after-the-fact
// feeling. Fingerprinting is deliberately coarse (normalized error text + tool +
// exit pattern); some false splits/merges are accepted (D6 cost). The captured
// item text is sanitized of PII first -- the store is synced/published, so a
// failure record describes the finding, not the raw data that surfaced it.

const pii = require('./pii');

const PENDING_PREFIX = 'failures/pending/';
const ERROR_MAX = 2000;
const TITLE_MAX = 240;
const NOTES_MAX = 480;

function _pendingKey(sessionId) { return PENDING_PREFIX + String(sessionId) + '.jsonl'; }

// Collapse volatile substrings (paths, hex, numbers) so the same failure
// recurring with different incidental detail lands on one fingerprint.
function _normalize(text) {
    return String(text || '')
        .replace(/[a-zA-Z]:[\\/][^\s"']*/g, '<path>')
        .replace(/\/(?:home|Users)\/[^\s"']*/gi, '<path>')
        .replace(/0x[0-9a-fA-F]+/g, '<hex>')
        .replace(/\b[0-9a-fA-F]{8,}\b/g, '<hex>')
        .replace(/\b\d+\b/g, '<n>')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

// tool | exitPattern | normalized-error-head -> a stable grouping key.
function fingerprint(fact) {
    const tool = String((fact && fact.tool) || '').toLowerCase();
    const exit = (fact && fact.exitCode != null && fact.exitCode !== '') ? ('exit' + fact.exitCode) : '';
    const errHead = _normalize(fact && fact.error).slice(0, 160);
    return [tool, exit, errHead].filter(Boolean).join('|') || 'unknown';
}

// Redact PII for the human-readable captured text. Aggressive pattern redaction
// first, then a belt-and-suspenders pass with the shared detector: anything it
// still flags gets blunt-redacted so a failure item can never publish PII.
function sanitize(text) {
    let s = String(text || '')
        .replace(/[a-zA-Z]:[\\/]+Users[\\/]+[^\\/\s"']+/gi, '<user-path>')
        .replace(/[a-zA-Z]:[\\/][^\s"']*/g, '<path>')
        .replace(/\/(?:home|Users)\/[a-zA-Z0-9._-]+[^\s"']*/gi, '<user-path>')
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '<email>')
        .replace(/devdiv\.visualstudio\.com\/\S+/gi, '<azdo-link>')
        .replace(/\baka\.ms\/[a-z0-9-]+/gi, '<link>');
    for (const h of pii.detect(s)) { s = s.split(h.match).join('<redacted>'); }
    return s;
}

function createFailureCapture(deps) {
    deps = deps || {};
    const store = deps.store;
    const compose = deps.compose;
    if (!store) { throw new Error('createFailureCapture requires a store'); }

    function recordFailure(fact) {
        if (!fact || !fact.sessionId) { return false; }
        const rec = {
            ts: new Date().toISOString(),
            tool: String(fact.tool || ''),
            error: String(fact.error || '').slice(0, ERROR_MAX),
            exitCode: (fact.exitCode != null && fact.exitCode !== '') ? fact.exitCode : null,
        };
        store.append(_pendingKey(fact.sessionId), JSON.stringify(rec) + '\n');
        return true;
    }

    function _readPending(sessionId) {
        const raw = store.read(_pendingKey(sessionId));
        if (raw == null) { return []; }
        const out = [];
        for (const line of raw.split(/\r?\n/)) {
            const s = line.trim();
            if (!s) { continue; }
            try { out.push(JSON.parse(s)); } catch (_) { /* skip malformed */ }
        }
        return out;
    }

    // Read pending facts for the session, group by fingerprint, create one
    // compose item per unique failure (with occurrence count), then clear the
    // pending log. Returns { failures, captured, items }.
    function captureSession(opts) {
        opts = opts || {};
        const sid = opts.sessionId;
        if (!sid) { return { failures: 0, captured: 0, items: [] }; }
        const facts = _readPending(sid);
        if (facts.length === 0) { return { failures: 0, captured: 0, items: [] }; }
        if (!compose) { throw new Error('captureSession requires a compose instance'); }

        const groups = new Map();
        for (const f of facts) {
            const fp = fingerprint(f);
            if (!groups.has(fp)) { groups.set(fp, { fp: fp, count: 0, sample: f }); }
            groups.get(fp).count++;
        }

        const items = [];
        for (const g of groups.values()) {
            const tool = g.sample.tool || 'unknown';
            const errHead = sanitize(g.sample.error).replace(/\s+/g, ' ').trim().slice(0, 140);
            const title = (sanitize(`${tool} failed: ${errHead}`).slice(0, TITLE_MAX) || `${tool} failed`);
            const notes = sanitize(`Observed ${g.count}x this session. Representative error: ${g.sample.error}`).slice(0, NOTES_MAX);
            const it = compose.createItem({
                title: title,
                category: 'failure',
                severity: 'low',
                notes: notes,
                source_session_id: String(sid),
            });
            items.push({ id: it.id, fingerprint: g.fp, count: g.count });
        }

        try { store.remove(_pendingKey(sid)); } catch (_) { /* best effort */ }
        return { failures: facts.length, captured: items.length, items: items };
    }

    return { recordFailure, captureSession, fingerprint, sanitize };
}

module.exports = { createFailureCapture, fingerprint, sanitize };
