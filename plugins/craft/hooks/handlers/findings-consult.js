'use strict';

// findings-consult handler (postToolUse) -- when the agent opens a promoted
// finding file, record a "consult" event for the injected-and-consulted signal.
//
// postToolUse fires after every tool call, so this must stay cheap: applies()
// gates on the disable flags + the tool being a file-touching tool (no git, no
// IO), and only an actual finding-open writes a line. It must never throw and
// never resolves git (ctx.gitInfo is intentionally not called here).

const { isFindingPath } = require('../../mcp-servers/journal/signal');

const TOOL_NAME_FIELDS = ['toolName', 'tool_name', 'name', 'tool'];
const PATH_FIELDS = ['path', 'file_path', 'filePath', 'file', 'target_file', 'targetFile', 'target'];
const NESTED_FIELDS = ['toolArgs', 'tool_input', 'toolInput', 'input', 'parameters', 'args', 'arguments'];
const FILE_TOOLS = ['view', 'edit', 'create', 'read'];

function _getField(obj, names) {
    if (!obj || typeof obj !== 'object') { return null; }
    for (const n of names) {
        if (obj[n] != null && String(obj[n]) !== '') { return obj[n]; }
    }
    return null;
}

function _looksAbsolute(s) {
    return /^[A-Za-z]:[\\/]/.test(s) || s.startsWith('/') || s.startsWith('\\\\');
}

function _extractPath(payload) {
    if (!payload) { return null; }
    const direct = _getField(payload, PATH_FIELDS);
    if (direct && _looksAbsolute(String(direct))) { return String(direct); }

    for (const prop of NESTED_FIELDS) {
        let inner = payload[prop];
        if (!inner) { continue; }
        if (typeof inner === 'string') {
            try { inner = JSON.parse(inner); } catch (_) { continue; }
        }
        const candidate = _getField(inner, PATH_FIELDS);
        if (candidate && _looksAbsolute(String(candidate))) { return String(candidate); }
    }
    return null;
}

function _disabled() {
    if (String(process.env.COPILOT_FINDINGS_DISABLE || '').trim() === '1') { return true; }
    if (String(process.env.COPILOT_FINDINGS_SIGNAL_DISABLE || '').trim() === '1') { return true; }
    return false;
}

module.exports = {
    id: 'findings-consult',
    event: 'postToolUse',
    _extractPath: _extractPath,

    applies(payload, ctx) {
        if (_disabled()) { return false; }
        const tool = _getField(payload, TOOL_NAME_FIELDS);
        if (!tool) { return false; }
        return FILE_TOOLS.indexOf(String(tool).toLowerCase()) !== -1;
    },

    run(payload, ctx) {
        try {
            const p = _extractPath(payload);
            if (!isFindingPath(p)) { return null; }
            ctx.stack.signal.logConsult({ sessionId: ctx.sessionId, path: p });
        } catch (_) { /* postToolUse handlers must never fail the tool call */ }
        return null;
    },
};
