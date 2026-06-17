'use strict';

// dataRoot.js -- build the adapter-backed journal stack. The data-root resolver
// itself is canonical in lib/storage (shared by both MCPs); this module just
// re-exports it and assembles the journal-specific layers (journals + signal)
// on top of one store so every journal entrypoint shares the same data root.

const { createFileStore, defaultDataRoot } = require('../../lib/storage');
const { createJournals } = require('./journals');
const { createSignal } = require('./signal');

// Build the adapter and the journal data layers above it in one place.
function buildStack() {
    const root = defaultDataRoot();
    const store = createFileStore({ root });
    return {
        root,
        store,
        journals: createJournals(store),
        signal: createSignal(store),
    };
}

module.exports = { defaultDataRoot, buildStack };
