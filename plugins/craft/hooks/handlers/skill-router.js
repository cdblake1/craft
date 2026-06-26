'use strict';

// skill-router handler (userPromptSubmitted) -- the per-prompt steering lever.
// Copilot CLI fires userPromptSubmitted with the user's prompt (command hooks
// receive it as `initial_prompt`); the handler matches the prompt against the
// skill catalog and injects a terse directive naming the skill (or the whole
// app-PM chain) to load. This is state+phrase-matched and fires on EVERY prompt,
// not just at session start, which is what makes propagation aggressive.
//
// It injects only on a confident match (else null: no noise), and must never
// throw or fail the prompt.

const { buildPromptDirective } = require('../skill-catalog');

// Command-hook payloads carry the prompt as initial_prompt (snake_case); the
// in-process / Claude shapes use initialPrompt. Accept both, plus a few fallbacks.
const PROMPT_FIELDS = ['initial_prompt', 'initialPrompt', 'prompt', 'userPrompt', 'message', 'content'];

function _disabled() {
    if (String(process.env.CRAFT_PROPAGATE_DISABLE || '').trim() === '1') { return true; }
    if (String(process.env.CRAFT_ROUTER_DISABLE || '').trim() === '1') { return true; }
    return false;
}

function _extractPrompt(payload) {
    if (!payload || typeof payload !== 'object') { return ''; }
    for (const f of PROMPT_FIELDS) {
        if (payload[f] != null && String(payload[f]).trim() !== '') { return String(payload[f]); }
    }
    return '';
}

module.exports = {
    id: 'skill-router',
    event: 'userPromptSubmitted',
    _extractPrompt: _extractPrompt,

    applies(payload, ctx) {
        if (_disabled()) { return false; }
        return _extractPrompt(payload).trim() !== '';
    },

    run(payload, ctx) {
        try {
            const directive = buildPromptDirective(_extractPrompt(payload));
            if (directive && directive.trim()) { return { additionalContext: directive }; }
        } catch (_) { /* userPromptSubmitted handlers must never fail the prompt */ }
        return null;
    },
};
