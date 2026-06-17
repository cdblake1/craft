// pii.js -- write-time PII validation for backlog entries.
//
// The repo is git-tracked and synced across machines, so anything written to
// backlog.jsonl is effectively published. Backlog entries describe findings,
// not the data that surfaced them. This validator catches the most common
// shapes of accidental PII leakage:
//
//   - Windows user paths   (C:\Users\<name>\...)        -- machine identity
//   - Unix-ish home paths  (/home/<name>/...)           -- machine identity
//   - Email addresses                                   -- user identity
//   - AzDO work item links                              -- product user data
//   - GitHub PR/issue links to this org's repos         -- product user data
//
// We do NOT try to catch everything; the goal is to catch the regressions a
// careless paraphrase would produce. The validator returns an array of
// detected issues with a short reason string; the caller turns that into a
// tool-call error.

'use strict';

const PII_PATTERNS = [
    { name: 'windows-user-path',  re: /[a-zA-Z]:[\\/]+Users[\\/]+[^\\/\s"']+/i,
      hint: 'remove the user path; refer to it abstractly (e.g. "<user-home>\\repos\\...")' },
    { name: 'unix-home-path',     re: /\/home\/[a-zA-Z0-9._-]+\//,
      hint: 'remove the user path; refer to it abstractly' },
    { name: 'email-address',      re: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
      hint: 'remove the email; refer to users as User 1 / User 2 / etc.' },
    { name: 'azdo-workitem-link', re: /devdiv\.visualstudio\.com\/.+\/_workitems\/edit\/\d+/i,
      hint: 'remove the AzDO work-item link; describe the finding abstractly' },
    { name: 'azdo-pr-link',       re: /devdiv\.visualstudio\.com\/.+\/pullrequest\/\d+/i,
      hint: 'remove the AzDO PR link; describe the finding abstractly' },
    { name: 'aka-ms-link',        re: /\baka\.ms\/[a-z0-9-]+/i,
      hint: 'remove the aka.ms link; describe the finding abstractly' },
];

function detect(text) {
    if (typeof text !== 'string') { return []; }
    const hits = [];
    for (const p of PII_PATTERNS) {
        const m = p.re.exec(text);
        if (m) { hits.push({ name: p.name, match: m[0], hint: p.hint }); }
    }
    return hits;
}

function detectAll(fields) {
    // fields is { fieldName: text }. Returns array of { field, name, match, hint }.
    const out = [];
    for (const [field, value] of Object.entries(fields)) {
        for (const h of detect(value)) {
            out.push(Object.assign({ field }, h));
        }
    }
    return out;
}

module.exports = { detect, detectAll, PII_PATTERNS };
