'use strict';

// resume.test.js -- session-state reader (host store) + resume composition,
// ported onto the journal instance API. Run: node resume.test.js

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createFileStore } = require('../../lib/storage');
const { createJournals } = require('./journals');
const sessionState = require('./sessionState');
const { createResume } = require('./resume');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); process.stdout.write(`PASS  ${name}\n`); passed++; }
    catch (e) { process.stdout.write(`FAIL  ${name}\n        ${e.message}\n`); failed++; }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'craft-resume-'));
const ssRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'craft-resume-ss-'));
process.env.COPILOT_SESSION_STATE_ROOT = ssRoot;

const store = createFileStore({ root: tmp });
const journals = createJournals(store);
const resume = createResume({ journals, sessionState });

// Journal fixture: branch dev/test/A with a real plan + the atomic finding.
store.write('journals/repo/dev/test/A/meta.json', JSON.stringify({ repo: 'repo', branch: 'dev/test/A' }));
store.write('journals/repo/dev/test/A/current-plan.md', '# Plan\n\nBuilding the atomic claim layer with kernel exclusion across sessions; BM25 retrieval.');
store.write('journals/repo/dev/test/A/findings/01-atomic.md', '# Finding: atomic kernel-level exclusion\n\n## When to read this\n\nBuilding any new claim layer.\n\nUse O_EXCL kernel exclusion.');

// Session-state fixture: a prior checkpointed session matching the git_root.
const GR = '/tmp/fake/repoX';
function writeSession(id, ws, checkpoints) {
    const dir = path.join(ssRoot, id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'workspace.yaml'), Object.keys(ws).map(k => `${k}: ${ws[k]}`).join('\n') + '\n');
    if (checkpoints && checkpoints.length) {
        const cp = path.join(dir, 'checkpoints');
        fs.mkdirSync(cp, { recursive: true });
        const rows = ['# Checkpoint History', '', '| # | Title | File |', '|---|---|---|'];
        for (const c of checkpoints) { rows.push(`| ${c.num} | ${c.title} | ${c.file} |`); fs.writeFileSync(path.join(cp, c.file), c.body); }
        fs.writeFileSync(path.join(cp, 'index.md'), rows.join('\n') + '\n');
    }
}
writeSession('prev', {
    id: 'prev', cwd: GR, git_root: GR, repository: 'repo', branch: 'dev/test/A',
    name: 'Prev session', updated_at: '2026-06-14T00:00:00.000Z',
}, [{ num: 1, title: 'Newest work', file: '001.md', body: '<overview>\nbuilding the atomic claim layer with kernel exclusion as the cross-session primitive.\n</overview>' }]);

test('sessionState.findLastSession matches git_root and excludes the current session', () => {
    const last = sessionState.findLastSession({ gitRoot: GR, excludeSessionId: 'CURRENT' });
    assert.ok(last && last.sessionId === 'prev');
});

test('buildResumeInjection layers recap + current-plan + prior findings', () => {
    const inj = resume.buildResumeInjection({
        branch: 'dev/test/A', repo: 'repo', gitRoot: GR, excludeSessionId: 'CURRENT', minScore: 0.1,
    });
    assert.ok(inj);
    assert.ok(inj.text.includes('Where we left off'));
    assert.ok(inj.text.includes('Newest work'));
    assert.ok(inj.text.includes('Current plan (this branch)'));
    assert.ok(inj.text.toLowerCase().includes('prior findings'));
    assert.ok(inj.text.toLowerCase().includes('atomic'));
    assert.deepStrictEqual(inj.sections, ['recap', 'plan', 'findings']);
    assert.ok(inj.findings.length >= 1 && inj.findings[0].key);
});

test('buildResumeInjection returns null when nothing is available', () => {
    const inj = resume.buildResumeInjection({
        branch: 'dev/test/none', repo: 'repo', gitRoot: '/no/such/repo', excludeSessionId: 'x', minScore: 0.1,
    });
    assert.strictEqual(inj, null);
});

delete process.env.COPILOT_SESSION_STATE_ROOT;
fs.rmSync(tmp, { recursive: true, force: true });
fs.rmSync(ssRoot, { recursive: true, force: true });
process.stdout.write(`\nTotal: ${passed + failed}, passed: ${passed}, failed: ${failed}\n`);
process.exit(failed === 0 ? 0 : 1);
