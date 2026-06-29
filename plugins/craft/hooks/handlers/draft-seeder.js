'use strict';

// draft-seeder handler (sessionEnd) -- seed a draft finding from this session's
// checkpoint overview into the current branch journal, deduped by content hash.
// sessionEnd has no additionalContext channel, so it emits a stderr breadcrumb
// only and returns null.

const { createDraftSeeder } = require('../../mcp-servers/journal/draftSeeder');

function _disabled() {
    return String(process.env.COPILOT_FINDINGS_DISABLE || '').trim() === '1';
}

module.exports = {
    id: 'draft-seeder',
    event: 'sessionEnd',

    applies(payload, ctx) {
        if (_disabled()) { return false; }
        if (!ctx.sessionId) { return false; }
        return !!ctx.gitInfo().branch;
    },

    run(payload, ctx) {
        const g = ctx.gitInfo();
        if (!ctx.sessionId || !g.branch) { return null; }

        const dir = ctx.sessionState.sessionDir(ctx.sessionId);
        if (!dir) { return null; }

        const seeder = createDraftSeeder({
            store: ctx.stack.store,
            journals: ctx.stack.journals,
            sessionState: ctx.sessionState,
        });
        const res = seeder.seedDraftFromSession({
            branch: g.branch,
            repo: g.repo || undefined,
            sessionDir: dir,
            sessionId: ctx.sessionId,
        });
        if (res && res.created && res.key) {
            process.stderr.write('[draft-seeder] ' + (res.promoted ? 'auto-promoted finding ' : 'seeded draft ') + res.key + '\n');
        }
        return null;
    },
};
