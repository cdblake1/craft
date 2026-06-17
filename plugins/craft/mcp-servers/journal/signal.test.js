'use strict';

// signal.test.js -- injected-and-consulted signal, ported onto the adapter.
// Run: node signal.test.js

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createFileStore } = require('../../lib/storage');
const { createSignal, isFindingPath } = require('./signal');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); process.stdout.write(`PASS  ${name}\n`); passed++; }
    catch (e) { process.stdout.write(`FAIL  ${name}\n        ${e.message}\n`); failed++; }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'craft-signal-'));
const store = createFileStore({ root: tmp });
const signal = createSignal(store);

test('isFindingPath matches promoted findings, not drafts or other files', () => {
    assert.strictEqual(isFindingPath('C:/u/.copilot/craft-data/journals/r/dev/b/findings/01-a.md'), true);
    assert.strictEqual(isFindingPath('C:/u/.copilot/craft-data/journals/r/dev/b/findings/_drafts/01-a.md'), false);
    assert.strictEqual(isFindingPath('C:/u/.copilot/craft-data/journals/r/dev/b/current-plan.md'), false);
    assert.strictEqual(isFindingPath('C:/some/other/findings/01-a.md'), false);
    assert.strictEqual(isFindingPath('C:/u/.copilot/craft-data/journals/r/dev/b/findings/01-a.txt'), false);
});

test('computeSignal joins inject + consult by session', () => {
    const F1 = 'journals/r/dev/b/findings/01-a.md';
    const F2 = 'journals/r/dev/b/findings/02-b.md';
    const F3 = 'journals/r/dev/b/findings/03-c.md';
    signal.logInjection({ sessionId: 's1', branch: 'dev/b', repo: 'r', paths: [F1, F2] });
    signal.logConsult({ sessionId: 's1', path: F1 });
    signal.logInjection({ sessionId: 's2', branch: 'dev/b', repo: 'r', paths: [F3] });
    const s = signal.computeSignal();
    assert.strictEqual(s.injectSessions, 2);
    assert.strictEqual(s.consultedSessions, 1);
    assert.strictEqual(s.injectedFindings, 3);
    assert.strictEqual(s.consultedFindings, 1);
    assert.ok(Math.abs(s.sessionConsultRate - 0.5) < 1e-9);
});

test('consult by absolute path matches an injection by logical key (canonical join)', () => {
    // s3 injects the logical key; the agent opens it via its ABSOLUTE path.
    const key = 'journals/r/dev/c/findings/01-x.md';
    const abs = 'C:/Users/x/.copilot/craft-data/journals/r/dev/c/findings/01-x.md';
    signal.logInjection({ sessionId: 's3', branch: 'dev/c', repo: 'r', paths: [key] });
    signal.logConsult({ sessionId: 's3', path: abs });
    const s = signal.computeSignal();
    // s3 contributes one injected + one consulted finding on top of the prior s1/s2.
    assert.strictEqual(s.injectSessions, 3);
    assert.strictEqual(s.consultedSessions, 2); // s1 and s3
    assert.strictEqual(s.consultedFindings, 2); // F1 and the canonical-joined x
});

test('computeSignal ignores a consult that was never injected this session', () => {
    signal.logConsult({ sessionId: 's2', path: 'journals/r/dev/b/findings/99-never.md' });
    const s = signal.computeSignal();
    assert.strictEqual(s.consultedSessions, 2); // unchanged; s2 opened a non-injected finding
});

fs.rmSync(tmp, { recursive: true, force: true });
process.stdout.write(`\nTotal: ${passed + failed}, passed: ${passed}, failed: ${failed}\n`);
process.exit(failed === 0 ? 0 : 1);
