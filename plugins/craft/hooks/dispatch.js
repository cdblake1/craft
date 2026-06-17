'use strict';

// dispatch.js -- the craft hook dispatcher (D1). One process per hook event:
//
//   node dispatch.js <event>   < payload.json (on stdin)
//
// Reads the hook payload from stdin, looks up the handlers registered for <event>
// in the explicit ordered registry, runs each handler's applies()+run() in
// declared order, merges their additionalContext into one JSON envelope, and
// writes it to stdout (the Copilot CLI sessionStart/additionalContext contract).
//
// Contract:
//   - Handlers run in registry order. No discovery, no numeric ordering.
//   - Each handler returns { additionalContext: string } or null. Nulls and
//     blank context contribute nothing. Multiple chunks join with a blank line.
//   - Errors are isolated per handler (logged to the error log, never rethrown):
//     one bad handler must not take down the others or fail the hook.
//   - Disable flags: CRAFT_DISPATCH_DISABLE=1 (all events) or
//     CRAFT_DISPATCH_<EVENT>_DISABLE=1 (one event, upper-cased).

const fs = require('fs');
const os = require('os');
const path = require('path');
const registry = require('./registry');
const { buildContext } = require('./context');

function _errorLogPath() {
    const o = String(process.env.CRAFT_DISPATCHER_ERROR_LOG || '').trim();
    if (o) { return o; }
    return path.join(os.homedir(), '.copilot', 'logs', 'craft-hook-errors.jsonl');
}

function _logErr(event, handlerId, phase, message) {
    try {
        const logPath = _errorLogPath();
        fs.mkdirSync(path.dirname(logPath), { recursive: true });
        fs.appendFileSync(logPath, JSON.stringify({
            ts: new Date().toISOString(), event: event, handler: handlerId, phase: phase, message: String(message),
        }) + '\n');
    } catch (_) { /* logging must never throw */ }
}

function _disabled(event) {
    if (String(process.env.CRAFT_DISPATCH_DISABLE || '').trim() === '1') { return true; }
    const perEvent = 'CRAFT_DISPATCH_' + String(event || '').toUpperCase() + '_DISABLE';
    if (String(process.env[perEvent] || '').trim() === '1') { return true; }
    return false;
}

function dispatch(event, payload) {
    const handlers = registry[event] || [];
    if (handlers.length === 0) { return ''; }

    const ctx = buildContext({
        eventType: event,
        sessionId: (payload && (payload.session_id || payload.sessionId)) || process.env.COPILOT_SESSION_ID,
    });

    const chunks = [];
    for (const h of handlers) {
        let applies = false;
        try {
            applies = h.applies ? h.applies(payload, ctx) : true;
        } catch (e) {
            _logErr(event, h.id, 'applies', e && e.message ? e.message : e);
            applies = false;
        }
        if (!applies) { continue; }

        try {
            const r = h.run(payload, ctx);
            const ac = r && r.additionalContext;
            if (ac && String(ac).trim()) { chunks.push(String(ac).trim()); }
        } catch (e) {
            _logErr(event, h.id, 'run', e && e.message ? e.message : e);
        }
    }

    if (chunks.length === 0) { return ''; }
    return JSON.stringify({ additionalContext: chunks.join('\n\n') });
}

function _readStdin() {
    return new Promise((resolve) => {
        if (process.stdin.isTTY) { resolve(''); return; }
        let raw = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (d) => { raw += d; });
        process.stdin.on('end', () => resolve(raw));
        process.stdin.on('error', () => resolve(raw));
    });
}

async function main() {
    const event = process.argv[2] || '';
    if (!event || _disabled(event)) { process.exit(0); }

    const raw = await _readStdin();
    let payload = {};
    if (raw && raw.trim()) { try { payload = JSON.parse(raw); } catch (_) { payload = {}; } }

    let out = '';
    try { out = dispatch(event, payload); }
    catch (e) { _logErr(event, '_dispatcher', 'dispatch', e && e.message ? e.message : e); }

    if (out) { process.stdout.write(out); }
    process.exit(0);
}

if (require.main === module) { main(); }

module.exports = { dispatch };
