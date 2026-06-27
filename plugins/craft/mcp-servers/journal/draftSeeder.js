'use strict';

// draftSeeder.js -- seed a DRAFT finding from the session's checkpoint overview.
//
// createDraftSeeder({ store, journals, sessionState }). The journal's two legacy
// extractors yield ~0 drafts in practice; the checkpoint overview is always
// present and rich, so it is the reliable seed. Idempotent: deduped by a content
// hash of the overview against existing findings + drafts, and the hash is in the
// filename so distinct overviews that slug to the same name cannot overwrite each
// other. Draft writes go through the adapter; the recap is read from the host
// session-state via sessionState (design decision D5/W1).

const crypto = require('crypto');

function createDraftSeeder(deps) {
    const store = deps.store;
    const journals = deps.journals;
    const sessionState = deps.sessionState;

    // True if any finding or draft under the leaf already carries this hash
    // marker. store.list is recursive, so listing findings/ also covers _drafts/.
    function _hashExists(leaf, hash) {
        const marker = '**Hash:** ' + hash;
        for (const key of store.list(leaf + '/findings')) {
            if (!key.endsWith('.md')) { continue; }
            const raw = store.read(key);
            if (raw && raw.indexOf(marker) !== -1) { return true; }
        }
        return false;
    }

    // Returns { key, hash, created } or null. created === false means a matching
    // draft or promoted finding already existed (idempotent no-op).
    function seedDraftFromSession(opts) {
        opts = opts || {};
        const branch = opts.branch;
        const repo = opts.repo;
        const sessionDirPath = opts.sessionDir;
        const minLen = (opts.minLen != null) ? opts.minLen : 80;
        if (!branch || !sessionDirPath) { return null; }

        const j = journals.findJournal(branch, repo);
        if (!j) { return null; }

        const recap = sessionState.getSessionRecap(sessionDirPath);
        if (!recap || !recap.overview) { return null; }
        const overview = String(recap.overview).trim();
        if (overview.length < minLen) { return null; }

        const hash = crypto.createHash('sha1').update(overview.toLowerCase()).digest('hex').substring(0, 16);
        if (_hashExists(j.key, hash)) { return { key: null, hash, created: false }; }

        const title = (recap.title && recap.title.trim()) ||
            ('Session lesson ' + new Date().toISOString().substring(0, 10));
        const slug = journals.slugifyTitle(title);
        const date = new Date().toISOString().substring(0, 10);
        const sessionId = opts.sessionId || sessionDirPath.split(/[\\/]/).pop();
        const key = `${j.key}/findings/_drafts/${date}-${slug}-${hash.substring(0, 8)}.md`;

        const body = [
            '# ' + title,
            '',
            '**Source:** session:' + sessionId,
            '**Seeded:** ' + date + ' from the session checkpoint overview',
            '**Hash:** ' + hash,
            '**Status:** draft -- edit "When to read this", then move to ../' + slug + '.md to accept, or delete to reject.',
            '',
            '## When to read this',
            '',
            '<fill in: what future task would benefit from this lesson?>',
            '',
            '## Summary',
            '',
            overview,
            '',
        ].join('\n');

        store.write(key, body);
        return { key, hash, created: true };
    }

    return { seedDraftFromSession };
}

module.exports = { createDraftSeeder };
