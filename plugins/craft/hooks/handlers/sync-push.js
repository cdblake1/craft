'use strict';

// sync-push handler (sessionEnd, runs LAST) -- commit + push the data repo after
// every writer (draft seeder, failure capture) has run, so the session's output
// reaches the remote. A no-op unless sync is enabled (repo + origin remote). On a
// push failure it leaves a .pending-push marker (reconciled on the next pull) and
// emits a stderr notice. Side effect only.

const { createSync } = require('../../lib/sync');

function _disabled() {
    return String(process.env.CRAFT_SYNC_DISABLE || '').trim() === '1';
}

module.exports = {
    id: 'sync-push',
    event: 'sessionEnd',

    applies(payload, ctx) {
        if (_disabled()) { return false; }
        return createSync({ root: ctx.stack.root }).isEnabled();
    },

    run(payload, ctx) {
        try {
            const res = createSync({ root: ctx.stack.root }).pushEnd();
            if (res && res.pending) {
                process.stderr.write('[sync] push deferred; .pending-push set, will retry next session\n');
            }
        } catch (_) { /* sync must never break shutdown */ }
        return null;
    },
};
