'use strict';

// failure-capture handler (sessionEnd) -- fingerprint + deduplicate this
// session's accumulated failure facts into the compose item layer (category
// 'failure'), then emit the end-of-session notice ("N failures, captured M").
// sessionEnd has no additionalContext channel, so the notice is stderr-only.

const { createFailureCapture } = require('../../mcp-servers/compose/failure');

function _disabled() {
    return String(process.env.CRAFT_FAILURE_CAPTURE_DISABLE || '').trim() === '1';
}

module.exports = {
    id: 'failure-capture',
    event: 'sessionEnd',

    applies(payload, ctx) {
        if (_disabled()) { return false; }
        return !!ctx.sessionId;
    },

    run(payload, ctx) {
        try {
            const fc = createFailureCapture({ store: ctx.stack.store, compose: ctx.compose });
            const res = fc.captureSession({ sessionId: ctx.sessionId });
            if (res.captured > 0) {
                process.stderr.write(`[failure-capture] ${res.failures} failure(s) this session, captured ${res.captured} item(s)\n`);
            }
        } catch (_) { /* must never fail the session */ }
        return null;
    },
};
