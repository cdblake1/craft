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

        // 1. Where we left off.
        let recap = null;
        try {
            recap = sessionState.buildLastSessionRecap({
                gitRoot, cwd, excludeSessionId, rootOverride: opts.sessionStateRoot,
            });
        } catch (_) { recap = null; }
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

        // 4. Draft findings awaiting promotion.
        let draftCount = 0;
        try { draftCount = journals.countDraftFindings(branch, repo); } catch (_) { draftCount = 0; }
        if (draftCount > 0) {
            sections.push({
                key: 'drafts',
                text: '## Draft findings awaiting promotion\n\n' + draftCount +
                    ' draft finding(s) seeded from past sessions are waiting in this branch\'s ' +
                    'findings/_drafts/. Review them and move the good ones into findings/ so future sessions surface them.',
            });
        }

        if (sections.length === 0) { return null; }

        let text = '# Resume context (journal)\n\n' + sections.map(s => s.text).join('\n\n');
        if (text.length > charCap) { text = text.substring(0, charCap - 16).trim() + '\n\n_..truncated._'; }
        return { text, sections: sections.map(s => s.key), hasRecap: !!recap, findings };
    }

    return { buildResumeInjection };
}

module.exports = { createResume };
