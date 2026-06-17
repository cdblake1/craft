---
name: experiment
description: 'Validate a hypothesis with empirical evidence instead of asserting an answer: pre-register, run a real comparison, decide by the rule. The step after research surfaces a hypothesis; hand the winner to implementation. Use this when the answer is empirical and you do not already have evidence. Use for: which is faster, benchmark this, test the hypothesis, validate empirically, measure X versus Y, prove which is better, run an experiment, A/B this, settle this with data, is X actually faster than Y, compare these approaches.'
---

# Experiment workflow

Validate a hypothesis with empirical evidence instead of asserting an answer. Use this whenever a question's answer is empirical (which approach is faster, does this change help, which option wins) and you do not already have evidence. The output is a **winner chosen by a rule you set before you looked at the data**, or an honest "inconclusive."

The discipline exists to defeat one failure mode: deciding the answer first and then collecting the evidence that agrees. Pre-registration is what prevents it.

## Stage 1 - Pre-register (before any data)

Write this down first, in order, before running anything:

- **The hypothesis**, as a falsifiable statement.
- **The conditions** to compare: at least two, and include a baseline or control. A comparison of one thing is an assertion.
- **The metric**: the single number (or small set) that decides it, and how you will measure it.
- **The decision rule**: what result means each outcome (ship A / ship B / inconclusive), set now, not after seeing numbers.

Keep these as the first entries in an ordered log, so the order (registered, then measured) is visible and cannot be quietly rewritten later.

## Stage 2 - Run a real comparison

- Actually execute each condition and record the metric. Do not substitute a plausible estimate for a measurement.
- Hold everything else constant across conditions, so the metric reflects the variable you are testing.
- Run enough trials to see past noise; note the spread, not just a single number.

## Stage 3 - Decide by the rule

- Apply the decision rule you pre-registered, to the data you collected. Pick the outcome the rule selects, even if it is not the one you expected.
- Do not move the goalpost. If you find yourself wanting a different threshold after seeing the data, that is the bias the rule exists to stop; the original rule stands.

## Stage 4 - Honor the null

- If the conditions do not separate by the pre-registered margin, the answer is **inconclusive**, not a forced winner. Report it as such.
- Name what a stronger run would need (more trials, a bigger input, a cleaner metric) so the question can be reopened deliberately.

Skip-gate: a settled fact with existing solid evidence does not need a fresh experiment; cite the evidence and move on.

## End state

A decision backed by evidence: the pre-registered hypothesis and rule, the measured numbers per condition, and the winner the rule selected (or a clear inconclusive). Anyone can re-run it and reach the same verdict, because the rule was fixed before the data spoke.
