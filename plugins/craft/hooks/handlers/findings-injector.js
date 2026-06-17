'use strict';

// findings-injector handler (sessionStart) -- build the layered resume block
// (last-session recap + current plan + prior findings) for the current branch and
// return it as additionalContext. Records the injected finding keys to the
// behavior signal so the consult handler can later measure whether they were read.

const { createResume } = require('../../mcp-servers/journal/resume');

function _disabled() {
    return String(process.env.COPILOT_FINDINGS_DISABLE || '').trim() === '1';
}

module.exports = {
    id: 'findings-injector',
    event: 'sessionStart',

    applies(payload, ctx) {
        if (_disabled()) { return false; }
        return !!ctx.gitInfo().branch;
    },

    run(payload, ctx) {
        const g = ctx.gitInfo();
        if (!g.branch) { return null; }

        const minScore = parseFloat(process.env.COPILOT_FINDINGS_MIN_SCORE || '1.5');
        const max = parseInt(process.env.COPILOT_FINDINGS_MAX || '8', 10);

        const resume = createResume({ journals: ctx.stack.journals, sessionState: ctx.sessionState });
        const inj = resume.buildResumeInjection({
            branch: g.branch,
            repo: g.repo || undefined,
            gitRoot: g.gitRoot || ctx.cwd,
            cwd: ctx.cwd,
            excludeSessionId: ctx.sessionId,
            minScore: minScore,
            max: max,
        });
        if (!inj || !inj.text) { return null; }

        // Record what we injected so the consult handler + reporter can measure
        // whether these findings actually get opened this session.
        try {
            if (inj.findings && inj.findings.length && ctx.sessionId) {
                ctx.stack.signal.logInjection({
                    sessionId: ctx.sessionId,
                    branch: g.branch,
                    repo: g.repo || undefined,
                    paths: inj.findings.map(f => f.key || f.path),
                });
            }
        } catch (_) { /* signal logging must never break startup */ }

        return { additionalContext: inj.text };
    },
};
