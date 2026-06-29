'use strict';

// journals.js -- craft journal core, ported onto the storage adapter.
//
// createJournals(store) returns the journal data operations bound to a storage
// adapter. All journal IO goes through the adapter using logical keys namespaced
// under `journals/<repo>/<branch...>/`; a journal leaf is a key prefix that
// contains a `meta.json`. Pure logic (BM25, slugging, section extraction) is
// unchanged from the validated copilot-tools implementation; only the IO
// boundary moved to the adapter (design decision D5).

const { createRanker, usageAdjust } = require('./ranker');
const { parseFindingMeta, withFindingMeta, stripMetaHeader } = require('./findingMeta');
const { resolveEmbedder } = require('./embedder');

const NS = 'journals';

// P7: layer ranking weights -- branch findings rank above repo-global, which rank
// above user-global, at equal relevance (mem0-style layering).
const LAYER_WEIGHT = { branch: 1, repo: 0.85, user: 0.7 };

const _STOPWORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'is',
    'was', 'it', 'this', 'that', 'at', 'by', 'be', 'as', 'are', 'from', 'but',
    'not', 'if', 'when', 'what', 'which', 'you', 'your', 'we', 'our', 'i',
]);

function _tokenize(text) {
    if (!text) { return []; }
    const out = [];
    for (const raw of String(text).toLowerCase().split(/[^a-z0-9]+/)) {
        if (raw.length < 2) { continue; }
        if (_STOPWORDS.has(raw)) { continue; }
        out.push(raw);
    }
    return out;
}

function _firstH1Title(markdown) {
    if (!markdown) { return null; }
    const m = markdown.match(/^#\s+(.+?)\s*$/m);
    return m ? m[1].trim() : null;
}

function _extractSection(markdown, headingPrefix) {
    if (!markdown) { return null; }
    const lines = markdown.split(/\r?\n/);
    let collecting = false;
    const body = [];
    const re = new RegExp('^##\\s+' + headingPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    for (const line of lines) {
        if (collecting) {
            if (/^##\s+/.test(line)) { break; }
            body.push(line);
        } else if (re.test(line)) { collecting = true; }
    }
    if (!collecting) { return null; }
    return body.join('\n').trim() || null;
}

function slugifyTitle(title) {
    return String(title || 'untitled')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 60) || 'untitled';
}

function createJournals(store, opts) {
    opts = opts || {};
    // Retrieval ranking goes through the strategy seam (ranker.js): BM25 by
    // default, an optional embedding re-ranker when an embedder is configured
    // (opt-in via $CRAFT_JOURNAL_EMBEDDER; zero-service by default).
    const ranker = opts.ranker || createRanker({ embedder: opts.embedder || resolveEmbedder(process.env) });

    // Immediate .md children of a logical dir prefix (excludes nested dirs like
    // findings/_drafts), sorted by name.
    function _childMd(prefix) {
        const base = prefix.replace(/\/+$/, '') + '/';
        return store.list(prefix)
            .filter(k => k.startsWith(base) && k.endsWith('.md') && k.slice(base.length).indexOf('/') === -1)
            .map(k => k.slice(base.length))
            .sort();
    }

    function _readMeta(leaf) {
        const raw = store.read(`${leaf}/meta.json`);
        if (raw === null) { return null; }
        try { return JSON.parse(raw); } catch (_) { return null; }
    }

    // Every journal leaf: a key prefix containing meta.json. Derived from the
    // set of `.../meta.json` keys under the namespace.
    function _leaves() {
        const out = [];
        for (const key of store.list(NS)) {
            if (!key.endsWith('/meta.json')) { continue; }
            const leaf = key.slice(0, -('/meta.json'.length));
            const rel = leaf.slice(NS.length + 1); // strip "journals/"
            const segs = rel.split('/');
            if (segs.length < 2) { continue; }
            out.push({ leaf, repo: segs[0], branch: segs.slice(1).join('/') });
        }
        return out;
    }

    function listAll() {
        return _leaves()
            .sort((a, b) => (a.repo + '/' + a.branch).localeCompare(b.repo + '/' + b.branch))
            .map(L => {
                const meta = _readMeta(L.leaf);
                return {
                    repo: L.repo,
                    branch: L.branch,
                    key: L.leaf,
                    meta: meta,
                    findingCount: _childMd(`${L.leaf}/findings`).length,
                    stepLogCount: _childMd(`${L.leaf}/step-log`).length,
                    hasCurrentPlan: store.exists(`${L.leaf}/current-plan.md`),
                    hasReadme: store.exists(`${L.leaf}/README.md`),
                };
            })
            .filter(j => j.meta !== null);
    }

    function findJournal(branch, repo) {
        const cands = listAll().filter(j => j.branch === branch && (!repo || j.repo === repo));
        if (cands.length === 0) { return null; }
        if (cands.length > 1 && !repo) {
            return Object.assign({}, cands[0], { ambiguousRepos: cands.map(c => c.repo) });
        }
        return cands[0];
    }

    function readJournalFull(branch, repo) {
        const j = findJournal(branch, repo);
        if (!j) { return null; }
        const findings = _childMd(`${j.key}/findings`).map(name => ({
            name,
            key: `${j.key}/findings/${name}`,
            title: _firstH1Title(store.read(`${j.key}/findings/${name}`)) || name,
        }));
        const stepLogs = _childMd(`${j.key}/step-log`).map(name => ({ name, key: `${j.key}/step-log/${name}` }));
        return Object.assign({}, j, {
            readme: store.read(`${j.key}/README.md`),
            current_plan: store.read(`${j.key}/current-plan.md`),
            findings,
            step_logs: stepLogs,
        });
    }

    function getBranchStatus(branch, repo) {
        const j = findJournal(branch, repo);
        if (!j) { return null; }
        return {
            repo: j.repo,
            branch: j.branch,
            key: j.key,
            ambiguousRepos: j.ambiguousRepos || null,
            current_plan: store.read(`${j.key}/current-plan.md`),
            finding_count: j.findingCount,
            step_log_count: j.stepLogCount,
            meta_last_seen_at: (j.meta && j.meta.lastSeenAt) || null,
        };
    }

    function _findingResult(doc, queryTerms, score, extra) {
        const body = doc.body;
        const title = _firstH1Title(body) || doc.key.split('/').pop();
        let snippet = null;
        if (queryTerms && queryTerms.length) {
            const lower = body.toLowerCase();
            let idx = -1;
            for (const t of queryTerms) {
                const i = lower.indexOf(t);
                if (i >= 0 && (idx < 0 || i < idx)) { idx = i; }
            }
            if (idx >= 0) {
                snippet = body.substring(Math.max(0, idx - 40), Math.min(body.length, idx + 120)).replace(/\s+/g, ' ').trim();
            }
        }
        const meta = parseFindingMeta(body);
        extra = extra || {};
        const stale = (extra.stale != null) ? extra.stale
            : (meta.status === 'stale' || meta.status === 'superseded' || meta.status === 'retired');
        return {
            repo: doc.repo,
            branch: doc.branch,
            key: doc.key,
            title,
            snippet,
            score: Number(score.toFixed(4)),
            when_to_read: _extractSection(body, 'When to read this'),
            scope: meta.scope,
            status: meta.status,
            consults: meta.consults,
            last_consulted_at: meta.last_consulted_at,
            relates_to: meta.relates_to,
            stale: stale,
        };
    }

    function findFindings(query, opts) {
        opts = opts || {};
        const queryTerms = _tokenize(query);
        const docs = [];
        for (const j of listAll()) {
            if (opts.repo && j.repo !== opts.repo) { continue; }
            if (opts.branchPrefix && !j.branch.startsWith(opts.branchPrefix)) { continue; }
            for (const name of _childMd(`${j.key}/findings`)) {
                const key = `${j.key}/findings/${name}`;
                const body = store.read(key);
                if (!body) { continue; }
                docs.push({ repo: j.repo, branch: j.branch, key, body, tokens: _tokenize(stripMetaHeader(body)) });
            }
        }
        if (queryTerms.length === 0) {
            return docs.map(d => _findingResult(d, null, 0))
                .filter(r => opts.includeRetired || (r.status !== 'retired' && r.status !== 'superseded'));
        }

        const ranked = ranker.rank(queryTerms, docs, { queryText: query });
        // P4: blend the measured usage signal + recency over the base relevance
        // score and flag staleness. Neutral metadata yields factor 1.0, so pure
        // BM25 ordering is preserved (parity). P5: retired/superseded findings are
        // excluded from default retrieval (still on disk). Re-sort on adjusted score.
        const nowMs = (opts.nowMs != null) ? opts.nowMs : Date.now();
        const adjusted = [];
        for (const { doc, score } of ranked) {
            const meta = parseFindingMeta(doc.body);
            if (!opts.includeRetired && (meta.status === 'retired' || meta.status === 'superseded')) { continue; }
            const a = usageAdjust(score, meta, nowMs, opts.usageOpts);
            const layerWeight = LAYER_WEIGHT[meta.scope] != null ? LAYER_WEIGHT[meta.scope] : 1;
            adjusted.push({ doc, score: a.score * layerWeight, stale: a.stale });
        }
        adjusted.sort((a, b) => b.score - a.score);
        return adjusted.map(({ doc, score, stale }) => _findingResult(doc, queryTerms, score, { stale }));
    }

    function getFinding(key) {
        if (!key) { return null; }
        const body = store.read(key);
        if (body === null) { return null; }
        const meta = parseFindingMeta(body);
        return {
            key, title: _firstH1Title(body),
            when_to_read: _extractSection(body, 'When to read this'),
            scope: meta.scope, status: meta.status, consults: meta.consults,
            supersedes: meta.supersedes, superseded_by: meta.superseded_by,
            last_consulted_at: meta.last_consulted_at, relates_to: meta.relates_to,
            body,
        };
    }

    function recentStepLogs(daysBack, opts) {
        opts = opts || {};
        const cutoffMs = Date.now() - (daysBack * 86400000);
        const out = [];
        for (const j of listAll()) {
            if (opts.repo && j.repo !== opts.repo) { continue; }
            for (const name of _childMd(`${j.key}/step-log`)) {
                const m = name.match(/^(\d{4}-\d{2}-\d{2})/);
                if (!m) { continue; }
                const date = new Date(m[1] + 'T00:00:00Z');
                if (isFinite(date.getTime()) && date.getTime() < cutoffMs) { continue; }
                const body = store.read(`${j.key}/step-log/${name}`);
                out.push({
                    repo: j.repo, branch: j.branch, date: m[1], key: `${j.key}/step-log/${name}`,
                    preview: body ? body.split(/\r?\n/).slice(0, 4).join('\n') : null,
                });
            }
        }
        out.sort((a, b) => b.date.localeCompare(a.date));
        return out;
    }

    function countDraftFindings(branch, repo) {
        const j = findJournal(branch, repo);
        if (!j) { return 0; }
        return _childMd(`${j.key}/findings/_drafts`).length;
    }

    function findSimilarFindings(title, opts) {
        opts = opts || {};
        const threshold = (opts.threshold != null) ? opts.threshold : 0.6;
        const newTokens = new Set(_tokenize(title));
        if (newTokens.size === 0) { return []; }
        const out = [];
        for (const j of listAll()) {
            if (opts.repo && j.repo !== opts.repo) { continue; }
            for (const name of _childMd(`${j.key}/findings`)) {
                const body = store.read(`${j.key}/findings/${name}`);
                if (body === null) { continue; }
                const t = _firstH1Title(body) || name;
                const toks = new Set(_tokenize(t));
                if (toks.size === 0) { continue; }
                let inter = 0;
                for (const tok of newTokens) { if (toks.has(tok)) { inter++; } }
                const union = newTokens.size + toks.size - inter;
                const sim = union ? inter / union : 0;
                if (sim >= threshold) {
                    out.push({ key: `${j.key}/findings/${name}`, title: t, repo: j.repo, branch: j.branch, similarity: Math.round(sim * 100) / 100 });
                }
            }
        }
        out.sort((a, b) => b.similarity - a.similarity);
        return out;
    }

    // P7: resolve the journal leaf a finding of a given scope is stored under.
    // branch -> the branch journal (must exist). repo -> journals/<repo>/_repo,
    // user -> journals/_user/_global; both scope leaves are auto-created. This is
    // how a repo-global finding surfaces on every branch of the repo and a user
    // finding surfaces across repos.
    function _resolveScopeLeaf(scope, branch, repo) {
        if (scope === 'repo') {
            if (!repo) { throw new Error('repo is required for a repo-scoped finding'); }
            const leaf = `${NS}/${repo}/_repo`;
            if (!store.exists(`${leaf}/meta.json`)) { store.write(`${leaf}/meta.json`, JSON.stringify({ repo, branch: '_repo', scope: 'repo' })); }
            return leaf;
        }
        if (scope === 'user') {
            const leaf = `${NS}/_user/_global`;
            if (!store.exists(`${leaf}/meta.json`)) { store.write(`${leaf}/meta.json`, JSON.stringify({ repo: '_user', branch: '_global', scope: 'user' })); }
            return leaf;
        }
        const j = findJournal(branch, repo);
        if (!j) { throw new Error(`No journal found for branch '${branch}'` + (repo ? ` in repo '${repo}'` : '')); }
        return j.key;
    }

    function createFinding(branch, repo, title, body, opts) {
        opts = opts || {};
        const scope = opts.scope || 'branch';
        if (!title || !body) { throw new Error('title and body are required'); }
        if (!/^#\s+/m.test(body)) { throw new Error('body must contain at least one H1 markdown heading'); }
        const leafKey = _resolveScopeLeaf(scope, branch, repo);
        const existing = _childMd(`${leafKey}/findings`);
        const maxPrefix = existing.map(n => { const m = n.match(/^(\d{2})-/); return m ? parseInt(m[1], 10) : 0; }).reduce((a, b) => Math.max(a, b), 0);
        const prefix = String(maxPrefix + 1).padStart(2, '0');
        const key = `${leafKey}/findings/${prefix}-${slugifyTitle(title)}.md`;
        if (store.exists(key)) { throw new Error(`finding file already exists: ${key}`); }
        const meta = Object.assign({ status: 'active', scope }, opts.meta || {});
        store.write(key, withFindingMeta(body, meta));
        return key;
    }

    function appendStepLog(branch, repo, content) {
        const j = findJournal(branch, repo);
        if (!j) { throw new Error(`No journal found for branch '${branch}'`); }
        if (!content) { throw new Error('content is required'); }
        const today = new Date().toISOString().substring(0, 10);
        const key = `${j.key}/step-log/${today}.md`;
        const existing = store.read(key);
        if (existing === null) {
            store.write(key, `# ${today} step log\n\n${content}\n`);
        } else {
            const ts = new Date().toISOString().substring(11, 19) + ' UTC';
            const sep = existing.endsWith('\n') ? '' : '\n';
            store.append(key, `${sep}\n## ${ts}\n\n${content}\n`);
        }
        return key;
    }

    // P4: record a consult on a finding -- the measured loop feeding ranking.
    // Increments the finding's metadata consult count and last-consulted date so
    // usageAdjust boosts findings that actually get opened. Idempotent-safe; a
    // missing key or unreadable body is a no-op (the consult hook must never fail
    // a tool call). Legacy header-less findings gain a metadata header on first
    // consult.
    function recordConsult(key, opts) {
        opts = opts || {};
        if (!key) { return null; }
        const body = store.read(key);
        if (body === null) { return null; }
        const meta = parseFindingMeta(body);
        meta.consults = (Number.isFinite(meta.consults) ? meta.consults : 0) + 1;
        meta.last_consulted_at = opts.at || new Date().toISOString().substring(0, 10);
        store.write(key, withFindingMeta(body, meta));
        return { key, consults: meta.consults, last_consulted_at: meta.last_consulted_at };
    }

    function updateCurrentPlan(branch, repo, content) {
        const j = findJournal(branch, repo);
        if (!j) { throw new Error(`No journal found for branch '${branch}'`); }
        if (typeof content !== 'string') { throw new Error('content must be a string'); }
        const key = `${j.key}/current-plan.md`;
        store.write(key, content);
        return key;
    }

    // P6: journal-owned continuity recap. Persisted into the journal (so it syncs
    // across machines, unlike the host-local session-state) and read back first by
    // the resume composer, with the host session-state as fallback only.
    function saveRecap(branch, repo, recap) {
        const j = findJournal(branch, repo);
        if (!j) { return null; }
        const payload = {
            title: (recap && recap.title) || '',
            overview: (recap && recap.overview) || '',
            updatedAt: (recap && recap.updatedAt) || new Date().toISOString(),
            sessionId: (recap && recap.sessionId) || '',
        };
        if (!payload.title && !payload.overview) { return null; }
        const key = `${j.key}/recap.json`;
        store.write(key, JSON.stringify(payload, null, 2));
        return key;
    }

    function getRecap(branch, repo) {
        const j = findJournal(branch, repo);
        if (!j) { return null; }
        const raw = store.read(`${j.key}/recap.json`);
        if (raw === null) { return null; }
        try { return JSON.parse(raw); } catch (_) { return null; }
    }

    // P10: the curation work queue -- findings that need a human decision:
    // superseded / retired / explicitly-stale, plus active findings that went
    // cold (consulted before but not within staleDays). never-consulted findings
    // are noisy, so they are included only on request (includeNeverConsulted).
    // Each row carries a `reason` so the curator knows why it surfaced.
    function listStale(opts) {
        opts = opts || {};
        const nowMs = (opts.nowMs != null) ? opts.nowMs : Date.now();
        const staleDays = (opts.usageOpts && opts.usageOpts.staleDays != null) ? opts.usageOpts.staleDays : 90;
        const out = [];
        for (const j of listAll()) {
            if (opts.repo && j.repo !== opts.repo) { continue; }
            for (const name of _childMd(`${j.key}/findings`)) {
                const key = `${j.key}/findings/${name}`;
                const body = store.read(key);
                if (body === null) { continue; }
                const meta = parseFindingMeta(body);
                let reason = null;
                if (meta.status === 'retired') { reason = 'retired'; }
                else if (meta.status === 'superseded') { reason = 'superseded'; }
                else if (meta.status === 'stale') { reason = 'stale'; }
                else if (meta.last_consulted_at) {
                    const t = Date.parse(meta.last_consulted_at);
                    if (isFinite(t) && (nowMs - t) / 86400000 > staleDays) { reason = 'cold'; }
                } else if (opts.includeNeverConsulted) { reason = 'never-consulted'; }
                if (reason) {
                    out.push({
                        key, title: _firstH1Title(body) || name, repo: j.repo, branch: j.branch,
                        reason, status: meta.status, superseded_by: meta.superseded_by,
                        last_consulted_at: meta.last_consulted_at, consults: meta.consults,
                    });
                }
            }
        }
        return out;
    }

    // P5: memory-lifecycle. All three reference an existing finding key, preserve
    // the rest of the metadata, and are reversible (status edits / archived prior
    // body), never a hard delete. retired + superseded findings drop out of
    // default retrieval (findFindings) but stay on disk.
    function _patchMeta(key, patch) {
        const body = store.read(key);
        if (body === null) { return null; }
        const meta = Object.assign(parseFindingMeta(body), patch);
        store.write(key, withFindingMeta(body, meta));
        return meta;
    }

    function retireFinding(key) {
        if (!_patchMeta(key, { status: 'retired' })) { throw new Error(`finding not found: ${key}`); }
        return { key, status: 'retired' };
    }

    function supersedeFinding(oldKey, newKey) {
        if (store.read(oldKey) === null) { throw new Error(`finding not found: ${oldKey}`); }
        if (newKey && store.read(newKey) === null) { throw new Error(`replacement finding not found: ${newKey}`); }
        _patchMeta(oldKey, { status: 'superseded', superseded_by: newKey || null });
        if (newKey) { _patchMeta(newKey, { supersedes: oldKey }); }
        return { old_key: oldKey, new_key: newKey || null, status: 'superseded' };
    }

    function updateFinding(key, newBody) {
        const existing = store.read(key);
        if (existing === null) { throw new Error(`finding not found: ${key}`); }
        if (!newBody || !/^#\s+/m.test(newBody)) { throw new Error('body must contain at least one H1 markdown heading'); }
        const meta = parseFindingMeta(existing); // preserve status/scope/consults/links
        const idx = key.lastIndexOf('/findings/');
        const leaf = key.slice(0, idx);
        const name = key.split('/').pop().replace(/\.md$/, '');
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        store.write(`${leaf}/findings/_history/${name}-${ts}.md`, existing); // history-preserving
        store.write(key, withFindingMeta(newBody, meta));
        return { key, updated: true };
    }

    // P11: typed links. Merge `relates` keys into a finding's relates_to metadata
    // (deduped). Links are optional and absent-safe; getFinding and the resume
    // block surface them. References an existing finding key.
    function linkFinding(key, relates) {
        const body = store.read(key);
        if (body === null) { throw new Error(`finding not found: ${key}`); }
        const arr = (Array.isArray(relates) ? relates : [relates]).filter(Boolean);
        const meta = parseFindingMeta(body);
        const set = new Set([...(meta.relates_to || []), ...arr]);
        meta.relates_to = [...set];
        store.write(key, withFindingMeta(body, meta));
        return { key, relates_to: meta.relates_to };
    }

    function buildFindingsInjection(opts) {
        opts = opts || {};
        const branch = String(opts.branch || '');
        const planText = String(opts.planText || '');
        const max = opts.max || 8;
        const minScore = (opts.minScore != null) ? opts.minScore : 1.0;
        const charCap = opts.charCap || 4096;
        const query = branch.replace(/[\/_-]+/g, ' ') + ' ' + planText;
        const results = findFindings(query).filter(r => r.score >= minScore).slice(0, max);
        if (results.length === 0) { return null; }
        const lines = ['# Prior findings (possibly relevant to this session)', '', 'Surfaced by relevance to the current branch + plan. Open the path for the full finding.', ''];
        for (const r of results) {
            lines.push(`- [${r.repo}/${r.branch}] ${r.title}`);
            const hint = r.when_to_read || r.snippet;
            if (hint) { lines.push('  ' + String(hint).replace(/\s+/g, ' ').trim().substring(0, 200)); }
            if (r.relates_to && r.relates_to.length) { lines.push('  links: ' + r.relates_to.join(', ')); }
            lines.push('  ' + r.key);
        }
        let text = lines.join('\n');
        if (text.length > charCap) { text = text.substring(0, charCap - 32) + '\n\n_..truncated._'; }
        return { text, count: results.length, staleCount: results.filter(r => r.stale).length, items: results.map(r => ({ key: r.key, score: r.score, repo: r.repo, branch: r.branch, title: r.title })) };
    }

    return {
        listAll, findJournal, readJournalFull, getBranchStatus,
        findFindings, getFinding, recentStepLogs, countDraftFindings, findSimilarFindings,
        createFinding, appendStepLog, updateCurrentPlan, recordConsult, buildFindingsInjection,
        retireFinding, supersedeFinding, updateFinding, linkFinding, saveRecap, getRecap, listStale,
        slugifyTitle,
    };
}

module.exports = { createJournals, slugifyTitle };
