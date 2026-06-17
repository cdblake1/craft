'use strict';

// server.test.js -- journal MCP JSON-RPC dispatch, ported onto the adapter.
// Run: node server.test.js
//
// Drives handleRequest directly with an injected fixture-backed journals
// instance. The live stdio path (real `node server.js` over JSON-RPC) is the
// reality gate, exercised separately by Test-CraftJournalMcpStdio.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createFileStore } = require('../../lib/storage');
const { createJournals } = require('./journals');
const { createServer } = require('./server');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); process.stdout.write(`PASS  ${name}\n`); passed++; }
    catch (e) { process.stdout.write(`FAIL  ${name}\n        ${e.message}\n`); failed++; }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'craft-server-'));
const store = createFileStore({ root: tmp });
const journals = createJournals(store);
const server = createServer(journals);
const call = (name, args) => server.handleRequest({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });

store.write('journals/repo/dev/test/A/meta.json', JSON.stringify({ repo: 'repo', branch: 'dev/test/A' }));
store.write('journals/repo/dev/test/A/current-plan.md', '# Plan\n\nBranch A plan, active.');
store.write('journals/repo/dev/test/A/findings/01-atomic.md', '# Finding: atomic kernel-level exclusion\n\n## When to read this\n\nClaim layer.\n\nUse O_EXCL.');

test('initialize returns server info', () => {
    const r = server.handleRequest({ jsonrpc: '2.0', id: 1, method: 'initialize' });
    assert.strictEqual(r.result.serverInfo.name, 'craft-journal');
    assert.strictEqual(r.result.protocolVersion, '2024-11-05');
});

test('tools/list returns the 9 journal tools', () => {
    const r = server.handleRequest({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    assert.strictEqual(r.result.tools.length, 9);
    const names = r.result.tools.map(t => t.name).sort();
    assert.deepStrictEqual(names, [
        'journal_append_step_log', 'journal_branch_status', 'journal_create_finding',
        'journal_find_findings', 'journal_get', 'journal_get_finding', 'journal_list',
        'journal_recent', 'journal_update_current_plan',
    ]);
});

test('journal_find_findings description nudges call-first + ranking', () => {
    const r = server.handleRequest({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    const t = r.result.tools.find(x => x.name === 'journal_find_findings');
    assert.ok(/first/i.test(t.description) && /rank/i.test(t.description));
});

test('journal_list returns the journal', () => {
    const r = call('journal_list', {});
    assert.ok(!r.result.isError);
    assert.strictEqual(r.result.structuredContent.count, 1);
});

test('journal_find_findings happy path', () => {
    const r = call('journal_find_findings', { query: 'atomic' });
    assert.ok(r.result.structuredContent.count >= 1);
});

test('journal_find_findings missing query returns isError', () => {
    assert.ok(call('journal_find_findings', {}).result.isError);
});

test('journal_get_finding reads back by key', () => {
    const key = call('journal_find_findings', { query: 'atomic' }).result.structuredContent.findings[0].key;
    const r = call('journal_get_finding', { path: key });
    assert.ok(r.result.structuredContent.body && r.result.structuredContent.title);
});

test('journal_create_finding creates + warns on near-duplicate title', () => {
    const ok = call('journal_create_finding', { branch: 'dev/test/A', repo: 'repo', title: 'Fresh One', body: '# Fresh One\n\n## When to read this\n\nx.\n\nbody' });
    assert.ok(!ok.result.isError && ok.result.structuredContent.success);
    const dup = call('journal_create_finding', { branch: 'dev/test/A', repo: 'repo', title: 'Finding: atomic kernel-level exclusion', body: '# Dup\n\n## When to read this\n\nx.\n\nb' });
    assert.ok(dup.result.structuredContent.duplicate_warning);
    assert.ok(dup.result.content[0].text.includes('Possible duplicate'));
});

test('journal_create_finding without body returns isError', () => {
    assert.ok(call('journal_create_finding', { branch: 'dev/test/A', repo: 'repo', title: 'No body' }).result.isError);
});

test('journal_append_step_log + update_current_plan via MCP', () => {
    assert.ok(call('journal_append_step_log', { branch: 'dev/test/A', repo: 'repo', content: 'note' }).result.structuredContent.success);
    const up = call('journal_update_current_plan', { branch: 'dev/test/A', repo: 'repo', content: '# New\n\nbody' });
    assert.ok(!up.result.isError);
});

test('unknown tool + unknown method', () => {
    assert.ok(call('journal_nope', {}).result.isError);
    const m = server.handleRequest({ jsonrpc: '2.0', id: 1, method: 'not_a_method' });
    assert.strictEqual(m.error.code, -32601);
});

fs.rmSync(tmp, { recursive: true, force: true });
process.stdout.write(`\nTotal: ${passed + failed}, passed: ${passed}, failed: ${failed}\n`);
process.exit(failed === 0 ? 0 : 1);
