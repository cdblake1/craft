'use strict';

// compose.test.js -- the work-composition node model on the adapter.
// Run: node compose.test.js

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
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'craft-compose-'));
    return createCompose(createFileStore({ root: tmp }));
}

// === ULIDs + creation =======================================================

test('createItem returns a ULID-id node and persists it', () => {
    const c = fresh();
    const it = c.createItem({ title: 'Fix the flaky test', category: 'bug' });
    assert.strictEqual(it.id.length, 26);
    assert.strictEqual(it.type, 'item');
    assert.strictEqual(it.status, 'open');
    assert.strictEqual(it.category, 'bug');
    const got = c.getItem(it.id);
    assert.strictEqual(got.title, 'Fix the flaky test');
});

test('createItem rejects an empty title and an invalid category', () => {
    const c = fresh();
    assert.throws(() => c.createItem({ title: '   ' }), /title is required/);
    assert.throws(() => c.createItem({ title: 'x', category: 'nope' }), /invalid category/);
});

test('item status updates replay onto the resolved view', () => {
    const c = fresh();
    const it = c.createItem({ title: 'Ship the adapter' });
    c.updateItemStatus(it.id, 'in-flight');
    c.updateItemStatus(it.id, 'shipped', { notes: 'done in slice 1' });
    const got = c.getItem(it.id);
    assert.strictEqual(got.status, 'shipped');
    assert.strictEqual(got.notes, 'done in slice 1');
    // immutable create fields survive the overlay
    assert.strictEqual(got.title, 'Ship the adapter');
});

test('updateItemStatus rejects an unknown status and an unknown id', () => {
    const c = fresh();
    const it = c.createItem({ title: 'x' });
    assert.throws(() => c.updateItemStatus(it.id, 'bogus'), /invalid status/);
    assert.throws(() => c.updateItemStatus('NOPE', 'shipped'), /no such item/);
});

test('updateItem edits content fields in place, preserving status and links', () => {
    const c = fresh();
    const p = c.createPlan({ title: 'plan' });
    const it = c.createItem({ title: 'orig', plan_id: p.id, severity: 'low', category: 'idea' });
    c.updateItemStatus(it.id, 'in-flight');
    c.updateItem(it.id, { title: 'edited', severity: 'high', category: 'bug', next_action: 'go' });
    const got = c.getItem(it.id);
    assert.strictEqual(got.title, 'edited');
    assert.strictEqual(got.severity, 'high');
    assert.strictEqual(got.category, 'bug');
    assert.strictEqual(got.next_action, 'go');
    assert.strictEqual(got.status, 'in-flight');   // status untouched
    assert.strictEqual(got.plan_id, p.id);          // link untouched
    assert.throws(() => c.updateItem(it.id, { severity: 'nope' }), /invalid severity/);
    assert.throws(() => c.updateItem(it.id, {}), /no editable item fields/);
});

test('updatePlanFields and updateRoadmapFields edit title/body in place', () => {
    const c = fresh();
    const r = c.createRoadmap({ title: 'road', body: 'old health' });
    const p = c.createPlan({ title: 'plan', parent_id: r.id, body: 'old body' });
    c.updatePlanFields(p.id, { title: 'plan v2', body: 'new body' });
    c.updateRoadmapFields(r.id, { body: 'new health' });
    const gp = c.getPlan(p.id);
    assert.strictEqual(gp.title, 'plan v2');
    assert.strictEqual(gp.body.trim(), 'new body');
    assert.strictEqual(gp.parent_id, r.id);          // link untouched
    assert.strictEqual(gp.completion_pct, 0);         // preserved
    assert.strictEqual(c.getRoadmap(r.id).body.trim(), 'new health');
    assert.strictEqual(c.getRoadmap(r.id).title, 'road');   // untouched field stays
    assert.throws(() => c.updatePlanFields('NOPE', { title: 'x' }), /no such plan/);
});

test('listItems filters by status and by plan_id', () => {
    const c = fresh();
    const p = c.createPlan({ title: 'A plan' });
    const a = c.createItem({ title: 'a', plan_id: p.id });
    c.createItem({ title: 'b' });
    c.updateItemStatus(a.id, 'shipped');
    assert.strictEqual(c.listItems({ status: 'shipped' }).length, 1);
    assert.strictEqual(c.listItems({ plan_id: p.id }).length, 1);
    assert.strictEqual(c.listItems({ plan_id: null }).length, 1);
    assert.strictEqual(c.listItems().length, 2);
});

// === plans / roadmaps (frontmatter docs) ====================================

test('createPlan writes a frontmatter doc with completion_pct 0', () => {
    const c = fresh();
    const p = c.createPlan({ title: 'Build compose', body: 'Do the thing.' });
    assert.strictEqual(p.type, 'plan');
    assert.strictEqual(p.completion_pct, 0);
    const got = c.getPlan(p.id);
    assert.strictEqual(got.title, 'Build compose');
    assert.strictEqual(got.body.trim(), 'Do the thing.');
    assert.strictEqual(got.parent_id, null);
});

test('createRoadmap writes a roadmap doc; status updates persist', () => {
    const c = fresh();
    const r = c.createRoadmap({ title: 'H2 platform', body: 'Health: green.' });
    assert.strictEqual(r.type, 'roadmap');
    c.updateRoadmapStatus(r.id, 'in-flight');
    assert.strictEqual(c.getRoadmap(r.id).status, 'in-flight');
    assert.ok(c.getRoadmap(r.id).body.includes('Health: green.'));
});

test('plan/roadmap reject triage-only statuses (evaluated is item-only)', () => {
    const c = fresh();
    const p = c.createPlan({ title: 'p' });
    assert.throws(() => c.updatePlanStatus(p.id, 'evaluated'), /invalid status/);
});

test('listPlans filters by parent roadmap; listRoadmaps lists roots', () => {
    const c = fresh();
    const r = c.createRoadmap({ title: 'road' });
    const p1 = c.createPlan({ title: 'p1', parent_id: r.id });
    c.createPlan({ title: 'p2' });
    assert.strictEqual(c.listRoadmaps().length, 1);
    assert.strictEqual(c.listPlans({ parent_id: r.id }).length, 1);
    assert.strictEqual(c.listPlans({ parent_id: null }).length, 1);
    assert.strictEqual(c.getPlan(p1.id).parent_id, r.id);
});

test('createPlan rejects a non-existent parent roadmap', () => {
    const c = fresh();
    assert.throws(() => c.createPlan({ title: 'p', parent_id: 'NOSUCH' }), /no such roadmap/);
});

// === linking (the level rules) ==============================================

test('link enforces item->plan and plan->roadmap, rejecting bad levels', () => {
    const c = fresh();
    const r = c.createRoadmap({ title: 'r' });
    const p = c.createPlan({ title: 'p' });
    const it = c.createItem({ title: 'i' });

    c.link(it.id, p.id);
    assert.strictEqual(c.getItem(it.id).plan_id, p.id);

    c.link(p.id, r.id);
    assert.strictEqual(c.getPlan(p.id).parent_id, r.id);

    // an item cannot link to a roadmap; a plan cannot link to a plan
    assert.throws(() => c.link(it.id, r.id), /item can only link to a plan/);
    assert.throws(() => c.link(p.id, p.id), /plan can only link to a roadmap/);
});

test('getNode resolves any node type by id', () => {
    const c = fresh();
    const r = c.createRoadmap({ title: 'r' });
    const p = c.createPlan({ title: 'p' });
    const it = c.createItem({ title: 'i' });
    assert.strictEqual(c.getNode(r.id).type, 'roadmap');
    assert.strictEqual(c.getNode(p.id).type, 'plan');
    assert.strictEqual(c.getNode(it.id).type, 'item');
    assert.strictEqual(c.getNode('NOPE'), null);
});

// === roll-up + tree =========================================================

test('computePlanCompletion is shipped / (countable), dropped excluded', () => {
    const c = fresh();
    const p = c.createPlan({ title: 'p' });
    const ids = ['a', 'b', 'c', 'd'].map(t => c.createItem({ title: t, plan_id: p.id }).id);
    assert.strictEqual(c.computePlanCompletion(p.id), 0);          // 0/4
    c.updateItemStatus(ids[0], 'shipped');
    c.updateItemStatus(ids[1], 'shipped');
    assert.strictEqual(c.computePlanCompletion(p.id), 50);         // 2/4
    c.updateItemStatus(ids[2], 'dropped');                          // excluded
    assert.strictEqual(c.computePlanCompletion(p.id), 67);         // 2/3 -> 67
    assert.strictEqual(c.computePlanCompletion('NOPE'), 0);
});

test('rollupPlan persists the computed completion_pct to the doc', () => {
    const c = fresh();
    const p = c.createPlan({ title: 'p' });
    const it = c.createItem({ title: 'a', plan_id: p.id });
    c.updateItemStatus(it.id, 'shipped');
    assert.strictEqual(c.getPlan(p.id).completion_pct, 0);          // not yet rolled up
    const pct = c.rollupPlan(p.id);
    assert.strictEqual(pct, 100);
    assert.strictEqual(c.getPlan(p.id).completion_pct, 100);        // persisted
});

test('tree assembles roadmap -> plan -> item with live completion and counts', () => {
    const c = fresh();
    const r = c.createRoadmap({ title: 'Platform H2' });
    const p = c.createPlan({ title: 'Ship compose', parent_id: r.id });
    const a = c.createItem({ title: 'node model', plan_id: p.id });
    c.createItem({ title: 'mcp', plan_id: p.id });
    c.updateItemStatus(a.id, 'shipped');

    const t = c.tree();
    assert.strictEqual(t.roadmaps.length, 1);
    const rn = t.roadmaps[0];
    assert.strictEqual(rn.plans.length, 1);
    const pn = rn.plans[0];
    assert.strictEqual(pn.completion_pct, 50);                      // 1 of 2 shipped, live
    assert.strictEqual(pn.itemStatusCounts.shipped, 1);
    assert.strictEqual(pn.itemStatusCounts.open, 1);
    assert.strictEqual(pn.items.length, 2);
    assert.strictEqual(rn.planStatusCounts.open, 1);
    // roadmap carries no computed completion number (narrative health)
    assert.ok(!('completion_pct' in rn));
});

test('tree surfaces unparented plans and loose items at the top level', () => {
    const c = fresh();
    c.createPlan({ title: 'orphan plan' });
    c.createItem({ title: 'loose item' });
    const t = c.tree();
    assert.strictEqual(t.unparentedPlans.length, 1);
    assert.strictEqual(t.looseItems.length, 1);
    assert.strictEqual(t.looseItems[0].title, 'loose item');
});

test('tree surfaces an orphaned item (dangling plan_id) instead of dropping it', () => {
    const c = fresh();
    const it = c.createItem({ title: 'orphan', plan_id: 'GHOSTPLAN0000000000000000' });
    const t = c.tree();
    assert.strictEqual(t.looseItems.length, 0);          // not loose: it has a plan_id
    assert.strictEqual(t.orphanedItems.length, 1);       // surfaced, not dropped
    assert.strictEqual(t.orphanedItems[0].id, it.id);
    assert.strictEqual(t.orphanedItems[0].plan_id, 'GHOSTPLAN0000000000000000');  // dangling ref kept
});

test('checkLinkIntegrity reports dangling item and plan links, nothing when valid', () => {
    const frontmatter = require('./frontmatter');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'craft-compose-'));
    const store = createFileStore({ root: tmp });
    const c = createCompose(store);
    const r = c.createRoadmap({ title: 'r' });
    const p = c.createPlan({ title: 'p', parent_id: r.id });
    c.createItem({ title: 'ok', plan_id: p.id });
    assert.strictEqual(c.checkLinkIntegrity().length, 0);   // all valid

    const orphan = c.createItem({ title: 'dangling item', plan_id: 'GHOSTPLAN0000000000000000' });
    // Hand-edited rot: a plan doc whose parent_id points at a missing roadmap.
    const badPlanId = 'BADPLAN00000000000000000A';
    store.write('compose/plans/' + badPlanId + '.md', frontmatter.stringify(
        { id: badPlanId, type: 'plan', title: 'bad', parent_id: 'GHOSTROADMAP000000000000A', status: 'open', completion_pct: 0 }, 'body'));

    const broken = c.checkLinkIntegrity();
    const itemBreak = broken.find(b => b.id === orphan.id);
    const planBreak = broken.find(b => b.id === badPlanId);
    assert.ok(itemBreak && itemBreak.type === 'item' && itemBreak.dangling_ref === 'GHOSTPLAN0000000000000000', JSON.stringify(broken));
    assert.ok(planBreak && planBreak.type === 'plan' && planBreak.dangling_ref === 'GHOSTROADMAP000000000000A', JSON.stringify(broken));
});

test('tree items carry links + prose (plan_id, roadmap_id, severity, notes, next_action) and plans carry body', () => {
    const c = fresh();
    const r = c.createRoadmap({ title: 'road' });
    const p = c.createPlan({ title: 'plan', parent_id: r.id, body: 'shared context for children' });
    c.createItem({
        title: 'leaf', plan_id: p.id, category: 'feature', severity: 'high',
        notes: 'supporting context', next_action: 'do the concrete thing',
    });
    const pn = c.tree().roadmaps[0].plans[0];
    assert.strictEqual(pn.body.trim(), 'shared context for children');   // plan prose emitted
    const it = pn.items[0];
    assert.strictEqual(it.plan_id, p.id);
    assert.strictEqual(it.roadmap_id, r.id);                       // denormalized from the plan's parent
    assert.strictEqual(it.severity, 'high');
    assert.strictEqual(it.notes, 'supporting context');
    assert.strictEqual(it.next_action, 'do the concrete thing');
    assert.strictEqual(it.category, 'feature');
});

test('tree resolves roadmap_id to null for a loose item and an item under an unparented plan', () => {
    const c = fresh();
    const orphanPlan = c.createPlan({ title: 'no roadmap' });      // parent_id null
    c.createItem({ title: 'under orphan plan', plan_id: orphanPlan.id, next_action: 'x' });
    c.createItem({ title: 'truly loose' });                        // no plan_id
    const t = c.tree();
    const underOrphan = t.unparentedPlans[0].items[0];
    assert.strictEqual(underOrphan.plan_id, orphanPlan.id);
    assert.strictEqual(underOrphan.roadmap_id, null);              // plan has no roadmap
    const loose = t.looseItems[0];
    assert.strictEqual(loose.plan_id, null);
    assert.strictEqual(loose.roadmap_id, null);
});

test('tree with a roadmap_id returns just that subtree', () => {
    const c = fresh();
    const r1 = c.createRoadmap({ title: 'r1' });
    c.createRoadmap({ title: 'r2' });
    c.createPlan({ title: 'p1', parent_id: r1.id });
    const t = c.tree({ roadmap_id: r1.id });
    assert.strictEqual(t.roadmaps.length, 1);
    assert.strictEqual(t.roadmaps[0].id, r1.id);
    assert.ok(!('looseItems' in t));   // subtree view omits the top-level extras
});

// === sessionStart work-tree injection =======================================

test('buildWorkTreeInjection is null when there is no active work', () => {
    const c = fresh();
    assert.strictEqual(c.buildWorkTreeInjection({}), null);
    // shipped-only plan is not active
    const p = c.createPlan({ title: 'done', status: 'shipped' });
    assert.strictEqual(c.buildWorkTreeInjection({}), null, JSON.stringify(c.getPlan(p.id)));
});

test('buildWorkTreeInjection lists in-flight/open plans with completion + open counts', () => {
    const c = fresh();
    const r = c.createRoadmap({ title: 'Platform' });
    const p = c.createPlan({ title: 'Ship it', status: 'in-flight', parent_id: r.id });
    const a = c.createItem({ title: 'a', plan_id: p.id });
    c.createItem({ title: 'b', plan_id: p.id });
    c.updateItemStatus(a.id, 'shipped');
    const inj = c.buildWorkTreeInjection({});
    assert.ok(inj && /Active work composition/.test(inj.text));
    assert.ok(/Ship it/.test(inj.text));
    assert.ok(/roadmap: Platform/.test(inj.text));
    assert.ok(/50%/.test(inj.text), inj.text);
    assert.ok(/1 open item/.test(inj.text), inj.text);
    assert.strictEqual(inj.planCount, 1);
});

test('buildWorkTreeInjection surfaces open failure items for triage', () => {
    const c = fresh();
    c.createItem({ title: 'bash failed: ENOENT', category: 'failure' });
    c.createItem({ title: 'view failed: EACCES', category: 'failure' });
    const inj = c.buildWorkTreeInjection({});
    assert.ok(inj && /Failures awaiting triage \(2 open\)/.test(inj.text), inj && inj.text);
    assert.ok(/compose_status/.test(inj.text), 'includes the triage hint');
    assert.strictEqual(inj.failureCount, 2);
});

test('buildWorkTreeInjection excludes shipped/dropped plans and resolved failures', () => {
    const c = fresh();
    const p = c.createPlan({ title: 'in flight', status: 'in-flight' });
    const done = c.createPlan({ title: 'shipped plan', status: 'shipped' });
    const f = c.createItem({ title: 'old failure', category: 'failure' });
    c.updateItemStatus(f.id, 'dropped');   // triaged away
    const inj = c.buildWorkTreeInjection({});
    assert.ok(/in flight/.test(inj.text));
    assert.ok(!/shipped plan/.test(inj.text), 'shipped plan excluded');
    assert.ok(!/Failures awaiting triage/.test(inj.text), 'dropped failure excluded');
});

process.stdout.write(`\nTotal: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
