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

fs.rmSync(tmp, { recursive: true, force: true });
process.stdout.write(`\nTotal: ${passed + failed}, passed: ${passed}, failed: ${failed}\n`);
process.exit(failed === 0 ? 0 : 1);
