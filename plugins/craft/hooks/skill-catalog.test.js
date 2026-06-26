'use strict';

// skill-catalog.test.js -- unit tests for the propagation logic (pure, no IO).
// Run: node skill-catalog.test.js

const assert = require('assert');
const {
    CATALOG, matchPrompt, buildPromptDirective, buildCatalogDirective,
} = require('./skill-catalog');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); process.stdout.write(`PASS  ${name}\n`); passed++; }
    catch (e) { process.stdout.write(`FAIL  ${name}\n        ${e.message}\n`); failed++; }
}

// === catalog shape ==========================================================

test('every catalog entry has id, title, triggers[], directive', () => {
    for (const e of CATALOG) {
        assert.ok(e.id && typeof e.id === 'string', 'id');
        assert.ok(e.title && typeof e.title === 'string', 'title');
        assert.ok(Array.isArray(e.triggers) && e.triggers.length > 0, `${e.id} triggers`);
        assert.ok(e.directive && typeof e.directive === 'string', `${e.id} directive`);
    }
});

test('exactly one entry is the lead route', () => {
    const leads = CATALOG.filter(e => e.lead);
    assert.strictEqual(leads.length, 1, 'one lead');
    assert.strictEqual(leads[0].id, 'app-pm', 'app-pm is lead');
});

test('triggers are all lower-case (matching normalizes the prompt to lower)', () => {
    for (const e of CATALOG) {
        for (const t of e.triggers) {
            assert.strictEqual(t, t.toLowerCase(), `${e.id} trigger "${t}" must be lower-case`);
        }
    }
});

test('entry ids are unique', () => {
    const ids = CATALOG.map(e => e.id);
    assert.strictEqual(new Set(ids).size, ids.length, 'unique ids');
});

// === matchPrompt ============================================================

test('empty / blank prompt matches nothing', () => {
    assert.deepStrictEqual(matchPrompt(''), []);
    assert.deepStrictEqual(matchPrompt('   '), []);
    assert.deepStrictEqual(matchPrompt(null), []);
    assert.deepStrictEqual(matchPrompt(undefined), []);
});

test('app-scale phrasing routes to app-pm', () => {
    const ids = matchPrompt('I want to build a new app for tracking expenses').map(m => m.id);
    assert.ok(ids.includes('app-pm'), 'app-pm matched');
});

test('feature-complete phrasing routes to app-pm', () => {
    const ids = matchPrompt('make this feature-complete and competitive with the best-in-class').map(m => m.id);
    assert.ok(ids.includes('app-pm'), 'app-pm matched');
});

test('UI phrasing routes to uiux-design', () => {
    const ids = matchPrompt('design the UI and the user flows for this').map(m => m.id);
    assert.ok(ids.includes('uiux-design'), 'uiux-design matched');
});

test('research phrasing routes to research', () => {
    const ids = matchPrompt('research what causes this slowdown').map(m => m.id);
    assert.ok(ids.includes('research'), 'research matched');
});

test('matching is case-insensitive', () => {
    const ids = matchPrompt('RESEARCH THE OPTIONS AND TRADE-OFFS').map(m => m.id);
    assert.ok(ids.includes('research'), 'research matched upper-case');
});

test('an unrelated chore prompt matches nothing', () => {
    assert.deepStrictEqual(matchPrompt('what time is it in Tokyo'), []);
});

test('matches preserve catalog order', () => {
    // a prompt hitting both app-pm and uiux-design returns app-pm first (catalog order)
    const ms = matchPrompt('build a new app and design the UI');
    assert.ok(ms.length >= 2, 'two matches');
    assert.strictEqual(ms[0].id, 'app-pm', 'app-pm first by catalog order');
});

// === buildPromptDirective ===================================================

test('no match -> null directive (no injection, no noise)', () => {
    assert.strictEqual(buildPromptDirective('what time is it'), null);
});

test('app-scale prompt -> directive names the full pipeline', () => {
    const d = buildPromptDirective('build a new application');
    assert.ok(d, 'directive present');
    assert.ok(d.startsWith('[craft]'), 'craft-tagged');
    for (const skill of ['clarify-intent', 'research', 'product-spec', 'uiux-design', 'app-decompose', 'drive']) {
        assert.ok(d.indexOf(skill) !== -1, `pipeline names ${skill}`);
    }
});

test('lead route is stated first even when a secondary also matches', () => {
    const d = buildPromptDirective('build a new app and design the UI');
    assert.ok(d.indexOf('application-scale') !== -1, 'lead app-pm directive present');
    assert.ok(d.indexOf('Also relevant') !== -1, 'secondary listed');
    assert.ok(d.indexOf('uiux-design') !== -1, 'uiux-design named as secondary');
});

test('secondary routes capped at two', () => {
    // craft a prompt that hits many entries
    const d = buildPromptDirective('build a new app, design the UI, research the options, write a spec, implement it');
    const alsoLine = d.split('\n').find(l => l.startsWith('Also relevant'));
    assert.ok(alsoLine, 'secondary line present');
    const count = (alsoLine.match(/;/g) || []).length + 1;
    assert.ok(count <= 2, `at most two secondaries, got ${count}`);
});

// === buildCatalogDirective ==================================================

test('catalog directive is craft-tagged and names the pipeline', () => {
    const c = buildCatalogDirective();
    assert.ok(c.startsWith('[craft]'), 'craft-tagged');
    assert.ok(c.indexOf('product-spec') !== -1 && c.indexOf('uiux-design') !== -1, 'names the pipeline');
    assert.ok(c.indexOf('app-decompose') !== -1 && c.indexOf('drive') !== -1, 'names decompose+drive');
    assert.ok(c.indexOf('BEFORE code') !== -1, 'states scope-before-code');
});

process.stdout.write(`\nTotal: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
