'use strict';

// compose.js -- the work-composition node model on the storage adapter (design
// 0001, D3). Three node types, three levels: roadmap -> plan -> item.
//
//   items     append-only JSONL at  compose/items.jsonl  (one line per event,
//             create then updates, replayed to a resolved view -- the backlog
//             model, extended with a plan_id link)
//   plans     markdown + YAML frontmatter at  compose/plans/<ulid>.md
//   roadmaps  markdown + YAML frontmatter at  compose/roadmaps/<ulid>.md
//
// Every node has a stable ULID. Links are by id (parent_id on plans/roadmaps,
// plan_id on items), never by path, so renames never break the graph. All IO
// goes through the injected adapter -- this module never touches the filesystem.
//
// createCompose(store) returns the data operations; tree assembly and roll-up
// (which build on these) live alongside in this module.

const { ulid } = require('./ulid');
const frontmatter = require('./frontmatter');

const ITEMS_KEY = 'compose/items.jsonl';
const PLANS_NS = 'compose/plans';
const ROADMAPS_NS = 'compose/roadmaps';

// Items keep the backlog's status + category vocabulary (they ARE the backlog),
// extended with a 'failure' category for the failure-capture path (D6). Plans
// and roadmaps use a smaller lifecycle (no triage-only 'evaluated').
const ITEM_STATUSES = ['open', 'evaluated', 'in-flight', 'shipped', 'dropped', 'parked'];
const NODE_STATUSES = ['open', 'in-flight', 'shipped', 'dropped', 'parked'];
const ITEM_CATEGORIES = ['cost', 'perf', 'hook-gap', 'skill-gap', 'bug', 'feature', 'refactor', 'idea', 'recipe', 'failure'];
const ITEM_SEVERITIES = ['info', 'low', 'medium', 'high'];
const TITLE_MAX = 240;
const NEXT_ACTION_MAX = 480;

function _now() { return new Date().toISOString(); }

function _requireTitle(title) {
    const t = String(title == null ? '' : title).trim();
    if (!t) { throw new Error('title is required'); }
    if (t.length > TITLE_MAX) { throw new Error(`title exceeds ${TITLE_MAX} chars`); }
    return t;
}

function _checkEnum(value, allowed, label, fallback) {
    if (value == null || value === '') { return fallback; }
    const v = String(value);
    if (allowed.indexOf(v) === -1) { throw new Error(`invalid ${label} "${v}" (allowed: ${allowed.join(', ')})`); }
    return v;
}

function createCompose(store) {
    if (!store) { throw new Error('createCompose requires a store'); }

    // === items (JSONL, replayed) ===========================================

    function _readItemEntries() {
        const raw = store.read(ITEMS_KEY);
        if (raw == null) { return []; }
        const out = [];
        for (const line of raw.split(/\r?\n/)) {
            const s = line.trim();
            if (!s) { continue; }
            try { out.push(JSON.parse(s)); } catch (_) { /* skip malformed */ }
        }
        return out;
    }

    // Replay create + updates into the current view of each item.
    function _resolveItems(entries) {
        const byId = new Map();
        for (const e of entries) {
            if (!e.id) { continue; }
            const cur = byId.get(e.id);
            if (!cur) { byId.set(e.id, Object.assign({}, e)); continue; }
            for (const k of Object.keys(e)) {
                if (e[k] !== undefined && e[k] !== null) { cur[k] = e[k]; }
            }
            cur.ts = e.ts;
            cur.kind = 'resolved';
        }
        return Array.from(byId.values());
    }

    function createItem(opts) {
        opts = opts || {};
        const entry = {
            id: ulid(),
            ts: _now(),
            kind: 'create',
            type: 'item',
            title: _requireTitle(opts.title),
            status: _checkEnum(opts.status, ITEM_STATUSES, 'status', 'open'),
            category: _checkEnum(opts.category, ITEM_CATEGORIES, 'category', 'idea'),
        };
        if (opts.severity != null) { entry.severity = _checkEnum(opts.severity, ITEM_SEVERITIES, 'severity'); }
        if (opts.plan_id) { entry.plan_id = String(opts.plan_id); }
        if (opts.notes) { entry.notes = String(opts.notes); }
        if (opts.next_action) {
            const na = String(opts.next_action);
            if (na.length > NEXT_ACTION_MAX) { throw new Error(`next_action exceeds ${NEXT_ACTION_MAX} chars`); }
            entry.next_action = na;
        }
        if (opts.source_session_id) { entry.source_session_id = String(opts.source_session_id); }
        store.append(ITEMS_KEY, JSON.stringify(entry) + '\n');
        return entry;
    }

    function listItems(filter) {
        filter = filter || {};
        let items = _resolveItems(_readItemEntries());
        if (filter.plan_id !== undefined) { items = items.filter(i => (i.plan_id || null) === (filter.plan_id || null)); }
        if (filter.status) { items = items.filter(i => i.status === filter.status); }
        return items;
    }

    function getItem(id) {
        if (!id) { return null; }
        return _resolveItems(_readItemEntries()).find(i => i.id === id) || null;
    }

    function _appendItemUpdate(id, patch) {
        if (!getItem(id)) { throw new Error(`no such item: ${id}`); }
        const entry = Object.assign({ id: String(id), ts: _now(), kind: 'update' }, patch);
        store.append(ITEMS_KEY, JSON.stringify(entry) + '\n');
        return getItem(id);
    }

    function updateItemStatus(id, status, extra) {
        extra = extra || {};
        const patch = { status: _checkEnum(status, ITEM_STATUSES, 'status') };
        if (extra.notes) { patch.notes = String(extra.notes); }
        if (extra.next_action) {
            const na = String(extra.next_action);
            if (na.length > NEXT_ACTION_MAX) { throw new Error(`next_action exceeds ${NEXT_ACTION_MAX} chars`); }
            patch.next_action = na;
        }
        return _appendItemUpdate(id, patch);
    }

    // Edit an item's content fields in place (id and links preserved). Status is
    // NOT changed here -- that stays updateItemStatus. Implemented as a replayed
    // 'update' entry, the same append-and-overlay model as a status change. Only
    // the fields present in `fields` are touched.
    function updateItem(id, fields) {
        fields = fields || {};
        const patch = {};
        if (fields.title != null) { patch.title = _requireTitle(fields.title); }
        if (fields.severity != null) { patch.severity = _checkEnum(fields.severity, ITEM_SEVERITIES, 'severity'); }
        if (fields.category != null) { patch.category = _checkEnum(fields.category, ITEM_CATEGORIES, 'category'); }
        if (fields.notes != null) { patch.notes = String(fields.notes); }
        if (fields.next_action != null) {
            const na = String(fields.next_action);
            if (na.length > NEXT_ACTION_MAX) { throw new Error(`next_action exceeds ${NEXT_ACTION_MAX} chars`); }
            patch.next_action = na;
        }
        if (Object.keys(patch).length === 0) { throw new Error('no editable item fields supplied'); }
        return _appendItemUpdate(id, patch);
    }

    // === plans / roadmaps (markdown + frontmatter) =========================

    function _docKey(ns, id) { return ns + '/' + id + '.md'; }

    function _readDoc(ns, id, type) {
        if (!id) { return null; }
        const key = _docKey(ns, id);
        if (!store.exists(key)) { return null; }
        const { data, body } = frontmatter.parse(store.read(key));
        const node = {
            id: data.id || id,
            type: data.type || type,
            parent_id: data.parent_id != null ? data.parent_id : null,
            status: data.status || 'open',
            title: data.title || '',
            body: body || '',
        };
        if (type === 'plan') { node.completion_pct = (data.completion_pct != null) ? data.completion_pct : 0; }
        return node;
    }

    function _writeDoc(ns, node) {
        // Field order is deliberate (stable diffs): id, type, title, parent_id,
        // status, [completion_pct].
        const data = { id: node.id, type: node.type, title: node.title, parent_id: node.parent_id, status: node.status };
        if (node.type === 'plan') { data.completion_pct = (node.completion_pct != null) ? node.completion_pct : 0; }
        store.write(_docKey(ns, node.id), frontmatter.stringify(data, node.body || ''));
        return node;
    }

    function createPlan(opts) {
        opts = opts || {};
        if (opts.parent_id && !getRoadmap(opts.parent_id)) { throw new Error(`no such roadmap: ${opts.parent_id}`); }
        const node = {
            id: ulid(),
            type: 'plan',
            title: _requireTitle(opts.title),
            parent_id: opts.parent_id ? String(opts.parent_id) : null,
            status: _checkEnum(opts.status, NODE_STATUSES, 'status', 'open'),
            completion_pct: 0,
            body: opts.body ? String(opts.body) : '',
        };
        return _writeDoc(PLANS_NS, node);
    }

    function getPlan(id) { return _readDoc(PLANS_NS, id, 'plan'); }

    function listPlans(filter) {
        filter = filter || {};
        const out = [];
        for (const key of store.list(PLANS_NS)) {
            if (!/\.md$/.test(key)) { continue; }
            const id = key.replace(/^.*\//, '').replace(/\.md$/, '');
            const p = getPlan(id);
            if (!p) { continue; }
            if (filter.parent_id !== undefined && (p.parent_id || null) !== (filter.parent_id || null)) { continue; }
            out.push(p);
        }
        return out;
    }

    function updatePlanStatus(id, status) {
        const p = getPlan(id);
        if (!p) { throw new Error(`no such plan: ${id}`); }
        p.status = _checkEnum(status, NODE_STATUSES, 'status');
        return _writeDoc(PLANS_NS, p);
    }

    // Edit a plan's content fields (title, body) in place; id, parent_id,
    // status, and completion_pct are preserved. Status is NOT changed here.
    function updatePlanFields(id, fields) {
        fields = fields || {};
        const p = getPlan(id);
        if (!p) { throw new Error(`no such plan: ${id}`); }
        if (fields.title != null) { p.title = _requireTitle(fields.title); }
        if (fields.body != null) { p.body = String(fields.body); }
        return _writeDoc(PLANS_NS, p);
    }

    function createRoadmap(opts) {
        opts = opts || {};
        const node = {
            id: ulid(),
            type: 'roadmap',
            title: _requireTitle(opts.title),
            parent_id: null,
            status: _checkEnum(opts.status, NODE_STATUSES, 'status', 'open'),
            body: opts.body ? String(opts.body) : '',
        };
        return _writeDoc(ROADMAPS_NS, node);
    }

    function getRoadmap(id) { return _readDoc(ROADMAPS_NS, id, 'roadmap'); }

    function listRoadmaps() {
        const out = [];
        for (const key of store.list(ROADMAPS_NS)) {
            if (!/\.md$/.test(key)) { continue; }
            const id = key.replace(/^.*\//, '').replace(/\.md$/, '');
            const r = getRoadmap(id);
            if (r) { out.push(r); }
        }
        return out;
    }

    function updateRoadmapStatus(id, status) {
        const r = getRoadmap(id);
        if (!r) { throw new Error(`no such roadmap: ${id}`); }
        r.status = _checkEnum(status, NODE_STATUSES, 'status');
        return _writeDoc(ROADMAPS_NS, r);
    }

    // Edit a roadmap's content fields (title, body) in place; id and status are
    // preserved. Status is NOT changed here.
    function updateRoadmapFields(id, fields) {
        fields = fields || {};
        const r = getRoadmap(id);
        if (!r) { throw new Error(`no such roadmap: ${id}`); }
        if (fields.title != null) { r.title = _requireTitle(fields.title); }
        if (fields.body != null) { r.body = String(fields.body); }
        return _writeDoc(ROADMAPS_NS, r);
    }

    // === generic node access + linking =====================================

    function getNode(id) {
        return getItem(id) || getPlan(id) || getRoadmap(id) || null;
    }

    // Link a child to its parent, enforcing the level rules: an item links to a
    // plan (plan_id); a plan links to a roadmap (parent_id). Roadmaps are roots.
    function link(childId, parentId) {
        const child = getNode(childId);
        if (!child) { throw new Error(`no such node: ${childId}`); }
        const parent = getNode(parentId);
        if (!parent) { throw new Error(`no such node: ${parentId}`); }

        if (child.type === 'item') {
            if (parent.type !== 'plan') { throw new Error('an item can only link to a plan'); }
            return _appendItemUpdate(childId, { plan_id: String(parentId) });
        }
        if (child.type === 'plan') {
            if (parent.type !== 'roadmap') { throw new Error('a plan can only link to a roadmap'); }
            child.parent_id = String(parentId);
            return _writeDoc(PLANS_NS, child);
        }
        throw new Error('a roadmap has no parent to link to');
    }

    // === tree assembly + deterministic roll-up =============================

    function _statusCounts(nodes) {
        const counts = {};
        for (const n of nodes) { counts[n.status] = (counts[n.status] || 0) + 1; }
        return counts;
    }

    // Deterministic count-based completion (D3): shipped / (countable), where
    // countable excludes dropped items (abandoned, not pending). Parked items
    // stay in the denominator (deferred work is still incomplete). A plan with
    // no countable items is 0, never NaN.
    //
    // _completionOf works from an already-resolved item list so a caller that has
    // grouped items once (tree, rollupAll, the work-tree injection) does not pay a
    // fresh full-log read+resolve per plan -- that was an O(plans x items) cost.
    function _completionOf(items) {
        const countable = items.filter(i => i.status !== 'dropped');
        if (countable.length === 0) { return 0; }
        const shipped = countable.filter(i => i.status === 'shipped').length;
        return Math.round(100 * shipped / countable.length);
    }

    function computePlanCompletion(planId) {
        return _completionOf(listItems({ plan_id: planId }));
    }

    // Group every resolved item by plan_id in a single pass, so callers that need
    // per-plan item lists read and replay the log once instead of once per plan.
    function _itemsByPlan() {
        const byPlan = new Map();
        for (const it of listItems()) {
            if (!it.plan_id) { continue; }
            if (!byPlan.has(it.plan_id)) { byPlan.set(it.plan_id, []); }
            byPlan.get(it.plan_id).push(it);
        }
        return byPlan;
    }

    function rollupPlan(planId) {
        const p = getPlan(planId);
        if (!p) { throw new Error(`no such plan: ${planId}`); }
        p.completion_pct = computePlanCompletion(planId);
        _writeDoc(PLANS_NS, p);
        return p.completion_pct;
    }

    function rollupAll() {
        // Read+group items once, then compute every plan's completion from its
        // group (not a fresh log read per plan), and persist.
        const byPlan = _itemsByPlan();
        const rolled = listPlans().map(p => {
            const pct = _completionOf(byPlan.get(p.id) || []);
            p.completion_pct = pct;
            _writeDoc(PLANS_NS, p);
            return { id: p.id, completion_pct: pct };
        });
        // Bound the append-only item log: when its event history has grown well
        // beyond the resolved item count, collapse it to one line per item.
        maybeCompactItems();
        return rolled;
    }

    // Collapse the append-only items log to one resolved 'create' line per item,
    // dropping superseded create/update history. The resolved view is unchanged
    // (a single create replays to the same item), so this is loss-free; it just
    // bounds replay cost and file growth. Atomic via the adapter's write.
    function compactItems() {
        const entries = _readItemEntries();
        const items = _resolveItems(entries);
        const lines = items.map((it) => {
            const e = Object.assign({}, it);
            e.kind = 'create';   // collapse this item's history to one create
            return JSON.stringify(e) + '\n';
        });
        store.write(ITEMS_KEY, lines.join(''));
        return { entriesBefore: entries.length, items: items.length };
    }

    // Compact only when the log has bloated past a small margin over the live
    // item count, so steady status churn does not rewrite the file every time.
    function maybeCompactItems() {
        const entries = _readItemEntries();
        const items = _resolveItems(entries);
        if (entries.length > items.length * 2 + 8) { compactItems(); }
        return false;
    }

    // Report broken parent links across the tree (D3: a link-integrity check
    // runs in the rollup path). An item whose plan_id has no plan, or a plan
    // whose parent_id has no roadmap, is dangling. Reports only -- never
    // auto-deletes or auto-reparents. Returns [{ id, type, dangling_ref }].
    function checkLinkIntegrity() {
        const planIds = new Set(listPlans().map(p => p.id));
        const roadmapIds = new Set(listRoadmaps().map(r => r.id));
        const broken = [];
        for (const it of listItems()) {
            if (it.plan_id && !planIds.has(it.plan_id)) {
                broken.push({ id: it.id, type: 'item', dangling_ref: it.plan_id });
            }
        }
        for (const p of listPlans()) {
            if (p.parent_id && !roadmapIds.has(p.parent_id)) {
                broken.push({ id: p.id, type: 'plan', dangling_ref: p.parent_id });
            }
        }
        return broken;
    }

    // Assemble the roadmap -> plan -> item tree. Plan completion is computed live
    // so the tree is always current even if a plan's persisted completion_pct is
    // stale. Roadmaps carry child status COUNTS only, never a computed health
    // number (D3: roadmap health stays narrative). Each plan node carries its
    // prose `body`; each item node carries its links (plan_id, roadmap_id) and
    // prose (severity, notes, next_action) so a consumer can act on a leaf from
    // the tree alone. With opts.roadmap_id, return just that subtree; otherwise
    // also surface unparented plans, loose items, and orphaned items (a plan_id
    // that points at a missing plan -- never silently dropped). With opts.status
    // (a status or array), the emitted item lists are narrowed to those statuses
    // while completion and the status counts still reflect every item.
    function tree(opts) {
        opts = opts || {};

        // Optional status filter: narrows the items EMITTED in the output (and
        // the loose/orphaned buckets) without changing completion or the status
        // COUNTS, which stay computed from every item so the view never lies
        // about how much work exists. Accepts a status string or an array.
        const statusFilter = (opts.status == null || opts.status === '')
            ? null : new Set([].concat(opts.status).map(String));
        const passes = (i) => !statusFilter || statusFilter.has(i.status);

        const plans = listPlans();
        const planIds = new Set(plans.map(p => p.id));

        // plan_id -> parent roadmap id, so an item can carry a denormalized
        // roadmap_id (its plan's parent). A plan with no parent, or an item with
        // no plan, resolves to null.
        const planRoadmap = new Map();
        for (const p of plans) { planRoadmap.set(p.id, p.parent_id || null); }

        // The emitted item shape. Beyond the display basics (title/status/
        // category) it carries the fields a consumer needs to act on a leaf:
        // its links (plan_id, roadmap_id) and its prose (notes, next_action,
        // severity). roadmap_id is the item's plan's parent roadmap, or null.
        function itemNode(i) {
            const node = {
                id: i.id, title: i.title, status: i.status, category: i.category,
                plan_id: i.plan_id || null,
                roadmap_id: i.plan_id ? (planRoadmap.get(i.plan_id) || null) : null,
            };
            if (i.severity != null) { node.severity = i.severity; }
            if (i.notes != null) { node.notes = i.notes; }
            if (i.next_action != null) { node.next_action = i.next_action; }
            return node;
        }

        const itemsByPlan = new Map();
        const looseItems = [];
        const orphanedItems = [];
        for (const it of listItems()) {
            if (it.plan_id && planIds.has(it.plan_id)) {
                if (!itemsByPlan.has(it.plan_id)) { itemsByPlan.set(it.plan_id, []); }
                itemsByPlan.get(it.plan_id).push(it);
            } else if (it.plan_id) {
                orphanedItems.push(it);   // plan_id set but the plan is gone -- dangling
            } else {
                looseItems.push(it);
            }
        }

        function planNode(p) {
            const items = itemsByPlan.get(p.id) || [];
            return {
                id: p.id, type: 'plan', title: p.title, status: p.status,
                body: p.body || '',
                completion_pct: _completionOf(items),   // from the grouped list; no per-plan re-read
                itemStatusCounts: _statusCounts(items), // counts reflect ALL items, not the filtered view
                items: items.filter(passes).map(itemNode),
            };
        }

        const plansByRoadmap = new Map();
        const unparentedPlans = [];
        for (const p of plans) {
            if (p.parent_id) {
                if (!plansByRoadmap.has(p.parent_id)) { plansByRoadmap.set(p.parent_id, []); }
                plansByRoadmap.get(p.parent_id).push(p);
            } else { unparentedPlans.push(p); }
        }

        let roadmaps = listRoadmaps();
        if (opts.roadmap_id) { roadmaps = roadmaps.filter(r => r.id === opts.roadmap_id); }

        const roadmapNodes = roadmaps.map(r => {
            const childPlans = plansByRoadmap.get(r.id) || [];
            return {
                id: r.id, type: 'roadmap', title: r.title, status: r.status,
                planStatusCounts: _statusCounts(childPlans),
                plans: childPlans.map(planNode),
            };
        });

        const result = { roadmaps: roadmapNodes };
        if (!opts.roadmap_id) {
            result.unparentedPlans = unparentedPlans.map(planNode);
            result.looseItems = looseItems.filter(passes).map(itemNode);
            // Orphans keep their dangling plan_id (itemNode emits it) so the
            // broken link stays visible; roadmap_id resolves to null.
            result.orphanedItems = orphanedItems.filter(passes).map(itemNode);
        }
        return result;
    }

    // Build the sessionStart "active work" injection: in-flight/open plans (with
    // live completion + open-item counts) and open failure items awaiting triage.
    // This is the surfacing half of the loop -- a session sees what work is in
    // flight and which captured failures still need a decision. Returns null when
    // there is nothing active (most early sessions), so it injects nothing.
    function buildWorkTreeInjection(opts) {
        opts = opts || {};
        const maxPlans = opts.maxPlans || 8;
        const maxFailures = opts.maxFailures || 5;
        const charCap = opts.charCap || 2000;
        const active = ['open', 'in-flight'];

        const plans = listPlans().filter(p => active.indexOf(p.status) !== -1);
        // in-flight before merely-open, so the active work leads.
        plans.sort((a, b) => (a.status === 'in-flight' ? 0 : 1) - (b.status === 'in-flight' ? 0 : 1));

        // Read+group the item log once for every plan's completion + open count.
        const byPlan = _itemsByPlan();
        const allItems = listItems();

        const planLines = [];
        for (const p of plans.slice(0, maxPlans)) {
            const planItems = byPlan.get(p.id) || [];
            const pct = _completionOf(planItems);
            const openItems = planItems.filter(i => active.indexOf(i.status) !== -1).length;
            const rm = p.parent_id ? getRoadmap(p.parent_id) : null;
            planLines.push(`- [${String(pct).padStart(3)}%] ${p.title}` +
                (rm ? ` (roadmap: ${rm.title})` : '') + ` -- ${openItems} open item(s) [${p.id}]`);
        }

        const failures = allItems.filter(i => i.status === 'open' && i.category === 'failure');

        if (planLines.length === 0 && failures.length === 0) { return null; }

        const sections = ['# Active work composition'];
        if (planLines.length) { sections.push('\nIn-flight / open plans:\n' + planLines.join('\n')); }
        if (failures.length) {
            const failLines = failures.slice(0, maxFailures).map(f => `- ${f.title} [${f.id}]`);
            let block = `\nFailures awaiting triage (${failures.length} open):\n` + failLines.join('\n');
            if (failures.length > maxFailures) { block += `\n  ...and ${failures.length - maxFailures} more`; }
            block += '\nTriage with compose_status <id> shipped|dropped|in-flight.';
            sections.push(block);
        }

        let text = sections.join('\n');
        if (text.length > charCap) { text = text.slice(0, charCap - 16).trim() + '\n\n_..truncated._'; }
        return { text: text, planCount: planLines.length, failureCount: failures.length };
    }

    return {
        ITEM_STATUSES, NODE_STATUSES, ITEM_CATEGORIES, ITEM_SEVERITIES,
        createItem, listItems, getItem, updateItemStatus, updateItem,
        createPlan, getPlan, listPlans, updatePlanStatus, updatePlanFields,
        createRoadmap, getRoadmap, listRoadmaps, updateRoadmapStatus, updateRoadmapFields,
        getNode, link,
        computePlanCompletion, rollupPlan, rollupAll, compactItems, checkLinkIntegrity, tree,
        buildWorkTreeInjection,
    };
}

module.exports = { createCompose, ITEM_STATUSES, NODE_STATUSES, ITEM_CATEGORIES };
