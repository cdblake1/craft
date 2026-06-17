'use strict';

// sync-pull handler (sessionStart, runs FIRST) -- pull the data repo before any
// injector reads it, so a session starts from the cross-machine-current state.
//
// Opt-in: a no-op unless the data root is already a git repo OR CRAFT_SYNC_REMOTE
// is set (which wires the remote on first run). Local-only is the default, so
// nothing git-inits the data dir until the user points it at a private repo.
// Side effect only -- returns no additionalContext.

const { createSync } = require('../../lib/sync');

function _disabled() {
    return String(process.env.CRAFT_SYNC_DISABLE || '').trim() === '1';
}

module.exports = {
    id: 'sync-pull',
    event: 'sessionStart',

    applies(payload, ctx) {
        if (_disabled()) { return false; }
        const remote = process.env.CRAFT_SYNC_REMOTE;
        if (remote) { return true; }
        return createSync({ root: ctx.stack.root }).isRepo();
    },

    run(payload, ctx) {
        try {
            const sync = createSync({ root: ctx.stack.root });
            sync.ensureRepo(process.env.CRAFT_SYNC_REMOTE);
            if (sync.isEnabled()) { sync.pullStart(); }
        } catch (_) { /* sync must never break startup */ }
        return null;
    },
};
