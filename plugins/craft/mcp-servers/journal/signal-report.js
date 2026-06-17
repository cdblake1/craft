'use strict';

// signal-report.js -- print the injected-and-consulted findings signal, the
// behavior-change measure for the journal: of the findings the resume injector
// pushed at session start, how often did the agent actually open one?
//
// Usage: node signal-report.js
// Env:
//   COPILOT_FINDINGS_SIGNAL_DAYS  only count events in the last N days
//   CRAFT_DATA_ROOT               override the craft data root

const { buildStack } = require('./dataRoot');

function pct(x) { return (x * 100).toFixed(0) + '%'; }

function main() {
    const days = process.env.COPILOT_FINDINGS_SIGNAL_DAYS
        ? parseInt(process.env.COPILOT_FINDINGS_SIGNAL_DAYS, 10) : undefined;
    const stack = buildStack();
    const s = stack.signal.computeSignal({ sinceDays: days });
    const scope = days ? ` (last ${days} days)` : '';
    process.stdout.write(
        'Findings injected-and-consulted signal' + scope + '\n' +
        '  data root: ' + stack.root + '\n' +
        '  log key  : ' + stack.signal.logKey + '\n' +
        '  sessions with an injection      : ' + s.injectSessions + '\n' +
        '  ...that opened >=1 injected find: ' + s.consultedSessions + ' (' + pct(s.sessionConsultRate) + ')\n' +
        '  injected findings (total)       : ' + s.injectedFindings + '\n' +
        '  ...opened in-session            : ' + s.consultedFindings + ' (' + pct(s.findingConsultRate) + ')\n'
    );
}

if (require.main === module) { main(); }

module.exports = { main };
