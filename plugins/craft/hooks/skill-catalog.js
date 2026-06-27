'use strict';

// skill-catalog.js -- the single source of truth for craft's skill propagation.
//
// craft ships strong skills, but skills are offered to the agent only as passive
// name+description metadata and fire on phrasing the agent happens to match. The
// propagation layer makes that active: a sessionStart catalog so every session
// SEES the skills and the app-scale pipeline, and a userPromptSubmitted router
// that reads the actual prompt and names the skill (or the whole chain) to load.
//
// This module is pure data + matching logic so it is unit-testable with no IO.
// The handlers (skill-catalog-injector, skill-router) are thin wrappers over it.

// Each entry: a skill (or the app-PM pipeline) with the intents that should route
// to it. `triggers` are lower-cased substring/word cues matched against the prompt.
// `directive` is the terse, high-signal line injected when the intent matches.
// Order matters: the first matching entry whose `lead` is true wins as the lead
// route; additional matches are appended as secondary suggestions.
const CATALOG = [
    {
        id: 'app-pm',
        lead: true,
        title: 'App-scale build (the PM pipeline)',
        triggers: [
            'build an app', 'build a new app', 'new application', 'build an application',
            'write an app', 'create an app', 'make an app', 'whole app', 'entire app',
            'application from scratch', 'greenfield', 'feature-complete', 'feature complete',
            'competitive with', 'best-in-class', 'best in class', 'mvp', 'product spec',
            'spec out', 'scope this app', 'scope the app', 'spec an app',
        ],
        directive:
            'This looks like application-scale work. Do NOT one-pass it. Run the craft app-PM pipeline: '
            + 'clarify-intent -> product-discovery (validate the problem + the four risks + the riskiest '
            + 'assumption) -> research -> product-spec (feature-complete + competitive matrix + wedge) '
            + '+ uiux-design (flows, screens, wireframes, design system, a11y) -> app-decompose (one holistic '
            + 'sequenced roadmap) -> drive (tested slices, coherence-checked back to the spec) -> product-quality '
            + '(assess the assembled product against the bar, rank gaps back into app-decompose) -> '
            + 'release-readiness (run the validation plan, go/no-go). Scope and design before code; judge the '
            + 'assembled product after.',
    },
    {
        id: 'product-discovery',
        title: 'Product discovery (validate before building)',
        triggers: [
            'product discovery', 'is this worth building', 'should we build', 'validate the idea',
            'validate the problem', 'what problem are we solving', 'who is this for', 'opportunity assessment',
            'four risks', 'four product risks', 'job to be done', 'jobs to be done', 'riskiest assumption',
            'is this the right thing',
        ],
        directive:
            'Use the product-discovery skill (upstream of product-spec): frame the problem as a job to be done, '
            + 'read the four product risks (value, usability, feasibility, viability), name the riskiest '
            + 'assumption + its cheapest test, and define success as outcomes. Validate the problem before the spec.',
    },
    {
        id: 'product-spec',
        title: 'Product / behavior spec',
        triggers: [
            'feature surface', 'what features', 'table stakes', 'table-stakes', 'competitive analysis',
            'competitor', 'incumbent', 'feature matrix', 'is this feature-complete', 'product requirements',
        ],
        directive:
            'Use the product-spec skill: identify the app type + best-in-class incumbents, research the full '
            + 'category feature surface, build a sourced completeness/competitive matrix, derive the wedge.',
    },
    {
        id: 'uiux-design',
        title: 'UI / UX design',
        triggers: [
            'design the ui', 'design the ux', 'ui/ux', 'user flow', 'user flows', 'wireframe', 'wireframes',
            'screen inventory', 'interaction model', 'design system', 'make it usable', 'how should it look',
            'visual design', 'accessibility', 'a11y', 'mockup',
        ],
        directive:
            'Use the uiux-design skill: bench incumbents UX, design jobs/flows, a screen inventory, the '
            + 'interaction model, wireframes, a design system, and accessibility. Canonical output is the '
            + 'tool-agnostic design spec (Figma render only under an allowlisted host).',
    },
    {
        id: 'app-decompose',
        title: 'Holistic decomposition',
        triggers: [
            'decompose the app', 'roadmap', 'build order', 'plan the whole build', 'sequence the build',
            'break the whole', 'holistic plan', 'application roadmap', 'what order to build',
        ],
        directive:
            'Use the app-decompose skill (NOT the lightweight decompose) when a validated spec exists: cut the '
            + 'whole spec into small vertical parts, riskiest first, each traceable to a feature + UX surface.',
    },
    {
        id: 'drive',
        title: 'Plan-anchored execution',
        triggers: [
            'drive the build', 'execute the roadmap', 'build from the plan', 'work the roadmap',
            'next part', 'keep the build coherent',
        ],
        directive:
            'Use the drive skill: pull the next roadmap part, build it in tested vertical slices '
            + '(implementation), then coherence-check the result back to the spec + design before moving on.',
    },
    {
        id: 'product-quality',
        title: 'Product quality (assess the assembled product, rank gaps)',
        triggers: [
            'product quality', 'is the product good', 'is it actually good', 'what should we fix next',
            'what to improve', 'quality assessment', 'quality pass', 'assess the product', 'assess the build',
            'rank the gaps', 'prioritize the backlog', 'what is missing', 'holistic quality',
        ],
        directive:
            'Use the product-quality skill (after slices land): define the quality bar first '
            + '(goals-signals-metrics + the product-spec matrix + the uiux bar + the spec validation plan), score '
            + 'the assembled product, find gaps by importance vs satisfaction, rank by impact over effort, and feed '
            + 'the ranked list back into app-decompose as the next wave.',
    },
    {
        id: 'release-readiness',
        title: 'Release readiness (go/no-go)',
        triggers: [
            'release readiness', 'ready to ship', 'launch checklist', 'go/no-go', 'go no-go', 'launch gate',
            'readiness review', 'production readiness', 'is it ready to ship', 'ship decision',
            'definition of done for the whole',
        ],
        directive:
            'Use the release-readiness skill (terminal gate): run the spec validation plan, check the launch bar '
            + '(success measures, accessibility, security + privacy/no-PII, docs, rollout/rollback) scaled to the '
            + 'build stage, render a readiness scorecard + a single go/no-go, and route a no-go back through '
            + 'product-quality.',
    },
    {
        id: 'research',
        title: 'Grounded research',
        triggers: [
            'research', 'what causes', 'why did', 'is it true', 'investigate', 'look into', 'find out why',
            'dig into', 'trade-offs', 'trade offs', 'what are the options', 'compare ', 'verify whether',
        ],
        directive:
            'Use the research skill: ground + triangulate (2+ sources, quoted evidence + URL per load-bearing '
            + 'claim), surface a labeled hypothesis space, deliver a decision-ready ranked answer. No guessing.',
    },
    {
        id: 'experiment',
        title: 'Empirical experiment',
        triggers: [
            'experiment whether', 'a/b', 'ab test', 'measure whether', 'is x faster', 'benchmark whether',
            'pre-register', 'prove empirically', 'which is faster',
        ],
        directive:
            'Use the experiment skill: pre-register the hypothesis + decision rule BEFORE data, run a real '
            + 'comparison, decide by the rule (no goalpost moving), honor the null.',
    },
    {
        id: 'clarify-intent',
        title: 'Clarify intent (Socratic)',
        triggers: [
            'grill me', 'interrogate me', 'pressure-test', 'pressure test', 'challenge my assumptions',
            'am i solving the right problem', 'is this xy problem', 'clarify my intent', 'step back',
            'what am i really trying',
        ],
        directive:
            'Use the clarify-intent skill: name the unexamined assumption, then one Socratic question at a time '
            + 'until the real goal, what success looks like, and the next concrete move are all explicit.',
    },
    {
        id: 'writing-spec',
        title: 'Reviewable spec',
        triggers: [
            'write a spec', 'design doc', 'rfc', 'spec template', 'design proposal', 'spec for review',
        ],
        directive:
            'Use the writing-spec skill: the reviewable section spine (problem, goals/non-goals, proposal with '
            + 'a diagram, alternatives-with-why, risks, validation, open questions); run writing-documentation on it.',
    },
    {
        id: 'implementation',
        title: 'Disciplined single-change build',
        triggers: [
            'implement', 'build this', 'add a feature', 'add functionality', 'write the code', 'tdd',
            'ship a change', 'code this up',
        ],
        directive:
            'Use the implementation skill: aim (align on a testable definition of done), design only when there '
            + 'is a real choice, then deliver in thin tested vertical slices (test-first, never accumulate '
            + 'untested code).',
    },
    {
        id: 'writing-documentation',
        title: 'Long-form prose discipline',
        triggers: [
            'write documentation', 'write docs', 'readme', 'long-form', 'technical writing', 'write the guide',
        ],
        directive:
            'Use the writing-documentation skill: one doc shape, lead with the verdict, no AI-isms, no em-dashes; '
            + 'run the self-review script before publishing.',
    },
];

function _disableValue(name) {
    return String(process.env[name] || '').trim() === '1';
}

// Normalize a prompt to a lower-cased haystack for trigger matching.
function _normalize(text) {
    return String(text == null ? '' : text).toLowerCase();
}

// Find every catalog entry whose triggers match the prompt, preserving catalog
// order. The lead route is the first match flagged `lead`, else the first match.
function matchPrompt(text) {
    const hay = _normalize(text);
    if (!hay.trim()) { return []; }
    const matches = [];
    for (const entry of CATALOG) {
        if (entry.triggers.some(t => hay.indexOf(t) !== -1)) {
            matches.push(entry);
        }
    }
    return matches;
}

// Build the per-prompt routing directive injected at userPromptSubmitted.
// Returns null when nothing matches (no injection, no noise). The lead route is
// stated first and in full; up to two secondary routes are named compactly.
function buildPromptDirective(text) {
    const matches = matchPrompt(text);
    if (matches.length === 0) { return null; }

    const leadIdx = matches.findIndex(m => m.lead);
    const lead = leadIdx >= 0 ? matches[leadIdx] : matches[0];
    const others = matches.filter(m => m.id !== lead.id).slice(0, 2);

    const lines = ['[craft] ' + lead.directive];
    if (others.length) {
        lines.push('Also relevant: ' + others.map(o => o.id + ' (' + o.title + ')').join('; ') + '.');
    }
    return lines.join('\n');
}

// Build the always-on sessionStart catalog directive: one compact block that
// tells the session what craft offers and, above all, the app-scale pipeline,
// so the skills are propagated even on a cold repo with no journal/compose data.
function buildCatalogDirective() {
    const lines = [];
    lines.push('[craft] Engineering- and product-discipline skills are available. Match the work to a skill and '
        + 'load it before improvising:');
    lines.push('- Application-scale build: run the PM pipeline in order -- clarify-intent -> product-discovery -> '
        + 'research -> product-spec + uiux-design -> app-decompose -> drive -> product-quality -> '
        + 'release-readiness. Scope and design heavily BEFORE code; assess the assembled product against a bar '
        + 'AFTER, and feed ranked gaps back into the roadmap. Do not one-pass an app.');
    lines.push('- Single change: implementation (aim -> design -> tested slices). Question first: clarify-intent. '
        + 'Find out: research. Prove empirically: experiment.');
    lines.push('- Structure work: app-decompose (whole validated spec) or decompose (one level at a time). '
        + 'Reviewable spec: writing-spec. Prose: writing-documentation.');
    lines.push('The host pre-loads each skill\u2019s description; invoke the matching one rather than working '
        + 'from memory.');
    return lines.join('\n');
}

module.exports = {
    CATALOG,
    matchPrompt,
    buildPromptDirective,
    buildCatalogDirective,
    _disableValue,
    _normalize,
};
