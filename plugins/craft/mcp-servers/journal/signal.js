'use strict';

// signal.js -- the "are injected findings actually used?" signal, on the adapter.
//
// createSignal(store) records two event types to one JSONL document
// (default key signal/findings-signal.jsonl) and joins them by sessionId:
//   {type:'inject',  ts, sessionId, branch, repo, count, paths:[...]}
//   {type:'consult', ts, sessionId, path}
//
// Inject is written once per session by the resume CLI (the findings it pushed);
// consult is written by the findings-consult postToolUse hook when the agent
// opens a promoted finding. The injected paths are logical adapter keys; the
// consult path is the absolute file the agent opened. Both are reduced to a
// canonical finding identity (the suffix from `journals/` on) so the two sides
// join regardless of which form they arrived in.

const DEFAULT_LOG_KEY = 'signal/findings-signal.jsonl';

// Canonical finding identity: lowercased, forward-slashed, from the last
// occurrence of `journals/` onward (so an absolute path and a logical key for
// the same finding reduce to the same value).
function _canon(p) {
    const s = String(p || '').replace(/\\/g, '/').toLowerCase();
    const i = s.lastIndexOf('journals/');
    return i >= 0 ? s.slice(i) : s;
}

// A promoted finding path: under a journal's findings/ dir, ends .md, not a
// _drafts candidate. Pure path-shape check (used by the consult hook's gate).
function isFindingPath(p) {
    if (!p) { return false; }
    const s = String(p).replace(/\\/g, '/').toLowerCase();
    if (!s.endsWith('.md')) { return false; }
    if (s.indexOf('/journals/') === -1 && s.indexOf('journals/') !== 0) { return false; }
    if (s.indexOf('/findings/') === -1) { return false; }
    if (s.indexOf('/findings/_drafts/') !== -1) { return false; }
    return true;
}

function createSignal(store, opts) {
    const logKey = (opts && opts.logKey) || DEFAULT_LOG_KEY;

    function logInjection(o) {
        o = o || {};
        const paths = (o.paths || []).map(_canon);
        store.append(logKey, JSON.stringify({
            type: 'inject', ts: new Date().toISOString(),
            sessionId: o.sessionId || '', branch: o.branch || '', repo: o.repo || '',
            count: paths.length, paths: paths,
        }) + '\n');
        return true;
    }

    function logConsult(o) {
        o = o || {};
        store.append(logKey, JSON.stringify({
            type: 'consult', ts: new Date().toISOString(),
            sessionId: o.sessionId || '', path: _canon(o.path),
        }) + '\n');
        return true;
    }

    function computeSignal(o) {
        o = o || {};
        const raw = store.read(logKey);
        const lines = raw === null ? [] : raw.split(/\r?\n/);
        const cutoff = o.sinceDays ? (Date.now() - o.sinceDays * 86400000) : 0;
        const injectedBySession = new Map();
        const consultedBySession = new Map();

        for (const line of lines) {
            const t = line.trim();
            if (!t) { continue; }
            let e;
            try { e = JSON.parse(t); } catch (_) { continue; }
            if (cutoff && e.ts && Date.parse(e.ts) < cutoff) { continue; }
            const sid = e.sessionId || '';
            if (e.type === 'inject') {
                if (!injectedBySession.has(sid)) { injectedBySession.set(sid, new Set()); }
                const set = injectedBySession.get(sid);
                for (const p of (e.paths || [])) { set.add(_canon(p)); }
            } else if (e.type === 'consult') {
                if (!consultedBySession.has(sid)) { consultedBySession.set(sid, new Set()); }
                consultedBySession.get(sid).add(_canon(e.path));
            }
        }

        let injectSessions = 0, consultedSessions = 0, injectedFindings = 0, consultedFindings = 0;
        for (const [sid, injectedSet] of injectedBySession) {
            if (injectedSet.size === 0) { continue; }
            injectSessions++;
            injectedFindings += injectedSet.size;
            const consultedSet = consultedBySession.get(sid) || new Set();
            let any = false;
            for (const p of injectedSet) {
                if (consultedSet.has(p)) { consultedFindings++; any = true; }
            }
            if (any) { consultedSessions++; }
        }

        return {
            injectSessions, consultedSessions,
            sessionConsultRate: injectSessions ? (consultedSessions / injectSessions) : 0,
            injectedFindings, consultedFindings,
            findingConsultRate: injectedFindings ? (consultedFindings / injectedFindings) : 0,
        };
    }

    return { logInjection, logConsult, computeSignal, logKey };
}

module.exports = { createSignal, isFindingPath };
