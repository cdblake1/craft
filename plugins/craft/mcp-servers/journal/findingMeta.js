'use strict';

// findingMeta.js -- parse/serialize the finding metadata header.
//
// A finding body may carry a metadata block of "**Field:** value" lines in the
// header region (after the H1 title, before the first section/paragraph). Fields:
//   Status        active | stale | superseded | retired
//   Scope         branch | repo | user
//   Supersedes    <finding key this one replaces>
//   Superseded-by <finding key that replaced this one>
//   Last-consulted <ISO date the finding was last opened>
//   Consults      <integer open count>
//   Relates-to    <comma-separated finding/plan keys>
//
// All fields are OPTIONAL. A finding with no header -- every finding written
// before this change -- parses to safe defaults (active, branch, 0 consults, no
// links). Backward-compatible by construction: absence is the default, never an
// error. Parsing is bounded to the header region so a "**Status:**" mention deep
// in a body cannot be mistaken for metadata.

const STATUSES = ['active', 'stale', 'superseded', 'retired'];
const SCOPES = ['branch', 'repo', 'user'];

const _META_LINE = /^\s*\*\*([A-Za-z][A-Za-z -]*?):\*\*\s*(.*)$/;

function defaultMeta() {
    return {
        status: 'active', scope: 'branch',
        supersedes: null, superseded_by: null,
        last_consulted_at: null, consults: 0, relates_to: [],
    };
}

// Walk to the first H1, then read contiguous header lines until a section
// heading (## ) or the first non-meta content line ends the region.
function parseFindingMeta(body) {
    const meta = defaultMeta();
    if (!body) { return meta; }
    const lines = String(body).split(/\r?\n/);
    let i = 0;
    while (i < lines.length && !/^#\s+/.test(lines[i])) { i++; }
    if (i >= lines.length) { return meta; }
    for (i++; i < lines.length; i++) {
        const line = lines[i];
        if (/^\s*$/.test(line)) { continue; }
        if (/^##\s+/.test(line)) { break; }
        const m = line.match(_META_LINE);
        if (!m) { break; }
        const field = m[1].trim().toLowerCase().replace(/\s+/g, '-');
        const val = m[2].trim();
        switch (field) {
            case 'status': if (STATUSES.indexOf(val.toLowerCase()) !== -1) { meta.status = val.toLowerCase(); } break;
            case 'scope': if (SCOPES.indexOf(val.toLowerCase()) !== -1) { meta.scope = val.toLowerCase(); } break;
            case 'supersedes': meta.supersedes = val || null; break;
            case 'superseded-by': meta.superseded_by = val || null; break;
            case 'last-consulted': meta.last_consulted_at = val || null; break;
            case 'consults': { const n = parseInt(val, 10); if (Number.isFinite(n) && n >= 0) { meta.consults = n; } break; }
            case 'relates-to': meta.relates_to = val ? val.split(/\s*,\s*/).filter(Boolean) : []; break;
            default: break;
        }
    }
    return meta;
}

// The header block (no trailing newline). Always emits Status + Scope; optional
// fields only when set, so a minimal finding stays clean.
function serializeFindingMeta(meta) {
    const m = Object.assign(defaultMeta(), meta || {});
    const out = [`**Status:** ${m.status}`, `**Scope:** ${m.scope}`];
    if (m.supersedes) { out.push(`**Supersedes:** ${m.supersedes}`); }
    if (m.superseded_by) { out.push(`**Superseded-by:** ${m.superseded_by}`); }
    if (m.last_consulted_at) { out.push(`**Last-consulted:** ${m.last_consulted_at}`); }
    if (m.consults) { out.push(`**Consults:** ${m.consults}`); }
    if (m.relates_to && m.relates_to.length) { out.push(`**Relates-to:** ${m.relates_to.join(', ')}`); }
    return out.join('\n');
}

// Insert (or replace) the metadata header right after the H1. Idempotent: an
// existing contiguous header after the H1 is stripped first, so re-applying does
// not stack headers. Returns the body unchanged if it has no H1 (caller validates
// H1 separately).
function withFindingMeta(body, meta) {
    const lines = String(body || '').split(/\r?\n/);
    let i = 0;
    while (i < lines.length && !/^#\s+/.test(lines[i])) { i++; }
    if (i >= lines.length) { return String(body || ''); }
    let k = i + 1;
    while (k < lines.length && /^\s*$/.test(lines[k])) { k++; }
    while (k < lines.length && _META_LINE.test(lines[k])) { k++; }
    const rest = lines.slice(k);
    const head = lines.slice(0, i + 1);
    const tail = rest.length ? ['', ...rest] : [''];
    return [...head, '', serializeFindingMeta(meta), ...tail].join('\n');
}

// Strip the metadata header block (the contiguous **Field:** lines after the H1)
// so it is not fed to the retrieval tokenizer. Without this, a Supersedes/
// Relates-to value -- a finding KEY containing the branch path -- leaks tokens
// like the branch name into BM25 and pollutes search. Content and H1 are kept.
function stripMetaHeader(body) {
    const lines = String(body || '').split(/\r?\n/);
    let i = 0;
    while (i < lines.length && !/^#\s+/.test(lines[i])) { i++; }
    if (i >= lines.length) { return String(body || ''); }
    let k = i + 1;
    while (k < lines.length && /^\s*$/.test(lines[k])) { k++; }
    let removed = false;
    while (k < lines.length && _META_LINE.test(lines[k])) { k++; removed = true; }
    if (!removed) { return String(body || ''); }
    return [...lines.slice(0, i + 1), ...lines.slice(k)].join('\n');
}

module.exports = { defaultMeta, parseFindingMeta, serializeFindingMeta, withFindingMeta, stripMetaHeader, STATUSES, SCOPES };
