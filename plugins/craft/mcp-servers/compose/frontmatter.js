'use strict';

// frontmatter.js -- minimal YAML-frontmatter parse/serialize for compose's plan
// and roadmap documents. Zero-dep (no YAML library): the frontmatter is a flat
// block of `key: value` scalar pairs between `---` fences, followed by the prose
// body. This is deliberately not general YAML; compose only ever writes flat
// scalar frontmatter (id, parent_id, type, status, completion_pct, title), and a
// strict tiny parser is safer here than pulling in a dependency.
//
//   ---
//   id: 01J...
//   type: plan
//   parent_id: 01H...
//   status: in-flight
//   completion_pct: 40
//   ---
//   <prose body>

// Scalar coercion on read: integers become numbers, the bare words true/false
// become booleans, an empty value and the bare word null become null. Everything
// else stays a string (quotes, if present, are stripped).
function _coerce(raw) {
    const v = raw.trim();
    if (v === '' || v === 'null' || v === '~') { return null; }
    if (v === 'true') { return true; }
    if (v === 'false') { return false; }
    if (/^-?\d+$/.test(v)) { return parseInt(v, 10); }
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        return v.slice(1, -1);
    }
    return v;
}

// Serialize a scalar for write. Strings that could be misread (empty, leading/
// trailing space, or a leading special char) are double-quoted; everything else
// is written bare. Objects/arrays are rejected (frontmatter is flat scalars).
function _emit(value) {
    if (value === null || value === undefined) { return 'null'; }
    if (typeof value === 'number' || typeof value === 'boolean') { return String(value); }
    const s = String(value);
    if (s === '' || s !== s.trim() || /^[#&*!|>%@`"']/.test(s) || /[:\n]/.test(s)) {
        return JSON.stringify(s);
    }
    return s;
}

// Parse a document into { data, body }. A document with no leading `---` fence is
// all body and empty data. Never throws on malformed input: a line without a
// colon in the frontmatter block is skipped.
function parse(text) {
    const src = String(text || '');
    const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(src);
    if (!m) { return { data: {}, body: src.replace(/^\uFEFF/, '') }; }
    const data = {};
    for (const line of m[1].split(/\r?\n/)) {
        if (!line.trim() || line.trim().startsWith('#')) { continue; }
        const idx = line.indexOf(':');
        if (idx === -1) { continue; }
        const key = line.slice(0, idx).trim();
        if (!key) { continue; }
        data[key] = _coerce(line.slice(idx + 1));
    }
    return { data: data, body: m[2] };
}

// Serialize { data, body } back to a document. Keys are written in insertion
// order, so callers control field order by building the object accordingly.
function stringify(data, body) {
    const keys = Object.keys(data || {});
    const lines = ['---'];
    for (const k of keys) { lines.push(k + ': ' + _emit(data[k])); }
    lines.push('---');
    const prose = String(body || '');
    return lines.join('\n') + '\n' + (prose ? prose.replace(/^\n+/, '') : '') + (prose && !prose.endsWith('\n') ? '\n' : '');
}

module.exports = { parse, stringify };
