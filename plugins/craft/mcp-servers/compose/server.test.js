'use strict';

// server.test.js -- compose MCP JSON-RPC dispatch, via an injected fixture
// instance (createServer(createCompose(store))). Run: node server.test.js

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createFileStore } = require('../../lib/storage');
const { createCompose } = require('./compose');
const { createServer } = require('./server');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); process.stdout.write(`PASS  ${name}\n`); passed++; }
    catch (e) { process.stdout.write(`FAIL  ${name}\n        ${e.message}\n`); failed++; }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'craft-compose-srv-'));
const server = createServer(createCompose(createFileStore({ root: tmp })));

let nextId = 1;
function call(name, args) {
    const res = server.handleRequest({ jsonrpc: '2.0', id: nextId++, method: 'tools/call', params: { name, arguments: args || {} } });
    return res.result;
}
function sc(name, args) { return call(name, args).structuredContent; }

test('initialize identifies the compose server', () => {
    const r = server.handleRequest({ jsonrpc: '2.0', id: 1, method: 'initialize' });
    assert.strictEqual(r.result.serverInfo.name, 'craft-compose');
});

test('tools/list returns the 9 compose tools', () => {
    const r = server.handleRequest({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    assert.strictEqual(r.result.tools.length, 9);
    const names = r.result.tools.map(t => t.name);
    for (const n of ['compose_capture', 'compose_plan', 'compose_roadmap', 'compose_link', 'compose_unlink', 'compose_status', 'compose_update', 'compose_tree', 'compose_rollup']) {
        assert.ok(names.includes(n), `missing ${n}`);
    }
});

// shared graph built across the following tests
let roadmapId, planId, itemId;

test('compose_roadmap then compose_plan then compose_capture build the hierarchy', () => {
    roadmapId = sc('compose_roadmap', { title: 'Platform H2' }).id;
    assert.ok(roadmapId && roadmapId.length === 26);
    const plan = sc('compose_plan', { title: 'Ship compose', parent_id: roadmapId });
    planId = plan.id;
    assert.strictEqual(plan.parent_id, roadmapId);
    assert.strictEqual(plan.completion_pct, 0);
    const item = sc('compose_capture', { title: 'node model', plan_id: planId, category: 'feature' });
    itemId = item.id;
    assert.strictEqual(item.plan_id, planId);
    assert.strictEqual(item.type, 'item');
});

test('compose_link rejects an item linking to a roadmap (level rule)', () => {
    const res = call('compose_link', { child_id: itemId, parent_id: roadmapId });
    assert.ok(res.isError, 'expected an error result');
    assert.ok(/item can only link to a plan/.test(res.content[0].text), res.content[0].text);
});

test('compose_status ships the item; compose_rollup persists 100%', () => {
    sc('compose_status', { id: itemId, status: 'shipped' });
    const roll = sc('compose_rollup', { plan_id: planId });
    assert.strictEqual(roll.rolled_up[0].completion_pct, 100);
});

test('compose_tree renders the roadmap with its plan and item', () => {
    const t = sc('compose_tree', {});
    assert.strictEqual(t.roadmaps.length, 1);
    assert.strictEqual(t.roadmaps[0].plans[0].id, planId);
    assert.strictEqual(t.roadmaps[0].plans[0].completion_pct, 100);
    assert.strictEqual(t.roadmaps[0].plans[0].items[0].id, itemId);
});

test('compose_update edits an item and a plan; id + links survive (verified via tree)', () => {
    sc('compose_update', { id: planId, title: 'Ship compose v2' });
    sc('compose_update', { id: itemId, title: 'node model v2', category: 'refactor' });
    const t = sc('compose_tree', {});
    const pn = t.roadmaps[0].plans[0];
    assert.strictEqual(pn.id, planId);
    assert.strictEqual(pn.title, 'Ship compose v2');
    const it = pn.items[0];
    assert.strictEqual(it.id, itemId);              // id preserved
    assert.strictEqual(it.title, 'node model v2');
    assert.strictEqual(it.category, 'refactor');
});

test('compose_update rejects a type-mismatched field (body on an item)', () => {
    const res = call('compose_update', { id: itemId, body: 'items have no body' });
    assert.ok(res.isError, 'expected a type-mismatch error');
    assert.ok(/does not apply to a item/.test(res.content[0].text), res.content[0].text);
});

test('compose_update rejects a type-mismatched field (severity on a plan)', () => {
    const res = call('compose_update', { id: planId, severity: 'high' });
    assert.ok(res.isError);
    assert.ok(/does not apply to a plan/.test(res.content[0].text), res.content[0].text);
});

test('compose_update rejects PII in an updated field and an unknown id', () => {
    const pii = call('compose_update', { id: itemId, notes: 'see C:/Users/bob/secret' });
    assert.ok(pii.isError && /possible PII/.test(pii.content[0].text), pii.content[0].text);
    const nope = call('compose_update', { id: 'NOSUCHID', title: 'x' });
    assert.ok(nope.isError && /no such node/.test(nope.content[0].text), nope.content[0].text);
});

test('compose_capture rejects PII in the title (write-time guard)', () => {
    const res = call('compose_capture', { title: 'crash under C:/Users/bob/repos/x' });
    assert.ok(res.isError, 'expected a PII error');
    assert.ok(/possible PII/.test(res.content[0].text), res.content[0].text);
});

test('compose_capture rejects an email in notes', () => {
    const res = call('compose_capture', { title: 'ok title', notes: 'reported by alice@example.com' });
    assert.ok(res.isError);
    assert.ok(/email/.test(res.content[0].text), res.content[0].text);
});

test('an unknown tool name is an error result', () => {
    const res = call('compose_nope', {});
    assert.ok(res.isError);
    assert.ok(/unknown tool name/.test(res.content[0].text));
});

test('compose_capture honors an explicit status (parked leaf for wave gating)', () => {
    // Regression: capture previously dropped the status arg and always created
    // 'open', which broke the app-decompose wave rule (a dependent leaf must be
    // creatable as 'parked' so the fleet bridge does not dispatch it early). Runs
    // last with its own roadmap/plan so it perturbs no count-sensitive assertions.
    const rm = sc('compose_roadmap', { title: 'Status regression' }).id;
    const pl = sc('compose_plan', { title: 'wave plan', parent_id: rm }).id;
    const parked = sc('compose_capture', {
        title: 'wave-2 dependent', plan_id: pl, category: 'feature',
        next_action: 'do the dependent work', status: 'parked',
    });
    assert.strictEqual(parked.status, 'parked', 'explicit status must be honored');
    const dflt = sc('compose_capture', { title: 'default status', plan_id: pl, category: 'feature' });
    assert.strictEqual(dflt.status, 'open', 'omitted status still defaults to open');
});

test('compose_rollup surfaces a link-integrity report for a dangling item link', () => {
    const fresh = createServer(createCompose(createFileStore({ root: fs.mkdtempSync(path.join(os.tmpdir(), 'craft-compose-srv2-')) })));
    function scf(name, args) { return fresh.handleRequest({ jsonrpc: '2.0', id: 99, method: 'tools/call', params: { name, arguments: args || {} } }).result.structuredContent; }
    const p = scf('compose_plan', { title: 'p' });
    scf('compose_capture', { title: 'ok', plan_id: p.id });
    const clean = scf('compose_rollup', {});
    assert.strictEqual(clean.integrity.length, 0, 'no broken links in a valid tree');
    scf('compose_capture', { title: 'dangling', plan_id: 'GHOSTPLAN0000000000000000' });
    const report = scf('compose_rollup', {});
    assert.strictEqual(report.integrity.length, 1, JSON.stringify(report.integrity));
    assert.strictEqual(report.integrity[0].type, 'item');
    assert.strictEqual(report.integrity[0].dangling_ref, 'GHOSTPLAN0000000000000000');
});

test('compose_tree status filter and the oversized-text size guard', () => {
    const fresh = createServer(createCompose(createFileStore({ root: fs.mkdtempSync(path.join(os.tmpdir(), 'craft-compose-srv3-')) })));
    function scf(name, args) { return fresh.handleRequest({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name, arguments: args || {} } }); }
    const pid = scf('compose_plan', { title: 'p' }).result.structuredContent.id;
    const open = scf('compose_capture', { title: 'open one', plan_id: pid }).result.structuredContent.id;
    const ship = scf('compose_capture', { title: 'shipped one', plan_id: pid }).result.structuredContent.id;
    scf('compose_status', { id: ship, status: 'shipped' });

    // status filter narrows the emitted items in structuredContent
    const filtered = scf('compose_tree', { status: 'open' }).result.structuredContent;
    const pn = filtered.unparentedPlans[0];
    assert.strictEqual(pn.items.length, 1, JSON.stringify(pn.items));
    assert.strictEqual(pn.items[0].id, open);
    assert.strictEqual(pn.completion_pct, 50);   // still honest

    // size guard: many items -> the TEXT is summarized, structuredContent stays full
    for (let i = 0; i < 400; i++) { scf('compose_capture', { title: 'bulk item number ' + i + ' with some descriptive padding text', plan_id: pid }); }
    const res = scf('compose_tree', {}).result;
    assert.ok(/text summarized; full tree in structuredContent/.test(res.content[0].text), res.content[0].text.slice(0, 120));
    assert.ok(res.structuredContent.unparentedPlans[0].items.length >= 400, 'structuredContent keeps the full tree');
});

test('compose_unlink detaches an item (loose) and a plan (unparented); roadmap rejected', () => {
    const fresh = createServer(createCompose(createFileStore({ root: fs.mkdtempSync(path.join(os.tmpdir(), 'craft-compose-srv4-')) })));
    function scf(name, args) { return fresh.handleRequest({ jsonrpc: '2.0', id: 8, method: 'tools/call', params: { name, arguments: args || {} } }); }
    const rid = scf('compose_roadmap', { title: 'r' }).result.structuredContent.id;
    const pid = scf('compose_plan', { title: 'p', parent_id: rid }).result.structuredContent.id;
    const iid = scf('compose_capture', { title: 'i', plan_id: pid }).result.structuredContent.id;

    assert.ok(scf('compose_unlink', { id: iid }).result.structuredContent.success);
    assert.ok(scf('compose_tree', {}).result.structuredContent.looseItems.some(x => x.id === iid), 'item now loose');

    assert.ok(scf('compose_unlink', { id: pid }).result.structuredContent.success);
    assert.ok(scf('compose_tree', {}).result.structuredContent.unparentedPlans.some(x => x.id === pid), 'plan now unparented');

    const rmRes = scf('compose_unlink', { id: rid }).result;
    assert.ok(rmRes.isError && /roadmap is a root/.test(rmRes.content[0].text), rmRes.content[0].text);
    const noRes = scf('compose_unlink', { id: 'NOSUCHID' }).result;
    assert.ok(noRes.isError && /no such node/.test(noRes.content[0].text), noRes.content[0].text);
});



process.stdout.write(`\nTotal: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
