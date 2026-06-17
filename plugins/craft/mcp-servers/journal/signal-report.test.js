'use strict';

// signal-report.test.js -- reality gate for the standalone signal report. Seeds
// an inject row through the adapter, then spawns `node signal-report.js` and
// asserts it reads the row back. Run: node signal-report.test.js

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const { createFileStore } = require('../../lib/storage');
const { createSignal } = require('./signal');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); process.stdout.write(`PASS  ${name}\n`); passed++; }
    catch (e) { process.stdout.write(`FAIL  ${name}\n        ${e.message}\n`); failed++; }
}

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'craft-sigrep-'));
const store = createFileStore({ root: dataRoot });
const signal = createSignal(store);
signal.logInjection({ sessionId: 's1', branch: 'dev/test/b', repo: 'r', paths: ['journals/r/dev/test/b/findings/01-a.md'] });

function runReport(extraEnv) {
    const env = Object.assign({}, process.env, { CRAFT_DATA_ROOT: dataRoot }, extraEnv || {});
    return execFileSync('node', [path.join(__dirname, 'signal-report.js')], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

test('signal-report reports the injected session from the adapter', () => {
    const out = runReport();
    assert.ok(/sessions with an injection\s*:\s*1/.test(out), out);
    assert.ok(/...that opened >=1 injected find: 0/.test(out) || /opened >=1 injected find: 0/.test(out), out);
    assert.ok(out.includes(dataRoot), 'should name the data root');
});

try { fs.rmSync(dataRoot, { recursive: true, force: true }); } catch (_) { /* best effort */ }

process.stdout.write(`\nTotal: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
