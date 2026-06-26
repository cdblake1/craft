'use strict';

// fleet-conformance.test.js -- locks the contract between craft's app-decompose
// output and the orchestrator bridge (cdblake1/orchestrator, bridge/). The bridge
// selects a compose leaf as a dispatchable WorkItem iff it is:
//   1. status == "open"
//   2. has a parent plan_id
//   3. carries a non-empty next_action
// and maps severity->value, category->kind, ULID->external_id, and assembles the
// prompt from the parent plan body + item title + notes + next_action.
//
// This test builds a sample app-decompose-style tree through the REAL compose
// model and asserts the leaves are bridge-ready, so a future compose change that
// would silently break the bridge fails here instead. It encodes the bridge's
// public ready-leaf predicate (from bridge/README.md) as the oracle; it does not
// import any orchestrator code (the two stay decoupled).
//
// Run: node fleet-conformance.test.js

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createFileStore } = require('../../lib/storage');
const { createCompose } = require('./compose');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); process.stdout.write(`PASS  ${name}\n`); passed++; }
    catch (e) { process.stdout.write(`FAIL  ${name}\n        ${e.message}\n`); failed++; }
}

function fresh() {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'craft-fleet-conf-'));
    return createCompose(createFileStore({ root: tmp }));
}

// --- the bridge's public ready-leaf predicate (bridge/README.md), encoded here
// as the oracle. No orchestrator import: the predicate is the decoupled contract.
function isBridgeReady(item) {
    return !!item
        && item.status === 'open'
        && typeof item.plan_id === 'string' && item.plan_id.length > 0
        && typeof item.next_action === 'string' && item.next_action.trim().length > 0;
}

// the bridge's severity->value map (bridge/README.md). info=5 default for unknown.
const SEVERITY_VALUE = { high: 30, medium: 20, low: 10, info: 5 };
function severityToValue(sev) {
    return Object.prototype.hasOwnProperty.call(SEVERITY_VALUE, sev) ? SEVERITY_VALUE[sev] : 10;
}

// Build a small app-decompose-style tree: a roadmap, a plan with shared context in
// its body, and two waves of leaf items (wave 1 open, wave 2 parked until wave 1
// ships), exactly as the app-decompose Stage 5 wave rule prescribes.
function sampleTree(c) {
    const roadmap = c.createRoadmap({ title: 'Build the expense tracker', body: 'On track. v1 wedge: offline-first.' });
    const plan = c.createPlan({
        parent_id: roadmap.id,
        title: 'Capture and list expenses',
        body: 'Spec: F1 add expense, F2 list expenses. Architecture: local SQLite store + WPF list view. '
            + 'Delivers the core capture loop.',
    });
    // wave 1: ready now (riskiest first)
    const w1a = c.createItem({
        plan_id: plan.id, title: 'Local expense store (SQLite)', category: 'feature', severity: 'high',
        status: 'open',
        next_action: 'Implement the local SQLite expense store with add+query, behind IExpenseStore. '
            + 'Done when F1/F2 unit tests are green. Traces to spec F1, F2.',
        notes: 'See spec section F1/F2; architecture: store boundary.',
    });
    const w1b = c.createItem({
        plan_id: plan.id, title: 'Expense list view (WPF)', category: 'feature', severity: 'medium',
        status: 'open',
        next_action: 'Build the WPF list surface bound to IExpenseStore, keyboard-navigable. '
            + 'Done when the list renders seeded data. Traces to UX screen "List".',
        notes: 'UX surface: List screen; design tokens from the design spec.',
    });
    // wave 2: depends on wave 1, parked until predecessors ship
    const w2 = c.createItem({
        plan_id: plan.id, title: 'Add-expense form wired to the store', category: 'feature', severity: 'medium',
        status: 'parked',
        next_action: 'Wire the add-expense form to IExpenseStore and refresh the list. Traces to spec F1, UX "Add".',
        notes: 'Depends on the store + list view (wave 1).',
    });
    return { roadmap, plan, w1a, w1b, w2 };
}

// === conformance ============================================================

test('wave-1 leaves are bridge-ready (status open + plan_id + next_action)', () => {
    const c = fresh();
    const { plan, w1a, w1b } = sampleTree(c);
    for (const leaf of [w1a, w1b]) {
        const got = c.getItem(leaf.id);
        assert.ok(isBridgeReady(got), `${got.title} should be bridge-ready`);
        assert.strictEqual(got.plan_id, plan.id, 'leaf links to its plan');
    }
});

test('a parked wave-2 leaf is NOT bridge-ready (held until predecessors ship)', () => {
    const c = fresh();
    const { w2 } = sampleTree(c);
    assert.ok(!isBridgeReady(c.getItem(w2.id)), 'parked dependent must not dispatch early');
});

test('promoting wave 2 to open after wave 1 ships makes it bridge-ready', () => {
    const c = fresh();
    const { w1a, w1b, w2 } = sampleTree(c);
    // wave 1 ships
    c.updateItemStatus(w1a.id, 'shipped');
    c.updateItemStatus(w1b.id, 'shipped');
    assert.ok(!isBridgeReady(c.getItem(w2.id)), 'still parked before promotion');
    // drive stage promotes the next wave
    c.updateItemStatus(w2.id, 'open');
    assert.ok(isBridgeReady(c.getItem(w2.id)), 'promoted leaf is now dispatchable');
});

test('every bridge-ready leaf has a severity that maps to a positive value', () => {
    const c = fresh();
    const { w1a, w1b } = sampleTree(c);
    for (const leaf of [w1a, w1b]) {
        const got = c.getItem(leaf.id);
        assert.ok(severityToValue(got.severity) > 0, `${got.title} severity maps to a value`);
    }
});

test('every bridge-ready leaf carries a category (mapped to the WorkItem kind)', () => {
    const c = fresh();
    const { w1a, w1b } = sampleTree(c);
    for (const leaf of [w1a, w1b]) {
        assert.ok(c.getItem(leaf.id).category, 'category present for kind mapping');
    }
});

test('the parent plan body carries the shared context the bridge folds into the prompt', () => {
    const c = fresh();
    const { plan } = sampleTree(c);
    const got = c.getPlan(plan.id);
    assert.ok(got.body && got.body.trim().length > 0, 'plan body is non-empty');
    assert.ok(/Spec:|Architecture:/i.test(got.body), 'plan body carries spec/architecture context');
});

test('a leaf with an empty next_action is correctly NOT bridge-ready (vague work order guard)', () => {
    const c = fresh();
    const roadmap = c.createRoadmap({ title: 'r' });
    const plan = c.createPlan({ parent_id: roadmap.id, title: 'p', body: 'x' });
    const bad = c.createItem({ plan_id: plan.id, title: 'no task', category: 'feature', status: 'open' });
    assert.ok(!isBridgeReady(c.getItem(bad.id)), 'open + plan_id but no next_action is not ready');
});

test('an orphan leaf (no plan_id) is NOT bridge-ready', () => {
    const c = fresh();
    const orphan = c.createItem({ title: 'orphan', category: 'feature', status: 'open', next_action: 'do it' });
    assert.ok(!isBridgeReady(c.getItem(orphan.id)), 'a leaf with no parent plan must not dispatch');
});

process.stdout.write(`\nTotal: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
