'use strict';

// context.js -- build the per-dispatch context handed to every hook handler.
//
// One context is built per dispatch and shared by all handlers for that event,
// so the adapter stack is constructed once and git is resolved at most once.
// Git resolution is LAZY (memoized behind ctx.gitInfo()): postToolUse fires after
// every tool call, and its only handler (findings-consult) never needs git, so a
// dispatch on that event must not spawn a git subprocess.

const path = require('path');
const { execSync } = require('child_process');
const { buildStack } = require('../mcp-servers/journal/dataRoot');
const { createCompose } = require('../mcp-servers/compose/compose');
const sessionState = require('../mcp-servers/journal/sessionState');

function buildContext(opts) {
    opts = opts || {};
    const cwd = opts.cwd || process.env.COPILOT_FINDINGS_CWD || process.cwd();
    const sessionId = String(opts.sessionId || process.env.COPILOT_SESSION_ID || '');

    let _git = null;
    function _run(args) {
        try {
            return execSync('git ' + args, { cwd: cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
        } catch (_) { return ''; }
    }
    function gitInfo() {
        if (_git) { return _git; }
        // Testing seam: when the resolution is supplied via env, skip the git
        // subprocess entirely (mirrors COPILOT_SESSION_STATE_ROOT for the
        // session-state reader). Keeps the dispatcher tests git-free and fast.
        if (process.env.CRAFT_GIT_BRANCH) {
            const root = process.env.CRAFT_GIT_ROOT || cwd;
            _git = {
                branch: process.env.CRAFT_GIT_BRANCH,
                gitRoot: root,
                repo: process.env.CRAFT_GIT_REPO || path.basename(root),
            };
            return _git;
        }
        const branch = _run('rev-parse --abbrev-ref HEAD');
        const gitRoot = _run('rev-parse --show-toplevel');
        _git = {
            branch: (branch && branch !== 'HEAD') ? branch : '',
            gitRoot: gitRoot || '',
            repo: gitRoot ? path.basename(gitRoot) : '',
        };
        return _git;
    }

    const stack = buildStack();
    return {
        sessionId: sessionId,
        cwd: cwd,
        eventType: String(opts.eventType || ''),
        stack: stack,
        compose: createCompose(stack.store),
        sessionState: sessionState,
        gitInfo: gitInfo,
    };
}

module.exports = { buildContext };
