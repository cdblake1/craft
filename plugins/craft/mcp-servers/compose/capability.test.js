'use strict';

// capability.test.js -- the end-to-end validation gate for the DECOMPOSE
// CAPABILITY (the compose MCP + the decompose discipline it enforces), as opposed
// to the unit suites (function behavior) and fleet-conformance (the bridge
// contract). It drives a full decompose lifecycle through the real MCP dispatch
// and the real model + failure-capture, and asserts the invariants design 0001
// promises the capability upholds. A change that quietly breaks one of these
// (e.g. a roadmap growing a computed health number, the tool surface drifting,
// a failure never surfacing for triage) fails here.
//
// The bar (each test is one invariant):
//   D3  three levels with enforced parents; deterministic count-based roll-up;
//       roadmap health stays NARRATIVE (never a computed number).
//   D4  a small, fixed, described tool surface (no dead-tool sprawl).
//   D6  trigger-based failure capture lands an item that SURFACES for triage and
//       can be triaged away.
//   D7  mode-agnostic: the tools alone build a valid tree, and it PERSISTS across
//       sessions (a second instance over the same store sees the same tree).
//   +   link integrity is reported and orphaned items are never dropped.
//
// Run: node capability.test.js

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createFileStore } = require('../../lib/storage');
const { createCompose } = require('./compose');
const { createServer } = require('./server');
const { createFailureCapture } = require('./failure');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); process.stdout.write(`PASS  ${name}\n`); passed++; }
    catch (e) { process.stdout.write(`FAIL  ${name}\n        ${e.message}\n`); failed++; }
}

// A fresh capability environment: a store, the model over it, and the MCP server
// over the same model -- so a test can drive tools and inspect the model.
function env() {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'craft-capability-'));
    const store = createFileStore({ root: tmp });
    const compose = createCompose(store);
    const server = createServer(compose);
    let nextId = 1;
    function call(name, args) {
        return server.handleRequest({ jsonrpc: '2.0', id: nextId++, method: 'tools/call', params: { name, arguments: args || {} } }).result;
    }
    function sc(name, args) { return call(name, args).structuredContent; }
    return { tmp, store, compose, server, call, sc };
}

// Build a realistic two-level decomposition through the TOOLS only (no model
// shortcuts), the way an agent or a fleet worker would: roadmap -> plan -> items.
function decomposeThroughTools(e) {
    const roadmap = e.sc('compose_roadmap', { title: 'Ship the widget service', body: 'On track. Wedge: zero-config.' });
    const plan = e.sc('compose_plan', { title: 'Core CRUD', parent_id: roadmap.id, body: 'Spec: create/read/update/delete widgets. Architecture: store behind IWidgetStore.' });
    const a = e.sc('compose_capture', { title: 'widget store', plan_id: plan.id, category: 'feature', severity: 'high', next_action: 'Implement IWidgetStore add+get. DoD: unit tests green.' });
    const b = e.sc('compose_capture', { title: 'widget read API', plan_id: plan.id, category: 'feature', severity: 'medium', next_action: 'Expose GET /widgets. DoD: returns seeded data.' });
    return { roadmap, plan, a, b };
}

// === D4: a small, fixed, described tool surface =============================

test('D4: the tool surface is exactly the documented set, each described', () => {
    const e = env();
    const r = e.server.handleRequest({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    const names = r.result.tools.map(t => t.name).sort();
    const expected = ['compose_capture', 'compose_link', 'compose_plan', 'compose_rollup', 'compose_roadmap', 'compose_status', 'compose_tree', 'compose_update'].sort();
    assert.deepStrictEqual(names, expected, 'tool surface drifted from the documented set');
    for (const t of r.result.tools) {
        assert.ok(typeof t.description === 'string' && t.description.length > 0, `${t.name} has a description`);
        assert.ok(t.inputSchema && t.inputSchema.type === 'object', `${t.name} has an object input schema`);
    }
});

// === D3: three levels, enforced parents =====================================

test('D3: three levels with enforced parent links (item->plan, plan->roadmap only)', () => {
    const e = env();
    const { roadmap, plan, a } = decomposeThroughTools(e);
    // valid links already made via parent_id/plan_id; now assert the level rules
    const badItemToRoadmap = e.call('compose_link', { child_id: a.id, parent_id: roadmap.id });
    assert.ok(badItemToRoadmap.isError && /item can only link to a plan/.test(badItemToRoadmap.content[0].text));
    const plan2 = e.sc('compose_plan', { title: 'p2' });
    const badPlanToPlan = e.call('compose_link', { child_id: plan2.id, parent_id: plan.id });
    assert.ok(badPlanToPlan.isError && /plan can only link to a roadmap/.test(badPlanToPlan.content[0].text));
});

// === D3: deterministic roll-up ==============================================

test('D3: roll-up is deterministic shipped/(non-dropped), persisted and repeatable', () => {
    const e = env();
    const { plan, a, b } = decomposeThroughTools(e);
    e.sc('compose_status', { id: a.id, status: 'shipped' });
    const first = e.sc('compose_rollup', { plan_id: plan.id });
    const second = e.sc('compose_rollup', { plan_id: plan.id });
    assert.strictEqual(first.rolled_up[0].completion_pct, 50, '1 of 2 shipped');
    assert.deepStrictEqual(first.rolled_up, second.rolled_up, 'same input -> same number');
    assert.strictEqual(e.compose.getPlan(plan.id).completion_pct, 50, 'persisted to the doc');
    e.sc('compose_status', { id: b.id, status: 'dropped' });   // dropped leaves the denominator
    assert.strictEqual(e.sc('compose_rollup', { plan_id: plan.id }).rolled_up[0].completion_pct, 100, '1 of 1 non-dropped');
});

// === D3: roadmap health stays narrative =====================================

test('D3: a roadmap never carries a computed completion number (narrative health)', () => {
    const e = env();
    const { roadmap } = decomposeThroughTools(e);
    const rn = e.sc('compose_tree', {}).roadmaps.find(r => r.id === roadmap.id);
    assert.ok(!('completion_pct' in rn), 'roadmap must not have a computed completion_pct');
    assert.ok(e.compose.getRoadmap(roadmap.id).body.length > 0, 'health lives in the narrative body');
});

// === D6: failure capture surfaces for triage ================================

test('D6: a captured failure becomes an item that surfaces for triage and can be triaged away', () => {
    const e = env();
    const fc = createFailureCapture({ store: e.store, compose: e.compose });
    const sessionId = 'sess-capability-1';
    fc.recordFailure({ sessionId, tool: 'bash', error: "ENOENT: no such file 'x'", exitCode: 1 });
    fc.recordFailure({ sessionId, tool: 'bash', error: "ENOENT: no such file 'y'", exitCode: 1 });
    const res = fc.captureSession({ sessionId });
    assert.ok(res.captured >= 1, 'at least one failure item captured');
    const failures = e.compose.listItems({ status: 'open' }).filter(i => i.category === 'failure');
    assert.ok(failures.length >= 1, 'failure item exists in the open backlog');
    // it surfaces in the session-start work-tree injection (the triage nudge)
    const inj = e.compose.buildWorkTreeInjection({});
    assert.ok(inj && /Failures awaiting triage/.test(inj.text), 'failure surfaces for triage');
    // triaging every open failure away clears it from the surface
    for (const f of failures) { e.sc('compose_status', { id: f.id, status: 'dropped' }); }
    const after = e.compose.buildWorkTreeInjection({});
    assert.ok(!after || !/Failures awaiting triage/.test(after.text), 'triaged failures no longer surface');
});

// === D7: mode-agnostic + cross-session persistence ==========================

test('D7: tools alone build a valid tree that persists across sessions (new instance, same store)', () => {
    const e = env();
    const { roadmap, plan, a } = decomposeThroughTools(e);
    e.sc('compose_status', { id: a.id, status: 'shipped' });

    // A second "session": a brand-new model+server over the SAME store must see
    // the same tree -- the capability is session-driven and adapter-persisted.
    const compose2 = createCompose(createFileStore({ root: e.tmp }));
    const t = compose2.tree();
    const rn = t.roadmaps.find(r => r.id === roadmap.id);
    assert.ok(rn, 'roadmap persisted');
    const pn = rn.plans.find(p => p.id === plan.id);
    assert.ok(pn, 'plan persisted under its roadmap');
    assert.strictEqual(pn.completion_pct, 50, 'item status persisted (1 of 2 shipped)');
    assert.ok(pn.items.find(i => i.id === a.id && i.status === 'shipped'), 'shipped item persisted');
});

// === link integrity: reported, and orphans never dropped ====================

test('link integrity: a dangling item link is reported and the orphan still appears in the tree', () => {
    const e = env();
    decomposeThroughTools(e);
    const orphan = e.sc('compose_capture', { title: 'orphan', plan_id: 'GHOSTPLAN0000000000000000', next_action: 'x' });
    const report = e.sc('compose_rollup', {});
    assert.ok((report.integrity || []).some(b => b.id === orphan.id && b.dangling_ref === 'GHOSTPLAN0000000000000000'), 'broken link reported by rollup');
    const t = e.sc('compose_tree', {});
    assert.ok((t.orphanedItems || []).some(i => i.id === orphan.id), 'orphan surfaced in the tree, not dropped');
});

process.stdout.write(`\nTotal: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
