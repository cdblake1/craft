'use strict';

// host.js -- detect which agent host craft is running under, so the rest of the
// plugin can speak each host's hook I/O contract and keep data in a per-host
// root. craft is host-agnostic: the dispatcher, handlers, and storage adapter
// are shared; only the thin edges (hook output envelope, default data dir) vary.
//
// Resolution:
//   1. $CRAFT_HOST ('claude' | 'copilot') -- explicit override, wins.
//   2. Claude Code sets CLAUDE_PROJECT_DIR (and CLAUDE_CODE_REMOTE on the web)
//      for hook commands; Copilot does not. Either => 'claude'.
//   3. Otherwise 'copilot' (the original default; preserves existing behavior).
//
// Note: CLAUDE_PLUGIN_ROOT alone is NOT a reliable signal -- the Copilot hook
// registration references ${CLAUDE_PLUGIN_ROOT} too, so it can be set under
// either host. CLAUDE_PROJECT_DIR is the Claude-only discriminator.

const os = require('os');
const path = require('path');

function host() {
    const explicit = String(process.env.CRAFT_HOST || '').trim().toLowerCase();
    if (explicit === 'claude' || explicit === 'copilot') { return explicit; }
    if (process.env.CLAUDE_PROJECT_DIR || process.env.CLAUDE_CODE_REMOTE) { return 'claude'; }
    return 'copilot';
}

// The per-host home directory craft data lives under (~/.claude or ~/.copilot).
// Per the design, craft data is per-host; this is the one place that choice is
// made. Specific roots (CRAFT_DATA_ROOT, COPILOT_SESSION_STATE_ROOT, etc.) still
// override their own paths upstream of this helper.
function hostHome() {
    return path.join(os.homedir(), host() === 'claude' ? '.claude' : '.copilot');
}

module.exports = { host, hostHome };
