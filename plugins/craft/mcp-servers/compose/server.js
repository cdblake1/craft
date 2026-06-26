#!/usr/bin/env node
'use strict';

// server.js -- craft compose MCP: the roadmap -> plan -> item work-composition
// tools over stdio JSON-RPC. createServer(compose) binds dispatch to an
// adapter-backed compose instance (createCompose(store)); main() builds the
// instance over the git-backed file adapter rooted at craft's data dir (the same
// data root as the journal -- one adapter, both MCPs).
//
// Seven tools (design 0001, D4): compose_capture, compose_plan, compose_roadmap,
// compose_link, compose_status, compose_tree, compose_rollup. Result text is
// plaintext prose + a trailing fenced JSON block (the backlog convention);
// structuredContent carries the same payload. stderr is diagnostics; stdout is
// protocol-only.

const readline = require('readline');

const { createFileStore } = require('../../lib/storage');
const { createCompose } = require('./compose');
const { defaultDataRoot } = require('../journal/dataRoot');
const pii = require('./pii');

const SERVER_NAME    = 'craft-compose';
const SERVER_VERSION = '0.1.0';
const PROTOCOL_VER   = '2024-11-05';

class ComposeError extends Error {
    constructor(verb, reason, fields) {
        super(`Failed to ${verb}: ${reason}`);
        this.verb = verb; this.reason = reason; this.fields = fields || [];
    }
}

const TOOLS = [
    { name: 'compose_capture', description: 'Append a work item, optionally linked to a plan (plan_id). The leaf of the roadmap->plan->item hierarchy; this is where concrete work and captured failures land. Validates against PII (paths, emails, links) at write time.',
      inputSchema: { type: 'object', properties: { title: { type: 'string' }, category: { type: 'string' }, severity: { type: 'string' }, plan_id: { type: 'string' }, notes: { type: 'string' }, next_action: { type: 'string' }, status: { type: 'string' } }, required: ['title'], additionalProperties: false } },
    { name: 'compose_plan', description: 'Create a plan node, optionally under a roadmap (parent_id). Plans carry prose plus a rolled-up completion_pct.',
      inputSchema: { type: 'object', properties: { title: { type: 'string' }, parent_id: { type: 'string' }, status: { type: 'string' }, body: { type: 'string' } }, required: ['title'], additionalProperties: false } },
    { name: 'compose_roadmap', description: 'Create a roadmap node (the top level: a narrative outcome). Roadmap health stays narrative, never a computed number.',
      inputSchema: { type: 'object', properties: { title: { type: 'string' }, status: { type: 'string' }, body: { type: 'string' } }, required: ['title'], additionalProperties: false } },
    { name: 'compose_link', description: 'Link a child to its parent by id: an item to a plan, or a plan to a roadmap. Enforces the level rules.',
      inputSchema: { type: 'object', properties: { child_id: { type: 'string' }, parent_id: { type: 'string' } }, required: ['child_id', 'parent_id'], additionalProperties: false } },
    { name: 'compose_status', description: 'Append a status change to any node (item, plan, or roadmap). Item statuses: open, evaluated, in-flight, shipped, dropped, parked. Plan/roadmap: same minus evaluated.',
      inputSchema: { type: 'object', properties: { id: { type: 'string' }, status: { type: 'string' }, notes: { type: 'string' }, next_action: { type: 'string' } }, required: ['id', 'status'], additionalProperties: false } },
    { name: 'compose_tree', description: 'Render the roadmap->plan->item tree (the unified view). With roadmap_id, return just that subtree; otherwise also surface unparented plans and loose items. Plan completion is computed live.',
      inputSchema: { type: 'object', properties: { roadmap_id: { type: 'string' } }, additionalProperties: false } },
    { name: 'compose_rollup', description: 'Recompute plan completion_pct from child item states and persist it. With plan_id, roll up one plan; otherwise roll up all plans. Deterministic count-based (shipped / non-dropped).',
      inputSchema: { type: 'object', properties: { plan_id: { type: 'string' } }, additionalProperties: false } },
];

function withFencedJson(prose, payload) {
    return `${prose}\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``;
}

function formatErrorMessage(verb, reason, fields) {
    let out = `Failed to ${verb}: ${reason}`;
    for (const [k, v] of (fields || [])) { out += `\n  ${k}: ${v}`; }
    return out;
}

function _reqStr(args, field, verb) {
    if (!args || typeof args[field] !== 'string' || !args[field].trim()) {
        throw new ComposeError(verb, `${field} is required`, [['field', field]]);
    }
}

// Reject PII in any free-text field at write time (the store is synced/published).
function _piiGuard(verb, fields) {
    const hits = pii.detectAll(fields);
    if (hits.length) {
        const h = hits[0];
        throw new ComposeError(verb, `possible PII in ${h.field} (${h.name}): "${h.match}". ${h.hint}`,
            hits.map(x => [x.field, x.name]));
    }
}

function createServer(compose) {
    const tools = {
        compose_capture(args) {
            const verb = 'capture item';
            _reqStr(args, 'title', verb);
            _piiGuard(verb, { title: args.title || '', notes: args.notes || '', next_action: args.next_action || '' });
            try {
                const it = compose.createItem({
                    title: args.title, category: args.category, severity: args.severity,
                    plan_id: args.plan_id, notes: args.notes, next_action: args.next_action,
                    status: args.status,
                });
                return { success: true, id: it.id, type: 'item', status: it.status, category: it.category, plan_id: it.plan_id || null };
            } catch (e) { throw new ComposeError(verb, e.message, []); }
        },
        compose_plan(args) {
            const verb = 'create plan';
            _reqStr(args, 'title', verb);
            _piiGuard(verb, { title: args.title || '', body: args.body || '' });
            try {
                const p = compose.createPlan({ title: args.title, parent_id: args.parent_id, status: args.status, body: args.body });
                return { success: true, id: p.id, type: 'plan', status: p.status, parent_id: p.parent_id, completion_pct: p.completion_pct };
            } catch (e) { throw new ComposeError(verb, e.message, []); }
        },
        compose_roadmap(args) {
            const verb = 'create roadmap';
            _reqStr(args, 'title', verb);
            _piiGuard(verb, { title: args.title || '', body: args.body || '' });
            try {
                const r = compose.createRoadmap({ title: args.title, status: args.status, body: args.body });
                return { success: true, id: r.id, type: 'roadmap', status: r.status };
            } catch (e) { throw new ComposeError(verb, e.message, []); }
        },
        compose_link(args) {
            const verb = 'link nodes';
            _reqStr(args, 'child_id', verb);
            _reqStr(args, 'parent_id', verb);
            try {
                compose.link(args.child_id, args.parent_id);
                const child = compose.getNode(args.child_id);
                return { success: true, child_id: args.child_id, parent_id: args.parent_id, child_type: child.type };
            } catch (e) { throw new ComposeError(verb, e.message, []); }
        },
        compose_status(args) {
            const verb = 'set status';
            _reqStr(args, 'id', verb);
            _reqStr(args, 'status', verb);
            _piiGuard(verb, { notes: args.notes || '', next_action: args.next_action || '' });
            const node = compose.getNode(args.id);
            if (!node) { throw new ComposeError(verb, `no such node: ${args.id}`, [['field', 'id']]); }
            try {
                if (node.type === 'item') { compose.updateItemStatus(args.id, args.status, { notes: args.notes, next_action: args.next_action }); }
                else if (node.type === 'plan') { compose.updatePlanStatus(args.id, args.status); }
                else { compose.updateRoadmapStatus(args.id, args.status); }
                return { success: true, id: args.id, type: node.type, status: args.status };
            } catch (e) { throw new ComposeError(verb, e.message, []); }
        },
        compose_tree(args) {
            try { return compose.tree({ roadmap_id: args.roadmap_id }); }
            catch (e) { throw new ComposeError('render tree', e.message, []); }
        },
        compose_rollup(args) {
            const verb = 'roll up';
            try {
                if (args.plan_id) { return { success: true, rolled_up: [{ id: args.plan_id, completion_pct: compose.rollupPlan(args.plan_id) }] }; }
                return { success: true, rolled_up: compose.rollupAll() };
            } catch (e) { throw new ComposeError(verb, e.message, []); }
        },
    };

    function format(name, args, result) {
        if (name === 'compose_tree') {
            const n = (result.roadmaps || []).length;
            return withFencedJson(`compose tree: ${n} roadmap(s)`, result);
        }
        if (name === 'compose_rollup') {
            return withFencedJson(`rolled up ${result.rolled_up.length} plan(s)`, result);
        }
        if (result && result.id) { return withFencedJson(`${name} -> ${result.type} ${result.id}`, result); }
        return withFencedJson(`${name} succeeded`, result);
    }

    function handleRequest(req) {
        const { id, method, params } = req;
        if (method === 'initialize') {
            return { jsonrpc: '2.0', id, result: { protocolVersion: PROTOCOL_VER, capabilities: { tools: {} }, serverInfo: { name: SERVER_NAME, version: SERVER_VERSION } } };
        }
        if (method === 'tools/list') { return { jsonrpc: '2.0', id, result: { tools: TOOLS } }; }
        if (method === 'ping') { return { jsonrpc: '2.0', id, result: {} }; }
        if (method === 'tools/call') {
            const name = params && params.name;
            const args = (params && params.arguments) || {};
            const fn = tools[name];
            if (!fn) {
                return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: formatErrorMessage(`call ${String(name)}`, 'unknown tool name', [['field', 'name'], ['value', String(name)]]) }], isError: true } };
            }
            try {
                const result = fn(args);
                return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: format(name, args, result) }], structuredContent: result } };
            } catch (e) {
                const fields = (e instanceof ComposeError) ? e.fields : [];
                const verb = (e instanceof ComposeError) ? e.verb : `call ${name}`;
                const reason = (e instanceof ComposeError) ? e.reason : e.message;
                return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: formatErrorMessage(verb, reason, fields) }], isError: true } };
            }
        }
        return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
    }

    return { handleRequest, TOOLS };
}

function main() {
    const root = defaultDataRoot();
    const store = createFileStore({ root });
    const server = createServer(createCompose(store));
    process.stderr.write(`[${SERVER_NAME}] data root: ${root}${process.env.CRAFT_DATA_ROOT ? ' (from $CRAFT_DATA_ROOT)' : ''}\n`);

    const rl = readline.createInterface({ input: process.stdin, terminal: false });
    rl.on('line', (line) => {
        const trimmed = line.trim();
        if (!trimmed) { return; }
        let msg;
        try { msg = JSON.parse(trimmed); }
        catch (e) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: `Parse error: ${e.message}` } }) + '\n'); return; }
        if (msg.id === undefined || msg.id === null) { return; }
        try { process.stdout.write(JSON.stringify(server.handleRequest(msg)) + '\n'); }
        catch (e) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: `Internal error: ${e.message}` } }) + '\n'); }
    });
    rl.on('close', () => process.exit(0));
}

if (require.main === module) { main(); }

module.exports = { createServer };
