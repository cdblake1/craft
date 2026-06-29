'use strict';

// journals.test.js -- craft journal core, ported onto the storage adapter.
// Run: node journals.test.js   (zero-dep: assert + temp-dir fixture)
//
// Parity gate for slice 2: the journal's core data operations (corpus walk,
// BM25 search, finding/step-log/current-plan IO) now route through the adapter
// instead of direct fs. Fixtures are written THROUGH the adapter, proving the
// whole path.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createFileStore } = require('../../lib/storage');
const { createJournals } = require('./journals');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); process.stdout.write(`PASS  ${name}\n`); passed++; }
    catch (e) { process.stdout.write(`FAIL  ${name}\n        ${e.message}\n`); failed++; }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'craft-journals-'));
const store = createFileStore({ root: tmp });
const journals = createJournals(store);

function writeJournal(repo, branch, opts) {
    const leaf = `journals/${repo}/${branch}`;
    store.write(`${leaf}/meta.json`, JSON.stringify({ repo, branch, lastSeenAt: '2026-05-28T00:00:00Z' }));
    store.write(`${leaf}/README.md`, `# ${branch} - Session Journal\n\nReadme body.\n`);
    store.write(`${leaf}/current-plan.md`, `# Current plan for ${branch}\n\n${opts.planBody || 'No plan yet.'}\n`);
    for (const f of (opts.findings || [])) { store.write(`${leaf}/findings/${f.name}`, f.body); }
    for (const s of (opts.stepLogs || [])) { store.write(`${leaf}/step-log/${s.name}`, s.body); }
}

writeJournal('copilot-tools', 'dev/test/A', {
    planBody: 'Plan body for branch A; status active.',
    findings: [
        { name: '01-atomic-primitive.md', body: '# Finding: atomic kernel-level exclusion\n\n## When to read this\n\nBuilding any new claim layer.\n\nDecision: use O_EXCL kernel exclusion.' },
        { name: '02-dry-run-as-real-gate.md', body: '# Finding: dry-run as real gate\n\n## When to read this\n\nWhen real-money is unavailable.\n\nExplain why a dry-run gate substitutes.' },
    ],
    stepLogs: [
        { name: '2026-05-28.md', body: '# 2026-05-28 step log\n\nDay one.\n' },
        { name: '2026-05-27.md', body: '# 2026-05-27 step log\n\nPrior day.\n' },
    ],
});
writeJournal('copilot-tools', 'dev/test/B', {
    planBody: 'Branch B plan.',
    findings: [{ name: '01-bridging-data.md', body: '# Finding: bridging two data stores\n\n## When to read this\n\nConnecting independent stores.\n\nDecisions about soft vs hard FKs.' }],
    stepLogs: [{ name: '2026-05-28.md', body: '# 2026-05-28 step log\n\nBranch B.\n' }],
});
writeJournal('other-repo', 'dev/test/C', { planBody: 'Branch C plan.', stepLogs: [{ name: '2026-05-26.md', body: '# 2026-05-26 step log\n\nOther.\n' }] });
// A directory with no meta.json must be ignored.
store.write('journals/copilot-tools/dev/ignored-no-meta/README.md', '# ignored');

test('listAll returns the 3 valid journals', () => {
    assert.strictEqual(journals.listAll().length, 3);
});
test('listAll ignores dirs without meta.json', () => {
    assert.ok(!journals.listAll().find(j => j.branch === 'dev/ignored-no-meta'));
});
test('listAll counts findings + step-logs', () => {
    const a = journals.listAll().find(j => j.branch === 'dev/test/A');
    assert.strictEqual(a.findingCount, 2);
    assert.strictEqual(a.stepLogCount, 2);
});
test('findJournal by branch + repo', () => {
    const j = journals.findJournal('dev/test/A', 'copilot-tools');
    assert.ok(j && j.repo === 'copilot-tools');
});
test('findJournal unknown branch returns null', () => {
    assert.strictEqual(journals.findJournal('dev/test/nope'), null);
});
test('readJournalFull returns readme + plan + finding/step-log lists', () => {
    const j = journals.readJournalFull('dev/test/A', 'copilot-tools');
    assert.ok(j.readme.includes('Session Journal'));
    assert.ok(j.current_plan.includes('status active'));
    assert.strictEqual(j.findings.length, 2);
    assert.strictEqual(j.step_logs.length, 2);
});
test('getBranchStatus returns current_plan + counts', () => {
    const st = journals.getBranchStatus('dev/test/B', 'copilot-tools');
    assert.ok(st.current_plan.includes('Branch B plan'));
    assert.strictEqual(st.finding_count, 1);
});
test('findFindings BM25 ranks, scores, inlines when_to_read', () => {
    const r = journals.findFindings('claim layer exclusion');
    assert.ok(r.length >= 1);
    assert.ok(r[0].title.toLowerCase().includes('atomic'));
    assert.ok(typeof r[0].score === 'number' && r[0].score > 0);
    assert.ok(r[0].when_to_read.toLowerCase().includes('claim layer'));
    for (let i = 0; i < r.length - 1; i++) { assert.ok(r[i].score >= r[i + 1].score); }
});
test('findFindings single term matches case-insensitively', () => {
    const r = journals.findFindings('ATOMIC');
    assert.strictEqual(r.length, 1);
    assert.ok(r[0].snippet);
});
test('findFindings repo filter', () => {
    assert.strictEqual(journals.findFindings('finding', { repo: 'other-repo' }).length, 0);
});
test('findFindings branchPrefix filter', () => {
    assert.strictEqual(journals.findFindings('finding', { branchPrefix: 'dev/test/A' }).length, 2);
});
test('findFindings empty query lists all', () => {
    assert.ok(journals.findFindings('').length >= 3);
});
test('getFinding reads parsed metadata + body', () => {
    const r = journals.findFindings('atomic');
    const f = journals.getFinding(r[0].key);
    assert.ok(f.title.toLowerCase().includes('atomic'));
    assert.ok(f.when_to_read.includes('claim layer'));
    assert.ok(f.body.length > 50);
});
test('createFinding assigns next prefix + slug', () => {
    const key = journals.createFinding('dev/test/A', 'copilot-tools', 'New About Caching', '# New About Caching\n\n## When to read this\n\nCaches.\n\nBody.');
    assert.ok(/findings\/03-new-about-caching\.md$/.test(key), key);
    assert.ok(store.exists(key));
});
test('createFinding rejects body without H1', () => {
    assert.throws(() => journals.createFinding('dev/test/A', 'copilot-tools', 'Bad', 'no heading'), /H1/);
});
test('appendStepLog creates then appends a timestamped subheading', () => {
    journals.appendStepLog('dev/test/C', 'other-repo', 'First of the day.');
    journals.appendStepLog('dev/test/C', 'other-repo', 'Second.');
    const today = new Date().toISOString().substring(0, 10);
    const body = store.read(`journals/other-repo/dev/test/C/step-log/${today}.md`);
    assert.ok(body.includes('First of the day.') && body.includes('Second.'));
    assert.ok((body.match(/^## \d{2}:\d{2}:\d{2} UTC$/mg) || []).length >= 1);
});
test('updateCurrentPlan replaces the body', () => {
    const key = journals.updateCurrentPlan('dev/test/B', 'copilot-tools', '# New\n\nReplaced.');
    assert.strictEqual(store.read(key), '# New\n\nReplaced.');
});
test('countDraftFindings reflects a draft', () => {
    store.write('journals/copilot-tools/dev/test/A/findings/_drafts/2026-06-16-x.md', '# x\n');
    assert.strictEqual(journals.countDraftFindings('dev/test/A', 'copilot-tools'), 1);
});
test('findSimilarFindings flags a near-identical title', () => {
    const sim = journals.findSimilarFindings('Finding: atomic kernel-level exclusion');
    assert.ok(sim.length >= 1 && sim[0].similarity >= 0.6);
});
test('buildFindingsInjection surfaces relevant findings + null otherwise', () => {
    const inj = journals.buildFindingsInjection({ branch: 'dev/test/claim', planText: 'building an atomic claim layer with kernel exclusion', minScore: 0.5 });
    assert.ok(inj && inj.count >= 1 && inj.text.toLowerCase().includes('atomic'));
    assert.strictEqual(journals.buildFindingsInjection({ branch: 'x', planText: 'xyzzy zork frobnicate', minScore: 0.5 }), null);
});

// --- P2: finding metadata ---
test('header-less fixture findings expose default scope/status/consults', () => {
    const r = journals.findFindings('atomic');
    assert.strictEqual(r[0].scope, 'branch');
    assert.strictEqual(r[0].status, 'active');
    assert.strictEqual(r[0].consults, 0);
    const f = journals.getFinding(r[0].key);
    assert.strictEqual(f.scope, 'branch');
    assert.strictEqual(f.status, 'active');
    assert.deepStrictEqual(f.relates_to, []);
});
test('createFinding round-trips a scope through getFinding', () => {
    const key = journals.createFinding('dev/test/B', 'copilot-tools',
        'Scoped Lesson', '# Scoped Lesson\n\n## When to read this\n\nScoping.\n\nBody.', { scope: 'repo' });
    const f = journals.getFinding(key);
    assert.strictEqual(f.scope, 'repo');
    assert.strictEqual(f.status, 'active');
    assert.ok(f.title.includes('Scoped Lesson'));   // H1 still first
    assert.ok(f.when_to_read.includes('Scoping'));  // section still parsed
});

// --- P4: usage-ranked retrieval + staleness ---
test('recordConsult increments consults + sets last_consulted_at', () => {
    const r = journals.findFindings('bridging');           // finding 01-bridging-data in B
    const key = r[0].key;
    const res = journals.recordConsult(key, { at: '2026-06-29' });
    assert.strictEqual(res.consults, 1);
    assert.strictEqual(res.last_consulted_at, '2026-06-29');
    const f = journals.getFinding(key);
    assert.strictEqual(f.consults, 1);
    assert.ok(f.when_to_read.includes('independent stores')); // body preserved
});
test('a consulted finding outranks an equal-relevance never-consulted one', () => {
    // Two findings on branch B, same single-term query 'parity-token'.
    store.write('journals/copilot-tools/dev/test/B/findings/50-pa.md', '# PA\n\n## When to read this\n\nx\n\nparitytoken body alpha.');
    store.write('journals/copilot-tools/dev/test/B/findings/51-pb.md', '# PB\n\n## When to read this\n\nx\n\nparitytoken body beta.');
    journals.recordConsult('journals/copilot-tools/dev/test/B/findings/51-pb.md', { at: '2026-06-29' });
    const r = journals.findFindings('paritytoken', { nowMs: Date.UTC(2026, 5, 29) });
    const pa = r.findIndex(x => x.key.endsWith('50-pa.md'));
    const pb = r.findIndex(x => x.key.endsWith('51-pb.md'));
    assert.ok(pb >= 0 && pa >= 0 && pb < pa, `consulted PB (${pb}) should outrank PA (${pa})`);
});
test('a superseded finding is excluded from default retrieval, shown with includeRetired', () => {
    store.write('journals/copilot-tools/dev/test/B/findings/52-old.md', '# OLD\n\n**Status:** superseded\n**Scope:** branch\n\n## When to read this\n\nx\n\nstaletoken alpha.');
    store.write('journals/copilot-tools/dev/test/B/findings/53-new.md', '# NEW\n\n## When to read this\n\nx\n\nstaletoken beta.');
    const def = journals.findFindings('staletoken', { nowMs: Date.UTC(2026, 5, 29) });
    assert.ok(!def.find(x => x.key.endsWith('52-old.md')), 'superseded excluded by default');
    assert.ok(def.find(x => x.key.endsWith('53-new.md')), 'active still present');
    const all = journals.findFindings('staletoken', { nowMs: Date.UTC(2026, 5, 29), includeRetired: true });
    const old = all.find(x => x.key.endsWith('52-old.md'));
    assert.ok(old && old.stale === true, 'superseded shown + flagged stale with includeRetired');
});
test('a cold-consulted active finding is flagged stale and demoted (still retrievable)', () => {
    store.write('journals/copilot-tools/dev/test/B/findings/54-cold.md', '# COLD\n\n**Status:** active\n**Scope:** branch\n**Consults:** 2\n**Last-consulted:** 2026-01-01\n\n## When to read this\n\nx\n\ncoldtoken gamma.');
    store.write('journals/copilot-tools/dev/test/B/findings/55-fresh.md', '# FRESH\n\n## When to read this\n\nx\n\ncoldtoken delta.');
    const r = journals.findFindings('coldtoken', { nowMs: Date.UTC(2026, 5, 29) });
    const cold = r.find(x => x.key.endsWith('54-cold.md'));
    const fresh = r.find(x => x.key.endsWith('55-fresh.md'));
    assert.ok(cold && cold.stale === true);
    assert.ok(fresh && fresh.stale === false);
});

// --- P5: lifecycle (retire / supersede / update) ---
test('retireFinding hides it from default retrieval, kept on disk', () => {
    store.write('journals/copilot-tools/dev/test/B/findings/60-ret.md', '# RET\n\n## When to read this\n\nx\n\nretiretoken body.');
    assert.ok(journals.findFindings('retiretoken').find(x => x.key.endsWith('60-ret.md')));
    const res = journals.retireFinding('journals/copilot-tools/dev/test/B/findings/60-ret.md');
    assert.strictEqual(res.status, 'retired');
    assert.ok(!journals.findFindings('retiretoken').find(x => x.key.endsWith('60-ret.md')), 'retired excluded');
    assert.ok(store.exists('journals/copilot-tools/dev/test/B/findings/60-ret.md'), 'still on disk');
});
test('supersedeFinding links old->new and excludes the old', () => {
    store.write('journals/copilot-tools/dev/test/B/findings/61-o.md', '# O\n\n## When to read this\n\nx\n\nsupertoken old.');
    store.write('journals/copilot-tools/dev/test/B/findings/62-n.md', '# N\n\n## When to read this\n\nx\n\nsupertoken new.');
    const res = journals.supersedeFinding('journals/copilot-tools/dev/test/B/findings/61-o.md', 'journals/copilot-tools/dev/test/B/findings/62-n.md');
    assert.strictEqual(res.status, 'superseded');
    const oldF = journals.getFinding('journals/copilot-tools/dev/test/B/findings/61-o.md');
    const newF = journals.getFinding('journals/copilot-tools/dev/test/B/findings/62-n.md');
    assert.strictEqual(oldF.status, 'superseded');
    assert.strictEqual(oldF.superseded_by, 'journals/copilot-tools/dev/test/B/findings/62-n.md');
    assert.strictEqual(newF.supersedes, 'journals/copilot-tools/dev/test/B/findings/61-o.md');
    const r = journals.findFindings('supertoken');
    assert.ok(!r.find(x => x.key.endsWith('61-o.md')) && r.find(x => x.key.endsWith('62-n.md')));
});
test('updateFinding rewrites the body, preserves metadata, archives prior version', () => {
    const key = 'journals/copilot-tools/dev/test/B/findings/63-u.md';
    store.write(key, '# U\n\n**Status:** active\n**Scope:** repo\n**Consults:** 3\n\n## When to read this\n\nx\n\nupdatetoken original.');
    const res = journals.updateFinding(key, '# U\n\n## When to read this\n\ny\n\nupdatetoken revised content.');
    assert.ok(res.updated);
    const f = journals.getFinding(key);
    assert.ok(f.body.includes('revised content'));
    assert.strictEqual(f.scope, 'repo');     // preserved
    assert.strictEqual(f.consults, 3);       // preserved
    const hist = store.list('journals/copilot-tools/dev/test/B/findings/_history').filter(k => k.indexOf('/63-u-') !== -1);
    assert.ok(hist.length >= 1, 'prior version archived');
});
test('lifecycle tools error cleanly on unknown keys', () => {
    assert.throws(() => journals.retireFinding('journals/nope/findings/99.md'), /not found/);
    assert.throws(() => journals.supersedeFinding('journals/nope/findings/99.md', null), /not found/);
    assert.throws(() => journals.updateFinding('journals/nope/findings/99.md', '# x\n'), /not found/);
});

test('supersede metadata (a finding key with a branch path) does not pollute retrieval', () => {
    // Regression: the Supersedes value is a key containing 'dev/test/...'; the
    // metadata header must be excluded from the BM25 token stream so an unrelated
    // query like the branch name does not match the finding.
    const a = journals.createFinding('dev/test/B', 'copilot-tools', 'Leak A', '# Leak A\n\n## When to read this\n\nx\n\nleakwordone unique.', {});
    const b = journals.createFinding('dev/test/B', 'copilot-tools', 'Leak B', '# Leak B\n\n## When to read this\n\nx\n\nleakwordtwo unique.', {});
    journals.supersedeFinding(a, b);
    const r = journals.findFindings('dev test'); // branch-path tokens
    assert.ok(!r.find(x => x.key === b), 'superseding-key path tokens must not match the branch query');
});
test('a repo-scoped finding is stored under _repo and surfaces from any branch of the repo', () => {
    const key = journals.createFinding(null, 'copilot-tools', 'Repo Convention', '# Repo Convention\n\n## When to read this\n\nx\n\nscopetoken repo-global lesson.', { scope: 'repo' });
    assert.ok(/journals\/copilot-tools\/_repo\/findings\/\d{2}-repo-convention\.md$/.test(key), key);
    const r = journals.findFindings('scopetoken');
    const hit = r.find(x => x.key === key);
    assert.ok(hit && hit.scope === 'repo', 'repo finding surfaces');
});
test('a user-scoped finding is stored under _user and surfaces across repos', () => {
    const key = journals.createFinding(null, null, 'User Habit', '# User Habit\n\n## When to read this\n\nx\n\nusertoken personal lesson.', { scope: 'user' });
    assert.ok(/journals\/_user\/_global\/findings\/\d{2}-user-habit\.md$/.test(key), key);
    const r = journals.findFindings('usertoken', { repo: undefined });
    assert.ok(r.find(x => x.key === key && x.scope === 'user'));
});
test('branch findings rank above repo above user at equal relevance', () => {
    journals.createFinding('dev/test/A', 'copilot-tools', 'Layer Branch', '# Layer Branch\n\n## When to read this\n\nx\n\nlayertoken alpha.', { scope: 'branch' });
    journals.createFinding(null, 'copilot-tools', 'Layer Repo', '# Layer Repo\n\n## When to read this\n\nx\n\nlayertoken alpha.', { scope: 'repo' });
    journals.createFinding(null, null, 'Layer User', '# Layer User\n\n## When to read this\n\nx\n\nlayertoken alpha.', { scope: 'user' });
    const r = journals.findFindings('layertoken');
    const scopes = r.filter(x => x.title && x.title.startsWith('Layer')).map(x => x.scope);
    assert.deepStrictEqual(scopes, ['branch', 'repo', 'user'], JSON.stringify(scopes));
});

// --- P10: curation queue ---
test('listStale returns superseded + cold, with reasons; excludes healthy active', () => {
    journals.createFinding('dev/test/A', 'copilot-tools', 'Healthy', '# Healthy\n\n## When to read this\n\nx\n\nhealthy body', {});
    store.write('journals/copilot-tools/dev/test/A/findings/70-cold.md', '# Cold\n\n**Status:** active\n**Scope:** branch\n**Consults:** 1\n**Last-consulted:** 2026-01-01\n\n## When to read this\n\nx\n\ncold body');
    store.write('journals/copilot-tools/dev/test/A/findings/71-sup.md', '# Sup\n\n**Status:** superseded\n**Scope:** branch\n\n## When to read this\n\nx\n\nsup body');
    const rows = journals.listStale({ repo: 'copilot-tools', nowMs: Date.UTC(2026, 5, 29) });
    const byKey = Object.fromEntries(rows.map(r => [r.key.split('/').pop(), r.reason]));
    assert.strictEqual(byKey['71-sup.md'], 'superseded');
    assert.strictEqual(byKey['70-cold.md'], 'cold');
    assert.ok(!rows.find(r => /healthy/i.test(r.title)), 'healthy active finding excluded by default');
});
test('listStale includeNeverConsulted surfaces never-opened findings', () => {
    const rows = journals.listStale({ repo: 'copilot-tools', nowMs: Date.UTC(2026, 5, 29), includeNeverConsulted: true });
    assert.ok(rows.find(r => /healthy/i.test(r.title) && r.reason === 'never-consulted'));
});

// --- P11: typed links ---
test('linkFinding merges + dedups relates_to, surfaced by getFinding', () => {
    const k = journals.createFinding('dev/test/A', 'copilot-tools', 'Linky', '# Linky\n\n## When to read this\n\nx\n\nlinky body', {});
    journals.linkFinding(k, ['journals/a/b/findings/01.md']);
    journals.linkFinding(k, ['journals/a/b/findings/01.md', 'journals/a/b/plan.md']); // dedup 01
    const f = journals.getFinding(k);
    assert.deepStrictEqual(f.relates_to.sort(), ['journals/a/b/findings/01.md', 'journals/a/b/plan.md']);
    assert.throws(() => journals.linkFinding('journals/nope/findings/9.md', ['x']), /not found/);
});

fs.rmSync(tmp, { recursive: true, force: true });
process.stdout.write(`\nTotal: ${passed + failed}, passed: ${passed}, failed: ${failed}\n`);
process.exit(failed === 0 ? 0 : 1);
