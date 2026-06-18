'use strict';

// failure-record handler (postToolUseFailure) -- accumulate one observable
// failure fact (tool, error text, exit code) into the per-session pending log.
// The fact is fingerprinted and deduplicated into a compose item at sessionEnd
// by the failure-capture handler. Cheap, fact-only, never throws.

const { createFailureCapture } = require('../../mcp-servers/compose/failure');

const TOOL_NAME_FIELDS = ['tool_name', 'toolName', 'name', 'tool'];
const ERROR_FIELDS = ['error', 'errorMessage', 'message', 'stderr', 'reason'];
const EXIT_FIELDS = ['exitCode', 'exit_code', 'code', 'status'];
// Claude Code's PostToolUseFailure payload carries the result under tool_response
// / tool_output; Copilot uses result/toolResult/etc. Cover both hosts.
const NESTED_FIELDS = ['tool_response', 'tool_output', 'result', 'toolResult', 'tool_result', 'output', 'detail'];

function _getField(obj, names) {
    if (!obj || typeof obj !== 'object') { return null; }
    for (const n of names) {
        if (obj[n] != null && String(obj[n]) !== '') { return obj[n]; }
    }
    return null;
}

function _extractError(payload) {
    const direct = _getField(payload, ERROR_FIELDS);
    if (direct) { return direct; }
    for (const prop of NESTED_FIELDS) {
        let inner = payload[prop];
        if (!inner) { continue; }
        if (typeof inner === 'string') { return inner; }
        const nested = _getField(inner, ERROR_FIELDS);
        if (nested) { return nested; }
    }
    return '';
}

function _disabled() {
    return String(process.env.CRAFT_FAILURE_CAPTURE_DISABLE || '').trim() === '1';
}

module.exports = {
    id: 'failure-record',
    event: 'postToolUseFailure',
    _extractError: _extractError,

    applies(payload, ctx) {
        if (_disabled()) { return false; }
        return !!ctx.sessionId;
    },

    run(payload, ctx) {
        try {
            const fc = createFailureCapture({ store: ctx.stack.store, compose: ctx.compose });
            fc.recordFailure({
                sessionId: ctx.sessionId,
                tool: _getField(payload, TOOL_NAME_FIELDS) || '',
                error: _extractError(payload),
                exitCode: _getField(payload, EXIT_FIELDS),
            });
        } catch (_) { /* a failure hook must never fail the session */ }
        return null;
    },
};
