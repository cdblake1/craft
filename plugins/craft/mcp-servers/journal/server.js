#!/usr/bin/env node
'use strict';

// server.js -- craft journal MCP: exposes the per-branch journal corpus as typed
// stdio JSON-RPC tools. createServer(journals) binds the dispatch to an
// adapter-backed journals instance (createJournals(store)); main() builds the
// instance over the git-backed file adapter rooted at craft's data dir.
//
// Tools (9: 6 read + 3 write). Result objects use logical adapter `key` values
// where the copilot-tools server used absolute `path`; the tool field stays
// `path`/`key`-shaped per result. stderr is diagnostics; stdout is protocol-only.

const readline = require('readline');

const { createFileStore } = require('../../lib/storage');
const { createJournals } = require('./journals');
const { createResume } = require('./resume');
const sessionState = require('./sessionState');
const { defaultDataRoot } = require('./dataRoot');

const SERVER_NAME    = 'craft-journal';
const SERVER_VERSION = '0.2.0';
const PROTOCOL_VER   = '2024-11-05';

class JournalError extends Error {
    constructor(verb, reason, fields) {
        super(`Failed to ${verb}: ${reason}`);
        this.verb = verb; this.reason = reason; this.fields = fields || [];
    }
}

const TOOLS = [
    { name: 'journal_resume', description: 'ONE-CALL ORIENT: the assembled, token-budgeted resume block for a branch (where we left off + current plan + relevance/usage-ranked prior findings + what needs attention). Call this FIRST when picking up work on a branch. Lowest-priority sections drop under budget and the block says what it dropped.',
      inputSchema: { type: 'object', properties: { branch: { type: 'string' }, repo: { type: 'string' } }, required: ['branch'], additionalProperties: false } },
    { name: 'journal_list', description: 'Enumerate journals across all repos. Per-branch summary with finding/step-log counts.',
      inputSchema: { type: 'object', properties: { repo: { type: 'string' }, branch_prefix: { type: 'string' } }, additionalProperties: false } },
    { name: 'journal_get', description: 'Full read of one journal: README + current-plan + finding/step-log lists.',
      inputSchema: { type: 'object', properties: { branch: { type: 'string' }, repo: { type: 'string' } }, required: ['branch'], additionalProperties: false } },
    { name: 'journal_branch_status', description: 'Compact status: current-plan body + counts + last-seen.',
      inputSchema: { type: 'object', properties: { branch: { type: 'string' }, repo: { type: 'string' } }, required: ['branch'], additionalProperties: false } },
    { name: 'journal_find_findings', description: 'Relevance-ranked (BM25) search across all findings (title + body). Call this FIRST when starting a task to surface prior lessons; results are ranked by relevance with each finding\'s "When to read this" inline.',
      inputSchema: { type: 'object', properties: { query: { type: 'string' }, repo: { type: 'string' }, branch_prefix: { type: 'string' } }, required: ['query'], additionalProperties: false } },
    { name: 'journal_get_finding', description: 'Read one finding by key (from journal_find_findings or journal_get). Returns full markdown + parsed metadata.',
      inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'], additionalProperties: false } },
    { name: 'journal_recent', description: 'Chronological feed of recent step-log entries across branches, newest first.',
      inputSchema: { type: 'object', properties: { days_back: { type: 'integer' }, repo: { type: 'string' } }, additionalProperties: false } },
    { name: 'journal_create_finding', description: 'Create a finding in a branch journal. Numbered prefix auto-assigned; body must have an H1. Warns (does not block) on a near-identical existing title. Capture durable, reusable lessons at the end of a task. Optional scope: branch (default), repo (surfaces on every branch of the repo), or user (surfaces across repos).',
      inputSchema: { type: 'object', properties: { branch: { type: 'string' }, repo: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' }, scope: { type: 'string', enum: ['branch', 'repo', 'user'] } }, required: ['branch', 'title', 'body'], additionalProperties: false } },
    { name: 'journal_append_step_log', description: 'Append to today\'s step-log file. Creates it on first call; adds a timestamped subheading on later calls.',
      inputSchema: { type: 'object', properties: { branch: { type: 'string' }, repo: { type: 'string' }, content: { type: 'string' } }, required: ['branch', 'content'], additionalProperties: false } },
    { name: 'journal_update_current_plan', description: 'Replace the current-plan body. Atomic; last-write-wins on concurrent calls.',
      inputSchema: { type: 'object', properties: { branch: { type: 'string' }, repo: { type: 'string' }, content: { type: 'string' } }, required: ['branch', 'content'], additionalProperties: false } },
    { name: 'journal_supersede_finding', description: 'Mark a finding superseded by a newer one (old_path), linking old<->new. The superseded finding drops out of default retrieval but stays on disk. Use when a newer finding replaces an older lesson.',
      inputSchema: { type: 'object', properties: { old_path: { type: 'string' }, new_path: { type: 'string' } }, required: ['old_path'], additionalProperties: false } },
    { name: 'journal_retire_finding', description: 'Soft-delete a finding (status retired): it drops out of default retrieval but remains on disk and is reversible. Use for a stale or wrong finding.',
      inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'], additionalProperties: false } },
    { name: 'journal_update_finding', description: 'Correct a finding in place with a new body; preserves its metadata (scope/status/consults/links) and archives the prior version under findings/_history/. Body must have an H1.',
      inputSchema: { type: 'object', properties: { path: { type: 'string' }, body: { type: 'string' } }, required: ['path', 'body'], additionalProperties: false } },
    { name: 'journal_list_stale', description: 'Curation queue: findings that need a human decision (superseded, retired, stale, or gone cold). Feed these to journal_retire_finding / journal_supersede_finding / journal_update_finding. Set include_never_consulted to also surface findings never opened.',
      inputSchema: { type: 'object', properties: { repo: { type: 'string' }, include_never_consulted: { type: 'boolean' } }, additionalProperties: false } },
    { name: 'journal_link_finding', description: 'Add typed relationship links from a finding to related finding/plan/step-log keys (merged, deduped). Surfaced by journal_get_finding and journal_resume.',
      inputSchema: { type: 'object', properties: { path: { type: 'string' }, relates_to: { type: 'array', items: { type: 'string' } } }, required: ['path', 'relates_to'], additionalProperties: false } },
];

function _reqStr(args, field, verb) {
    if (!args || typeof args[field] !== 'string' || !args[field].trim()) {
        throw new JournalError(verb, `${field} is required`, [['field', field]]);
    }
}

function withFencedJson(prose, payload) {
    return `${prose}\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``;
}

function formatErrorMessage(verb, reason, fields) {
    let out = `Failed to ${verb}: ${reason}`;
    for (const [k, v] of (fields || [])) { out += `\n  ${k}: ${v}`; }
    return out;
}

// createServer binds tool handlers + dispatch to a journals instance. An optional
// deps.resume composer powers journal_resume; one is built by default.
function createServer(journals, deps) {
    const resume = (deps && deps.resume) || createResume({ journals, sessionState });
    const tools = {
        journal_resume(args) {
            _reqStr(args, 'branch', 'resume');
            const inj = resume.buildResumeInjection({ branch: args.branch, repo: args.repo });
            if (!inj || !inj.text) {
                return { branch: args.branch, repo: args.repo || null, text: null, sections: [], dropped: [], message: 'No resume context yet for this branch (no recap, plan, or prior findings).' };
            }
            return { branch: args.branch, repo: args.repo || null, text: inj.text, sections: inj.sections, dropped: inj.dropped || [] };
        },
        journal_list(args) {
            const all = journals.listAll().filter(j =>
                (!args.repo || j.repo === args.repo) &&
                (!args.branch_prefix || j.branch.startsWith(args.branch_prefix)));
            return { count: all.length, journals: all.map(j => ({ repo: j.repo, branch: j.branch, key: j.key, finding_count: j.findingCount, step_log_count: j.stepLogCount })) };
        },
        journal_get(args) {
            _reqStr(args, 'branch', 'get journal');
            const j = journals.readJournalFull(args.branch, args.repo);
            if (!j) { throw new JournalError('get journal', 'journal not found', [['field', 'branch'], ['value', args.branch]]); }
            return j;
        },
        journal_branch_status(args) {
            _reqStr(args, 'branch', 'get branch status');
            const j = journals.getBranchStatus(args.branch, args.repo);
            if (!j) { throw new JournalError('get branch status', 'journal not found', [['field', 'branch'], ['value', args.branch]]); }
            return j;
        },
        journal_find_findings(args) {
            _reqStr(args, 'query', 'find findings');
            const results = journals.findFindings(args.query, { repo: args.repo, branchPrefix: args.branch_prefix });
            return { query: args.query, count: results.length, findings: results };
        },
        journal_get_finding(args) {
            _reqStr(args, 'path', 'get finding');
            const f = journals.getFinding(args.path);
            if (!f) { throw new JournalError('get finding', 'finding not found at key', [['field', 'path'], ['value', args.path]]); }
            return f;
        },
        journal_recent(args) {
            const daysBack = (args && Number.isInteger(args.days_back) && args.days_back > 0) ? args.days_back : 7;
            const results = journals.recentStepLogs(daysBack, { repo: args && args.repo });
            return { days_back: daysBack, count: results.length, entries: results };
        },
        journal_create_finding(args) {
            const verb = 'create finding';
            _reqStr(args, 'branch', verb); _reqStr(args, 'title', verb); _reqStr(args, 'body', verb);
            try {
                const similar = journals.findSimilarFindings(args.title);
                const key = journals.createFinding(args.branch, args.repo, args.title, args.body, { scope: args.scope });
                const out = { success: true, key, branch: args.branch, repo: args.repo || null, title: args.title, scope: args.scope || 'branch' };
                if (similar.length) {
                    out.duplicate_warning = { message: `${similar.length} existing finding(s) have a very similar title; consider whether this duplicates one of them.`, similar: similar.slice(0, 3) };
                }
                return out;
            } catch (e) { throw new JournalError(verb, e.message, []); }
        },
        journal_append_step_log(args) {
            const verb = 'append step-log';
            _reqStr(args, 'branch', verb); _reqStr(args, 'content', verb);
            try { return { success: true, key: journals.appendStepLog(args.branch, args.repo, args.content), branch: args.branch, repo: args.repo || null }; }
            catch (e) { throw new JournalError(verb, e.message, []); }
        },
        journal_update_current_plan(args) {
            const verb = 'update current-plan';
            _reqStr(args, 'branch', verb);
            if (typeof args.content !== 'string') { throw new JournalError(verb, 'content is required (string)', [['field', 'content']]); }
            try { return { success: true, key: journals.updateCurrentPlan(args.branch, args.repo, args.content), branch: args.branch, repo: args.repo || null, length: args.content.length }; }
            catch (e) { throw new JournalError(verb, e.message, []); }
        },
        journal_supersede_finding(args) {
            const verb = 'supersede finding';
            _reqStr(args, 'old_path', verb);
            try { return Object.assign({ success: true }, journals.supersedeFinding(args.old_path, args.new_path)); }
            catch (e) { throw new JournalError(verb, e.message, []); }
        },
        journal_retire_finding(args) {
            const verb = 'retire finding';
            _reqStr(args, 'path', verb);
            try { return Object.assign({ success: true }, journals.retireFinding(args.path)); }
            catch (e) { throw new JournalError(verb, e.message, []); }
        },
        journal_update_finding(args) {
            const verb = 'update finding';
            _reqStr(args, 'path', verb); _reqStr(args, 'body', verb);
            try { return Object.assign({ success: true }, journals.updateFinding(args.path, args.body)); }
            catch (e) { throw new JournalError(verb, e.message, []); }
        },
        journal_list_stale(args) {
            const rows = journals.listStale({ repo: args.repo, includeNeverConsulted: !!args.include_never_consulted });
            const out = { count: rows.length, stale: rows };
            if (rows.length === 0) { out.message = 'Nothing to curate: no stale, superseded, retired, or cold findings.'; }
            return out;
        },
        journal_link_finding(args) {
            const verb = 'link finding';
            _reqStr(args, 'path', verb);
            if (!Array.isArray(args.relates_to)) { throw new JournalError(verb, 'relates_to is required (array of keys)', [['field', 'relates_to']]); }
            try { return Object.assign({ success: true }, journals.linkFinding(args.path, args.relates_to)); }
            catch (e) { throw new JournalError(verb, e.message, []); }
        },
    };

    function format(name, args, result) {
        if (name === 'journal_create_finding' && result.duplicate_warning) {
            let text = `Created finding: ${result.key}\n\nPossible duplicate: ${result.duplicate_warning.message}`;
            for (const s of result.duplicate_warning.similar) { text += `\n  - [${s.similarity}] ${s.title} (${s.key})`; }
            return withFencedJson(text, result);
        }
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
                const fields = (e instanceof JournalError) ? e.fields : [];
                const verb = (e instanceof JournalError) ? e.verb : `call ${name}`;
                const reason = (e instanceof JournalError) ? e.reason : e.message;
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
    const server = createServer(createJournals(store));
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
