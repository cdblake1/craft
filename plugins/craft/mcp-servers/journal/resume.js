'use strict';

// resume.js -- compose the layered session-start "resume context" block.
//
// createResume({ journals, sessionState }) binds the composer to a journal
// instance (createJournals(store)) and the host session-state reader. Sections,
// each omitted when empty:
//   1. Where we left off  -- last-session recap from on-disk session-state
//   2. Current plan       -- this branch's journal current-plan
//   3. Prior findings     -- BM25 retrieval (journals.buildFindingsInjection)
//   4. Draft findings awaiting promotion -- nudge from the create->use loop
// Pure composition; zero deps.

function _truncate(s, n) {
    s = String(s || '').trim();
    if (s.length <= n) { return s; }
    return s.substring(0, n - 3).trim() + '...';
}

function _planHasContent(plan) {
    if (!plan) { return false; }
    const body = plan.replace(/^#.*$/m, '').trim();
    if (body.length < 20) { return false; }
    if (/^no plan yet\.?$/i.test(body)) { return false; }
    return true;
}

function createResume(deps) {
    const journals = deps.journals;
    const sessionState = deps.sessionState;

    function buildResumeInjection(opts) {
        opts = opts || {};
        const branch = String(opts.branch || '');
        const repo = opts.repo || undefined;
        const gitRoot = opts.gitRoot || '';
        const cwd = opts.cwd || '';
        const excludeSessionId = opts.excludeSessionId || '';
        const charCap = opts.charCap || 6144;
        const recapCap = opts.recapCap || 1200;
        const planCap = opts.planCap || 1600;

        const sections = [];

        // 1. Where we left off. Prefer the journal-owned recap (synced across
        // machines); fall back to the host session-state (local-only) when the
        // journal has no recap yet.
        let recap = null;
        try {
            const jr = journals.getRecap(branch, repo);
            if (jr && (jr.overview || jr.title)) {
                recap = { title: jr.title, name: jr.title, overview: jr.overview, updatedAt: jr.updatedAt };
            }
        } catch (_) { recap = null; }
        if (!recap) {
            try {
                recap = sessionState.buildLastSessionRecap({
                    gitRoot, cwd, excludeSessionId, rootOverride: opts.sessionStateRoot,
                });
            } catch (_) { recap = null; }
        }
        if (recap && (recap.overview || recap.title || recap.name)) {
            const head = recap.title || recap.name || 'previous session';
            const when = recap.updatedAt ? ` (last active ${recap.updatedAt})` : '';
            const lines = ['## Where we left off' + when, '', `**${head}**`];
            if (recap.overview) { lines.push('', _truncate(recap.overview, recapCap)); }
            sections.push({ key: 'recap', text: lines.join('\n') });
        }

        // 2. Current plan for this branch.
        let plan = '';
        try {
            const st = journals.getBranchStatus(branch, repo);
            if (st && st.current_plan) { plan = String(st.current_plan).trim(); }
        } catch (_) { plan = ''; }
        if (_planHasContent(plan)) {
            sections.push({ key: 'plan', text: '## Current plan (this branch)\n\n' + _truncate(plan, planCap) });
        }

        // 3. Prior findings, query enriched by the recap overview.
        const recapOverview = (recap && recap.overview) ? recap.overview : '';
        let findingsBlock = null;
        try {
            findingsBlock = journals.buildFindingsInjection({
                branch, planText: (plan + ' ' + recapOverview).trim(),
                minScore: opts.minScore, max: opts.max,
            });
        } catch (_) { findingsBlock = null; }
        let findings = [];
        if (findingsBlock && findingsBlock.text) {
            sections.push({ key: 'findings', text: findingsBlock.text.replace(/^# /m, '## ') });
            findings = findingsBlock.items || [];
        }

        // 4. Needs your attention: drafts awaiting promotion + stale findings.
        let draftCount = 0;
        try { draftCount = journals.countDraftFindings(branch, repo); } catch (_) { draftCount = 0; }
        let staleCount = 0;
        try { staleCount = (findingsBlock && findingsBlock.staleCount) || 0; } catch (_) { staleCount = 0; }
        if (draftCount > 0 || staleCount > 0) {
            const bullets = [];
            if (draftCount > 0) {
                bullets.push('- ' + draftCount + ' draft finding(s) in findings/_drafts/ awaiting promotion (review and move the good ones into findings/).');
            }
            if (staleCount > 0) {
                bullets.push('- ' + staleCount + ' finding(s) flagged stale or superseded (use journal_list_stale to curate).');
            }
            sections.push({ key: 'attention', text: '## Needs your attention\n\n' + bullets.join('\n') });
        }

        if (sections.length === 0) { return null; }

        // Budget-aware assembly (P8): drop whole low-priority sections before a
        // blunt truncation, and state what was dropped. Lower priority number =
        // kept longer. Display order stays recap -> plan -> findings -> attention.
        const PRIORITY = { plan: 1, findings: 2, recap: 3, attention: 4, drafts: 4 };
        const header = '# Resume context (journal)';
        const total = (arr) => header.length + 2 + arr.map(s => s.text).join('\n\n').length;
        let kept = sections.slice();
        const dropped = [];
        while (kept.length > 1 && total(kept) > charCap) {
            let idx = 0;
            for (let i = 1; i < kept.length; i++) {
                if ((PRIORITY[kept[i].key] || 5) >= (PRIORITY[kept[idx].key] || 5)) { idx = i; }
            }
            dropped.push(kept[idx].key);
            kept.splice(idx, 1);
        }
        if (dropped.indexOf('findings') !== -1) { findings = []; }

        let text = header + '\n\n' + kept.map(s => s.text).join('\n\n');
        if (dropped.length) { text += '\n\n_Dropped under budget: ' + dropped.join(', ') + '._'; }
        if (text.length > charCap) { text = text.substring(0, charCap - 16).trim() + '\n\n_..truncated._'; }
        return { text, sections: kept.map(s => s.key), dropped, hasRecap: !!recap, findings };
    }

    return { buildResumeInjection };
}

module.exports = { createResume };
