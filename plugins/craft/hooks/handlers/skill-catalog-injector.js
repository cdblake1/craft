'use strict';

// skill-catalog-injector handler (sessionStart) -- ALWAYS-ON propagation. Unlike
// the findings/work-tree injectors (which surface data and stay silent on a cold
// repo), this injects the craft skill catalog every session, so the agent sees
// the skills and the app-scale pipeline even with no journal/compose data yet.
// This is the fix for "the skills exist but never get invoked".

const { buildCatalogDirective } = require('../skill-catalog');

function _disabled() {
    if (String(process.env.CRAFT_PROPAGATE_DISABLE || '').trim() === '1') { return true; }
    if (String(process.env.CRAFT_CATALOG_INJECT_DISABLE || '').trim() === '1') { return true; }
    return false;
}

module.exports = {
    id: 'skill-catalog-injector',
    event: 'sessionStart',

    applies(payload, ctx) {
        return !_disabled();
    },

    run(payload, ctx) {
        try {
            const text = buildCatalogDirective();
            if (text && text.trim()) { return { additionalContext: text }; }
        } catch (_) { /* injection must never break startup */ }
        return null;
    },
};
