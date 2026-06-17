'use strict';

// findings-store.js -- minimal findings access over a storage adapter.
//
// Slice 1's consumer: it exercises the adapter's document operations against
// the journal's real access shape (numbered findings under a branch key), which
// is what proves the adapter abstraction end-to-end. The full journal port
// (BM25 search, sessionState, resume, draft seeding, signal) routes through the
// same adapter in slice 2.

function slugify(title) {
    return String(title || 'untitled')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 60) || 'untitled';
}

function _firstH1(body) {
    const m = String(body || '').match(/^#\s+(.+)$/m);
    return m ? m[1].trim() : null;
}

function _prefixNum(key) {
    const m = key.match(/\/(\d{2})-[^/]+\.md$/);
    return m ? parseInt(m[1], 10) : 0;
}

function _findingsPrefix(branchKey) {
    return String(branchKey).replace(/\/+$/, '') + '/findings';
}

// All numbered findings under a branch, sorted by their numeric prefix.
function listFindings(store, branchKey) {
    const prefix = _findingsPrefix(branchKey);
    return store.list(prefix)
        .filter(k => /\/\d{2}-[^/]+\.md$/.test(k))
        .sort((a, b) => _prefixNum(a) - _prefixNum(b))
        .map(k => ({ key: k }));
}

// Create a finding: next numbered prefix + slug, body must carry an H1.
// Returns the logical key written.
function createFinding(store, branchKey, title, body) {
    if (!title || !String(title).trim()) { throw new Error('title is required'); }
    if (!/^#\s+/m.test(String(body || ''))) {
        throw new Error('body must contain at least one H1 markdown heading');
    }
    const existing = listFindings(store, branchKey);
    const maxPrefix = existing.reduce((a, e) => Math.max(a, _prefixNum(e.key)), 0);
    const prefix = String(maxPrefix + 1).padStart(2, '0');
    const key = _findingsPrefix(branchKey) + '/' + prefix + '-' + slugify(title) + '.md';
    if (store.exists(key)) { throw new Error('finding already exists: ' + key); }
    store.write(key, body);
    return key;
}

// Read one finding back: parsed title (H1) + body, or null if absent.
function getFinding(store, key) {
    const body = store.read(key);
    if (body === null) { return null; }
    return { key: key, title: _firstH1(body), body: body };
}

module.exports = { listFindings, createFinding, getFinding, slugify };
