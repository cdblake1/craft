'use strict';

// dispatch.test.js -- the slice-3 gate for the Node hook dispatcher (D1).
//
// Three layers:
//   1. Registry shape -- the footgun guard. Asserts the registry is an explicit
//      ordered map and every handler satisfies the {id, applies, run} contract.
//   2. findings-consult path extraction -- pure logic, unit-tested directly.
//   3. Reality gate -- drives `node dispatch.js <event>` as a real process with a
//      stdin payload against a real git repo + temp CRAFT_DATA_ROOT + temp
//      session-state root, asserting the full sessionStart/postToolUse/sessionEnd
//      behavior end to end (resume block out, inject+consult signal joined, draft
//      seeded, disable flag honored, non-finding path is a no-op).
//
// Run: node dispatch.test.js

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const registry = require('./registry');
const consult = require('./handlers/findings-consult');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); process.stdout.write(`PASS  ${name}\n`); passed++; }
    catch (e) { process.stdout.write(`FAIL  ${name}\n        ${e.message}\n`); failed++; }
}

// === 1. Registry shape: the explicit-order footgun guard ====================

test('registry is an explicit ordered map of events to handler arrays', () => {
    for (const ev of ['sessionStart', 'sessionEnd', 'postToolUse', 'postToolUseFailure']) {
        assert.ok(Array.isArray(registry[ev]), `${ev} should be an array`);
        assert.ok(registry[ev].length >= 1, `${ev} should have at least one handler`);
    }
});

test('every registered handler satisfies the {id, applies, run, event} contract', () => {
    for (const ev of Object.keys(registry)) {
        registry[ev].forEach((h, i) => {
            assert.ok(h && typeof h === 'object', `${ev}[${i}] is an object`);
            assert.strictEqual(typeof h.id, 'string', `${ev}[${i}].id is a string`);
            assert.strictEqual(typeof h.applies, 'function', `${ev}[${i}].applies is a function`);
            assert.strictEqual(typeof h.run, 'function', `${ev}[${i}].run is a function`);
            assert.strictEqual(h.event, ev, `${ev}[${i}].event matches its registration`);
        });
    }
});

test('handler ids are unique within an event (no silent dedup)', () => {
    for (const ev of Object.keys(registry)) {
        const ids = registry[ev].map(h => h.id);
        assert.strictEqual(new Set(ids).size, ids.length, `${ev} has duplicate handler ids`);
    }
});

// === 2. findings-consult path extraction (pure) =============================

test('findings-consult extracts an absolute path from the direct field', () => {
    assert.strictEqual(consult._extractPath({ path: 'C:/u/.copilot/craft-data/journals/r/dev/b/findings/01-a.md' }),
        'C:/u/.copilot/craft-data/journals/r/dev/b/findings/01-a.md');
});

test('findings-consult extracts a path from a nested tool_input', () => {
    const got = consult._extractPath({ tool_input: { file_path: '/home/u/.copilot/craft-data/journals/r/dev/b/findings/01-a.md' } });
    assert.strictEqual(got, '/home/u/.copilot/craft-data/journals/r/dev/b/findings/01-a.md');
});

test('findings-consult ignores a relative (non-absolute) path', () => {
    assert.strictEqual(consult._extractPath({ path: 'findings/01-a.md' }), null);
});

test('findings-consult applies only to file-touching tools', () => {
    assert.strictEqual(consult.applies({ toolName: 'view', path: 'C:/x/journals/r/b/findings/1.md' }, {}), true);
    assert.strictEqual(consult.applies({ toolName: 'bash' }, {}), false);
    assert.strictEqual(consult.applies({}, {}), false);
});

// === 3. Reality gate: drive node dispatch.js as a real process ==============
// The dispatcher is spawned as a real process (proving the stdin -> handlers ->
// merged-output wiring), but git is MOCKED via the CRAFT_GIT_* env seam: the
// handlers resolve repo/branch from env instead of a git subprocess, so no real
// git runs here. Branch/repo resolution itself is covered in context.js.

const DISPATCH = path.join(__dirname, 'dispatch.js');
const BRANCH = 'dev/test/dispatch';
const REPO_KEY = 'testrepo';
const SESSION_ID = 'craft-dispatch-sess';

// --- fixtures (no git: a plain cwd dir + the env seam) ---
const cwdDir = fs.mkdtempSync(path.join(os.tmpdir(), 'craft-disp-cwd-'));
const leaf = `journals/${REPO_KEY}/${BRANCH}`;

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'craft-disp-data-'));
fs.mkdirSync(path.join(dataRoot, leaf, 'findings'), { recursive: true });
fs.writeFileSync(path.join(dataRoot, leaf, 'meta.json'), JSON.stringify({ repo: REPO_KEY, branch: BRANCH }));
fs.writeFileSync(path.join(dataRoot, leaf, 'current-plan.md'),
    '# Plan\n\nBuild the craft Node hook dispatcher with an explicit registry and prove it end to end.\n');
const findingAbs = path.join(dataRoot, leaf, 'findings', '01-dispatch.md');
fs.writeFileSync(findingAbs,
    '# Finding: explicit ordered hook registry beats header-comment scraping\n\n' +
    '## When to read this\n\nWhen wiring a hook dispatcher so two handlers never silently collide.\n\n' +
    'The registry is the array order; the dispatcher merges additionalContext.\n');

const ssRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'craft-disp-ss-'));
const sdir = path.join(ssRoot, SESSION_ID);
fs.mkdirSync(path.join(sdir, 'checkpoints'), { recursive: true });
fs.writeFileSync(path.join(sdir, 'workspace.yaml'), `id: ${SESSION_ID}\nname: Build dispatcher\n`);
fs.writeFileSync(path.join(sdir, 'checkpoints', 'index.md'),
    '# Checkpoint History\n\n| # | Title | File |\n|---|---|---|\n| 1 | Build dispatcher | 001.md |\n');
fs.writeFileSync(path.join(sdir, 'checkpoints', '001.md'),
    '<overview>\nThis session built the craft Node hook dispatcher with an explicit ordered registry, ' +
    'porting the journal hooks as in-process Node handlers under one dispatch entry.\n</overview>\n');

function runDispatch(event, payload, extraEnv) {
    const env = Object.assign({}, process.env, {
        CRAFT_DATA_ROOT: dataRoot,
        COPILOT_FINDINGS_CWD: cwdDir,
        COPILOT_SESSION_ID: SESSION_ID,
        COPILOT_SESSION_STATE_ROOT: ssRoot,
        // Pin the host so the output-envelope shape is deterministic regardless of
        // which host actually runs this suite (the harness may set CLAUDE_* vars).
        // Default to copilot's { additionalContext } shape; Claude is asserted
        // separately below by overriding CRAFT_HOST.
        CRAFT_HOST: 'copilot',
        // mock git resolution: handlers read these instead of spawning git.
        CRAFT_GIT_BRANCH: BRANCH,
        CRAFT_GIT_REPO: REPO_KEY,
        CRAFT_GIT_ROOT: cwdDir,
    }, extraEnv || {});
    return execFileSync('node', [DISPATCH, event], {
        input: JSON.stringify(payload || {}), env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    });
}

function readSignalRows() {
    const p = path.join(dataRoot, 'signal', 'findings-signal.jsonl');
    if (!fs.existsSync(p)) { return []; }
    return fs.readFileSync(p, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
}

test('sessionStart dispatch emits a merged additionalContext envelope with the resume block', () => {
    const out = runDispatch('sessionStart', { session_id: SESSION_ID }, { COPILOT_FINDINGS_MIN_SCORE: '0.01' });
    const env = JSON.parse(out);
    assert.ok(typeof env.additionalContext === 'string', 'output is a JSON additionalContext envelope');
    assert.ok(/Resume context \(journal\)/.test(env.additionalContext), 'resume header present');
    assert.ok(/explicit ordered hook registry/.test(env.additionalContext), 'finding title present');
});

test('sessionStart dispatch under Claude emits a hookSpecificOutput envelope', () => {
    const out = runDispatch('sessionStart', { session_id: SESSION_ID },
        { CRAFT_HOST: 'claude', COPILOT_FINDINGS_MIN_SCORE: '0.01' });
    const env = JSON.parse(out);
    assert.ok(env.hookSpecificOutput, 'output is a Claude hookSpecificOutput envelope');
    assert.strictEqual(env.hookSpecificOutput.hookEventName, 'SessionStart', 'event name is PascalCase');
    assert.ok(typeof env.hookSpecificOutput.additionalContext === 'string', 'additionalContext present');
    assert.ok(/Resume context \(journal\)/.test(env.hookSpecificOutput.additionalContext), 'resume header present');
    assert.strictEqual(env.additionalContext, undefined, 'no top-level Copilot field under Claude');
});

test('sessionStart dispatch logged an inject row for the session', () => {
    const inj = readSignalRows().find(r => r.type === 'inject' && r.sessionId === SESSION_ID);
    assert.ok(inj, 'inject row written');
    assert.ok(inj.paths.some(p => /findings\/01-dispatch\.md$/.test(p)), 'inject row carries the finding key');
});

test('postToolUse dispatch on a finding open logs a consult row (no stdout)', () => {
    const out = runDispatch('postToolUse', { toolName: 'view', path: findingAbs });
    assert.strictEqual(out, '', 'postToolUse emits no additionalContext');
    const con = readSignalRows().find(r => r.type === 'consult' && r.sessionId === SESSION_ID);
    assert.ok(con, 'consult row written');
});

test('postToolUse dispatch on a non-finding path is a no-op', () => {
    const before = readSignalRows().length;
    const out = runDispatch('postToolUse', { toolName: 'view', path: path.join(cwdDir, 'README.md') });
    assert.strictEqual(out, '');
    assert.strictEqual(readSignalRows().length, before, 'no signal row for a non-finding open');
});

test('inject + consult join: the injected finding counts as consulted', () => {
    // signal-report computes the join; assert via computeSignal through the adapter.
    const { createFileStore } = require('../lib/storage');
    const { createSignal } = require('../mcp-servers/journal/signal');
    const s = createSignal(createFileStore({ root: dataRoot }));
    const sig = s.computeSignal({});
    assert.strictEqual(sig.injectSessions, 1, 'one injecting session');
    assert.strictEqual(sig.consultedSessions, 1, 'that session opened an injected finding');
});

test('sessionEnd dispatch seeds a draft from the checkpoint overview', () => {
    runDispatch('sessionEnd', { session_id: SESSION_ID });
    const draftsDir = path.join(dataRoot, leaf, 'findings', '_drafts');
    assert.ok(fs.existsSync(draftsDir), 'drafts dir created');
    const drafts = fs.readdirSync(draftsDir).filter(f => f.endsWith('.md'));
    assert.strictEqual(drafts.length, 1, 'exactly one draft seeded');
    const body = fs.readFileSync(path.join(draftsDir, drafts[0]), 'utf8');
    assert.ok(body.toLowerCase().includes('dispatcher'), 'draft carried the overview');
});

test('a disabled event is a no-op (CRAFT_DISPATCH_SESSIONSTART_DISABLE=1)', () => {
    const out = runDispatch('sessionStart', { session_id: SESSION_ID },
        { COPILOT_FINDINGS_MIN_SCORE: '0.01', CRAFT_DISPATCH_SESSIONSTART_DISABLE: '1' });
    assert.strictEqual(out, '', 'disabled event emits nothing');
});

test('postToolUseFailure + sessionEnd capture deduped failure items (category failure)', () => {
    const { createFileStore } = require('../lib/storage');
    const { createCompose } = require('../mcp-servers/compose/compose');

    // two near-identical failures (paths differ) + one distinct failure
    runDispatch('postToolUseFailure', { tool_name: 'view', error: "ENOENT 'C:/Users/a/1.txt'", exitCode: 1 });
    runDispatch('postToolUseFailure', { tool_name: 'view', error: "ENOENT 'C:/Users/b/2.txt'", exitCode: 1 });
    runDispatch('postToolUseFailure', { tool_name: 'bash', error: 'segfault', exitCode: 139 });

    runDispatch('sessionEnd', { session_id: SESSION_ID });

    const compose = createCompose(createFileStore({ root: dataRoot }));
    const failures = compose.listItems({ status: 'open' }).filter(i => i.category === 'failure');
    assert.strictEqual(failures.length, 2, 'two distinct fingerprints -> two items');
    // captured text must be PII-clean
    for (const f of failures) {
        const blob = f.title + ' ' + (f.notes || '');
        assert.ok(!/Users\/[ab]\//i.test(blob), `failure item leaked a path: ${blob}`);
    }
});

test('a second sessionEnd captures nothing (pending was cleared)', () => {
    const { createFileStore } = require('../lib/storage');
    const { createCompose } = require('../mcp-servers/compose/compose');
    runDispatch('sessionEnd', { session_id: SESSION_ID });
    const compose = createCompose(createFileStore({ root: dataRoot }));
    const failures = compose.listItems().filter(i => i.category === 'failure');
    assert.strictEqual(failures.length, 2, 'no new failure items on a re-run');
});

test('sessionStart merges the journal resume AND the active work composition', () => {
    const { createFileStore } = require('../lib/storage');
    const { createCompose } = require('../mcp-servers/compose/compose');
    // seed an in-flight plan in the same data root; the 2 failure items from the
    // earlier test are still open and should surface for triage.
    const c = createCompose(createFileStore({ root: dataRoot }));
    const p = c.createPlan({ title: 'Active plan X', status: 'in-flight' });
    c.createItem({ title: 'todo one', plan_id: p.id });

    const out = runDispatch('sessionStart', { session_id: SESSION_ID }, { COPILOT_FINDINGS_MIN_SCORE: '0.01' });
    const env = JSON.parse(out);
    // journal resume block (from findings-injector)
    assert.ok(/Resume context \(journal\)/.test(env.additionalContext), 'resume block present');
    // work composition block (from work-tree-injector), merged into one envelope
    assert.ok(/Active work composition/.test(env.additionalContext), 'work-tree block present');
    assert.ok(/Active plan X/.test(env.additionalContext), 'the in-flight plan shows');
    assert.ok(/Failures awaiting triage/.test(env.additionalContext), 'failure triage section present');
});

// Note: the sync-push wiring (sessionEnd -> sync-push) is covered by the sync
// engine's own (git-mocked) tests plus the handler's isEnabled() gate; we do not
// stand up a real remote here, to keep this suite free of git subprocesses.

// --- teardown ---
for (const d of [cwdDir, dataRoot, ssRoot]) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* best effort */ }
}

process.stdout.write(`\nTotal: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
