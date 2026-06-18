'use strict';

// sessionState.js -- read-only access to the on-disk Copilot session-state store
// at ~/.copilot/session-state/<id>/. Used to answer "what were we working on
// last?" for the current repo/branch. Zero deps.
//
// Each session dir has: workspace.yaml (flat key:value with cwd/git_root/
// repository/branch/name/updated_at), checkpoints/index.md (a | # | Title | File |
// table) + checkpoints/NNN-*.md (each wraps a rich recap in <overview>...</overview>),
// and plan.md. The cloud session store is richer but is NOT reachable from a
// local hook, so this reader is on-disk only.
//
// Path resolution:
//   1. $COPILOT_SESSION_STATE_ROOT env var (used by tests)
//   2. <per-host home>/session-state (~/.claude or ~/.copilot; see lib/host.js)

const fs = require('fs');
const path = require('path');
const { hostHome } = require('../../lib/host');

function defaultSessionStateRoot() {
    if (process.env.COPILOT_SESSION_STATE_ROOT) {
        return process.env.COPILOT_SESSION_STATE_ROOT;
    }
    return path.join(hostHome(), 'session-state');
}

// workspace.yaml is flat "key: value" (no nesting, no lists). Minimal parser:
// good enough for the handful of scalar fields we read, no YAML dep.
function parseWorkspaceYaml(text) {
    const out = {};
    if (!text) { return out; }
    for (const line of String(text).split(/\r?\n/)) {
        const m = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
        if (!m) { continue; }
        let v = m[2].trim();
        if ((v.startsWith('"') && v.endsWith('"')) ||
            (v.startsWith("'") && v.endsWith("'"))) {
            v = v.substring(1, v.length - 1);
        }
        out[m[1]] = v;
    }
    return out;
}

// Normalize a filesystem path for comparison: forward slashes, no trailing
// slash, lowercased (Windows paths are case-insensitive; this also tolerates
// drive-letter case differences between cwd and git_root).
function _normPath(p) {
    return String(p || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

// Collapse a possibly-messy string (literal \r\n escape sequences, real control
// whitespace, runs of spaces) into a single clean line, capped. Session names
// and checkpoint overviews from automation/eval runs carry escaped newlines and
// prompt blobs; this keeps them from rendering as a wall of garbage.
function _clean(s, cap) {
    let t = String(s || '');
    t = t.replace(/\\[rnt]/g, ' ');        // literal "\r" "\n" "\t" escape sequences
    t = t.replace(/[\r\n\t\f\v]+/g, ' ');  // actual control whitespace
    t = t.replace(/\s{2,}/g, ' ').trim();
    if (cap && t.length > cap) { t = t.substring(0, cap - 3).trim() + '...'; }
    return t;
}

function _mtimeMs(p) {
    try { return fs.statSync(p).mtimeMs; } catch (_) { return 0; }
}

function _listSessionDirs(root) {
    try {
        return fs.readdirSync(root, { withFileTypes: true })
            .filter(e => e.isDirectory())
            .map(e => path.join(root, e.name));
    } catch (_) { return []; }
}

// Find the most recent prior session whose git_root (preferred) or cwd matches,
// excluding excludeSessionId. Returns a descriptor or null.
function findLastSession(opts) {
    opts = opts || {};
    const root = opts.rootOverride || defaultSessionStateRoot();
    const wantRoot = _normPath(opts.gitRoot);
    const wantCwd = _normPath(opts.cwd);
    const exclude = String(opts.excludeSessionId || '');
    if (!wantRoot && !wantCwd) { return null; }

    const cands = [];
    for (const dir of _listSessionDirs(root)) {
        let ws;
        try { ws = parseWorkspaceYaml(fs.readFileSync(path.join(dir, 'workspace.yaml'), 'utf8')); }
        catch (_) { continue; }
        const sid = ws.id || path.basename(dir);
        if (exclude && sid === exclude) { continue; }

        const gr = _normPath(ws.git_root);
        const cw = _normPath(ws.cwd);
        let match = false;
        if (wantRoot && gr && gr === wantRoot) { match = true; }
        else if (wantCwd && cw && cw === wantCwd) { match = true; }
        if (!match) { continue; }

        cands.push({
            sessionId:    sid,
            name:         ws.name || '',
            branch:       ws.branch || '',
            repository:   ws.repository || '',
            gitRoot:      ws.git_root || '',
            cwd:          ws.cwd || '',
            updatedAt:    ws.updated_at || ws.created_at || '',
            dir:          dir,
            hasCheckpoint: _latestCheckpoint(dir) != null,
        });
    }
    if (cands.length === 0) { return null; }

    cands.sort((a, b) => {
        // Prefer sessions that produced a checkpoint (a real recap) over the
        // automation/eval sub-sessions that never checkpoint and whose name is
        // a prompt blob. Within each group, newest by updated_at (ISO 8601 sorts
        // lexically); break ties on directory mtime.
        if (a.hasCheckpoint !== b.hasCheckpoint) { return a.hasCheckpoint ? -1 : 1; }
        const c = String(b.updatedAt).localeCompare(String(a.updatedAt));
        if (c !== 0) { return c; }
        return _mtimeMs(b.dir) - _mtimeMs(a.dir);
    });
    return cands[0];
}

// Parse checkpoints/index.md -> the highest-numbered { num, title, file }.
function _latestCheckpoint(sessionDir) {
    let text;
    try { text = fs.readFileSync(path.join(sessionDir, 'checkpoints', 'index.md'), 'utf8'); }
    catch (_) { return null; }
    let best = null;
    for (const line of text.split(/\r?\n/)) {
        const m = line.match(/^\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*([^|]+?)\s*\|\s*$/);
        if (!m) { continue; }
        const num = parseInt(m[1], 10);
        if (!isFinite(num)) { continue; }
        if (!best || num > best.num) {
            best = { num: num, title: m[2].trim(), file: m[3].trim() };
        }
    }
    return best;
}

// Pull the recap text out of a checkpoint body. Checkpoint files wrap the
// human-readable summary in <overview>...</overview>; fall back to the first
// non-empty paragraph (tags stripped) when that tag is absent.
function extractOverview(text) {
    if (!text) { return ''; }
    const m = text.match(/<overview>\s*([\s\S]*?)\s*<\/overview>/i);
    if (m) { return m[1].trim(); }
    const stripped = text.replace(/<\/?[a-z_]+>/gi, '').trim();
    const para = stripped.split(/\n\s*\n/).find(p => p.trim().length > 0);
    return para ? para.trim() : '';
}

// Compose the recap for a specific session dir. Returns
// { title, overview, sourceFile } or null.
function getSessionRecap(sessionDir) {
    const cp = _latestCheckpoint(sessionDir);
    if (cp) {
        const cpPath = path.join(sessionDir, 'checkpoints', cp.file);
        let body = '';
        try { body = fs.readFileSync(cpPath, 'utf8'); } catch (_) { /* fall through */ }
        const overview = extractOverview(body);
        if (cp.title || overview) {
            return { title: cp.title || '', overview: overview, sourceFile: cpPath };
        }
    }
    // Fallback: plan.md (Status/Approach head).
    const planPath = path.join(sessionDir, 'plan.md');
    let plan = '';
    try { plan = fs.readFileSync(planPath, 'utf8'); } catch (_) { /* none */ }
    if (plan) {
        const titleMatch = plan.match(/^#\s+(.+)$/m);
        const overview = extractOverview(plan) ||
            plan.split(/\r?\n/).filter(l => l.trim()).slice(0, 8).join('\n').trim();
        return { title: titleMatch ? titleMatch[1].trim() : '', overview: overview, sourceFile: planPath };
    }
    return null;
}

// High-level: recap for the last matching session. Sanitizes the title +
// overview (real session-state carries escaped newlines and prompt blobs).
// Returns { name, title, overview, updatedAt, sessionId, branch } or null.
function buildLastSessionRecap(opts) {
    const last = findLastSession(opts);
    if (!last) { return null; }
    const recap = getSessionRecap(last.dir) || { title: '', overview: '' };
    const cap = (opts && opts.recapCap) ? opts.recapCap : 1400;
    const title = _clean(recap.title, 120) || _clean(last.name, 120);
    const overview = _clean(recap.overview, cap);
    if (!title && !overview) { return null; }
    return {
        name:      _clean(last.name, 120),
        title:     title,
        overview:  overview,
        updatedAt: last.updatedAt,
        sessionId: last.sessionId,
        branch:    last.branch,
    };
}

// Resolve the on-disk directory for a session id (honors the test override).
function sessionDir(sessionId, rootOverride) {
    if (!sessionId) { return null; }
    return path.join(rootOverride || defaultSessionStateRoot(), sessionId);
}

module.exports = {
    defaultSessionStateRoot,
    parseWorkspaceYaml,
    findLastSession,
    extractOverview,
    getSessionRecap,
    buildLastSessionRecap,
    sessionDir,
};
