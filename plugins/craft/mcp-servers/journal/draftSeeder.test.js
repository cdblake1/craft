'use strict';

// draftSeeder.test.js -- session-end draft seeder, ported onto the adapter.
// Run: node draftSeeder.test.js

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createFileStore } = require('../../lib/storage');
const { createJournals } = require('./journals');
const sessionState = require('./sessionState');
const { createDraftSeeder } = require('./draftSeeder');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); process.stdout.write(`PASS  ${name}\n`); passed++; }
    catch (e) { process.stdout.write(`FAIL  ${name}\n        ${e.message}\n`); failed++; }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'craft-seed-'));
const ssRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'craft-seed-ss-'));
process.env.COPILOT_SESSION_STATE_ROOT = ssRoot;

const store = createFileStore({ root: tmp });
const journals = createJournals(store);
const seeder = createDraftSeeder({ store, journals, sessionState });

store.write('journals/repo/dev/test/A/meta.json', JSON.stringify({ repo: 'repo', branch: 'dev/test/A' }));

function writeSession(id, title, overview) {
    const dir = path.join(ssRoot, id);
    fs.mkdirSync(path.join(dir, 'checkpoints'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'workspace.yaml'), `id: ${id}\nname: ${title}\n`);
    fs.writeFileSync(path.join(dir, 'checkpoints', 'index.md'),
        `# Checkpoint History\n\n| # | Title | File |\n|---|---|---|\n| 1 | ${title} | 001.md |\n`);
    fs.writeFileSync(path.join(dir, 'checkpoints', '001.md'), `<overview>\n${overview}\n</overview>\n`);
    return dir;
}

const OV1 = 'This session built the draft seeder so findings actually get created from the rich checkpoint overview, deduped, instead of the dead extractors.';
const sess1 = writeSession('sess1', 'Newest work', OV1);

test('seedDraftFromSession writes a draft from the checkpoint overview', () => {
    const res = seeder.seedDraftFromSession({ branch: 'dev/test/A', repo: 'repo', sessionDir: sess1, sessionId: 'sess1' });
    assert.ok(res && res.created === true);
    assert.ok(/\/findings\/_drafts\/\d{4}-\d{2}-\d{2}-newest-work-[0-9a-f]{8}\.md$/.test(res.key), res.key);
    const body = store.read(res.key);
    assert.ok(body.includes('## When to read this'));
    assert.ok(body.includes('**Source:** session:sess1'));
    assert.ok(body.toLowerCase().includes('draft seeder'));
});

test('countDraftFindings reflects the seeded draft', () => {
    assert.strictEqual(journals.countDraftFindings('dev/test/A', 'repo'), 1);
});

test('seedDraftFromSession is idempotent (content-hash dedup)', () => {
    const res = seeder.seedDraftFromSession({ branch: 'dev/test/A', repo: 'repo', sessionDir: sess1, sessionId: 'sess1' });
    assert.ok(res && res.created === false);
    assert.strictEqual(journals.countDraftFindings('dev/test/A', 'repo'), 1);
});

test('same-day same-slug but different overview keeps both drafts', () => {
    // Same checkpoint title (same slug, same day) but a different overview (so a
    // different content hash); the hash in the filename must keep both.
    const sess2 = writeSession('sess2', 'Newest work', 'A completely different durable lesson about avoiding silent draft overwrites when two same-day sessions share a slug.');
    const before = journals.countDraftFindings('dev/test/A', 'repo');
    const res = seeder.seedDraftFromSession({ branch: 'dev/test/A', repo: 'repo', sessionDir: sess2, sessionId: 'sess2' });
    assert.ok(res && res.created === true);
    assert.strictEqual(journals.countDraftFindings('dev/test/A', 'repo'), before + 1);
});

test('seedDraftFromSession skips a too-thin overview', () => {
    const res = seeder.seedDraftFromSession({ branch: 'dev/test/A', repo: 'repo', sessionDir: sess1, sessionId: 'sess1', minLen: 9999 });
    assert.strictEqual(res, null);
});

test('seedDraftFromSession returns null for a branch with no journal', () => {
    const res = seeder.seedDraftFromSession({ branch: 'dev/test/no-journal', repo: 'repo', sessionDir: sess1, sessionId: 'sess1' });
    assert.strictEqual(res, null);
});

// --- P3: self-feeding capture (auto-promote high-confidence seeds) ---
const OV_LONG = 'This session established that the draft-seeder confidence gate auto-promotes a substantive checkpoint overview directly into the retrievable findings corpus, so the next session surfaces it without any manual human promotion step, which fixes the starved-corpus problem.';
const sessHi = writeSession('sessHi', 'Auto-promote substantive seeds', OV_LONG);

test('a high-confidence seed is promoted into findings/ (not _drafts/)', () => {
    const before = journals.countDraftFindings('dev/test/A', 'repo');
    const res = seeder.seedDraftFromSession({ branch: 'dev/test/A', repo: 'repo', sessionDir: sessHi, sessionId: 'sessHi' });
    assert.ok(res && res.created === true && res.promoted === true, JSON.stringify(res));
    assert.ok(/\/findings\/\d{2}-auto-promote-substantive-seeds\.md$/.test(res.key), res.key);
    assert.ok(res.key.indexOf('/_drafts/') === -1, 'must not be a draft');
    assert.strictEqual(journals.countDraftFindings('dev/test/A', 'repo'), before, 'draft count unchanged');
});

test('a promoted seed is retrievable by find_findings with no human step', () => {
    const r = journals.findFindings('auto-promote substantive corpus');
    const hit = r.find(x => x.key.endsWith('auto-promote-substantive-seeds.md'));
    assert.ok(hit, 'promoted finding is retrievable');
    assert.strictEqual(hit.status, 'active');
    assert.strictEqual(hit.scope, 'branch');
    const f = journals.getFinding(hit.key);
    assert.ok(f.when_to_read && f.when_to_read.length > 10, 'a When-to-read hint was derived');
});

test('promotion is idempotent (content-hash dedup across findings/ + _drafts/)', () => {
    const res = seeder.seedDraftFromSession({ branch: 'dev/test/A', repo: 'repo', sessionDir: sessHi, sessionId: 'sessHi' });
    assert.ok(res && res.created === false, JSON.stringify(res));
});

test('autoPromote:false forces the draft path even for a substantive seed', () => {
    const sessHi2 = writeSession('sessHi2', 'Forced draft path', OV_LONG + ' Extra unique tail to change the hash xyzzy.');
    const res = seeder.seedDraftFromSession({ branch: 'dev/test/A', repo: 'repo', sessionDir: sessHi2, sessionId: 'sessHi2', autoPromote: false });
    assert.ok(res && res.created === true && res.promoted === false, JSON.stringify(res));
    assert.ok(res.key.indexOf('/_drafts/') !== -1, res.key);
});

delete process.env.COPILOT_SESSION_STATE_ROOT;
fs.rmSync(tmp, { recursive: true, force: true });
fs.rmSync(ssRoot, { recursive: true, force: true });
process.stdout.write(`\nTotal: ${passed + failed}, passed: ${passed}, failed: ${failed}\n`);
process.exit(failed === 0 ? 0 : 1);
