'use strict';

// recap-writer handler (sessionEnd) -- persist this session's "where we left off"
// recap INTO the branch journal (P6), so continuity syncs across machines instead
// of living only in the host-local session-state. The resume composer reads this
// journal recap first and falls back to host session-state. sessionEnd has no
// additionalContext channel, so this emits a stderr breadcrumb and returns null.
// Best-effort: never throws, gated by the same disable flag as the injector.

function _disabled() {
    return String(process.env.COPILOT_FINDINGS_DISABLE || '').trim() === '1';
}

module.exports = {
    id: 'recap-writer',
    event: 'sessionEnd',

    applies(payload, ctx) {
        if (_disabled()) { return false; }
        if (!ctx.sessionId) { return false; }
        return !!ctx.gitInfo().branch;
    },

    run(payload, ctx) {
        try {
            const g = ctx.gitInfo();
            if (!g.branch) { return null; }
            const dir = ctx.sessionState.sessionDir(ctx.sessionId);
            if (!dir) { return null; }
            const rec = ctx.sessionState.getSessionRecap(dir);
            if (!rec || (!rec.title && !rec.overview)) { return null; }
            const key = ctx.stack.journals.saveRecap(g.branch, g.repo || undefined, {
                title: rec.title, overview: rec.overview,
                updatedAt: new Date().toISOString(), sessionId: ctx.sessionId,
            });
            if (key) { process.stderr.write('[recap-writer] saved ' + key + '\n'); }
        } catch (_) { /* sessionEnd handlers must never throw */ }
        return null;
    },
};
