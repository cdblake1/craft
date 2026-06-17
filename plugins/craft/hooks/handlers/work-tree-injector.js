'use strict';

// work-tree-injector handler (sessionStart) -- surface the active work
// composition (in-flight/open plans + open failure items awaiting triage) as a
// second additionalContext block, merged by the dispatcher with the journal
// resume block. This is the "one view" loop: a session starts already seeing
// what work is in flight and which captured failures still need a decision.
//
// Compose data is global (not per-branch), so this needs no git resolution.

function _disabled() {
    return String(process.env.CRAFT_WORKTREE_INJECT_DISABLE || '').trim() === '1';
}

module.exports = {
    id: 'work-tree-injector',
    event: 'sessionStart',

    applies(payload, ctx) {
        return !_disabled();
    },

    run(payload, ctx) {
        try {
            const inj = ctx.compose.buildWorkTreeInjection({});
            if (inj && inj.text) { return { additionalContext: inj.text }; }
        } catch (_) { /* injection must never break startup */ }
        return null;
    },
};
