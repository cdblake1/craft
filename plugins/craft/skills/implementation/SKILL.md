---
name: implementation
description: 'Build a non-trivial code change with discipline: aim, then design, then deliver in tested vertical slices. Use for: implement a feature, build this, add functionality, write the code for this, how should I build this, implement X, build a library or CLI or module, ship a change, non-trivial implementation, align requirements before building, pin down what to build, clarify what this should do, deliver in slices, test-first build, TDD this.'
---

# Implementation workflow

Build a non-trivial change the disciplined way: **aim, then design, then deliver in validated slices.** This workflow is opinionated about *how* to implement, not *what*. Its load-bearing stage is delivery: build in thin, tested slices instead of dumping untested code and hoping.

Each stage has a skip-gate. Do not perform ceremony on a genuinely trivial change (a one-line fix, an obvious rename). For those, make the clean edit, add or update a test, and move on.

## Stage 1 — Aim (align on the real requirement before any code)

Before building, converge with the requester on *what* and *why*. Interactive when a human is available; the goal is a shared, testable definition of done, not a document.

1. **Echo and expose.** Restate the request in a sentence or two and name the assumptions you would otherwise build on silently ("I'm reading this as X, assuming Y and Z"). A cheap chance to correct course before any work.
2. **Probe only the gaps that change the build.** One question at a time, only about ambiguities that would actually change what you build:
   - **Ask about their problem, not your solution** (the Mom Test): prefer "how do you do this today, what breaks" over "would you want feature X?" Leading questions get agreement, not truth.
   - **Probe assumptions and consequences** (Socratic): "what are we assuming?", "if that's true, what follows?", "what is explicitly *not* in scope?"
   - Propose a sensible default with each question, so the requester confirms in one word instead of composing an answer.
3. **Converge on acceptance criteria.** Turn the agreement into a short, testable definition of done, a few **Given / When / Then** lines (or a "done means..." checklist). Both sides sign off before code; it doubles as the Stage 3 test list.

Skip the interrogation for a genuinely tiny, unambiguous change, just state your interpretation and build.

## Stage 2 — Design (only when there is a real choice)

**Skip-gate:** if there is one obvious approach and no meaningful trade-off, skip this stage and build. Forcing a design section onto an obvious change is noise.

Otherwise, before coding, write a short design:

- The approach you will take, and the interface or API shape (names plus one-line intent).
- At least one alternative you considered and the specific trade-off that made you reject it. This is the part a reviewer actually wants; "here is my approach" with no alternative is not a design.
- Any cross-cutting concern that shapes the structure (concurrency, failure handling, compatibility, performance).

Sketch interfaces; do not paste full schemas. Keep it to the decisions someone would want to ratify before you build.

When the change is non-trivial enough that someone must ratify it before code, write the design as a reviewable spec: follow the [`writing-spec`](../writing-spec/SKILL.md) skill for the section structure (problem, goals/non-goals, proposal, alternatives-with-why, risks, validation, open questions) and run [`writing-documentation`](../writing-documentation/SKILL.md) on the prose before sharing.

## Stage 3 — Deliver in validated slices (the core)

This is where the discipline pays off. Build in thin vertical slices, each proven before the next begins:

- **Slice vertically, riskiest first.** A slice is a thin end-to-end path, not a horizontal layer. Do the most uncertain part first, so a broken assumption surfaces in slice 1, not slice 6.
- **Test-first, every slice.** Write a failing test (red), implement until it passes (green), and keep the whole suite green. Run the tests on every slice, not once at the end.
- **Prove what a unit test cannot.** If a slice's real behavior can't be shown by a unit test (UI, cross-process, integration, live I/O), also exercise it against the real thing and capture the result. A passing unit test against a mock is not proof the integration works.
- **Never accumulate untested code.** If a slice has no test, it is not done. A large dump of code "to test later" is the exact risk this workflow exists to retire.
- **Keep every slice shippable.** At the end of each slice you have working, tested code, not a half-built layer you can only judge at the end.

## When a slice contradicts the design

If building a slice proves the design wrong, stop and fix the design (Stage 2), then re-cut the affected slices. A design change caught in slice 2 is cheap; the same change after slice 6 is a rewrite. Do not paper over a design break inside a slice, that re-accumulates the risk you were retiring.

## End state

Working code, delivered incrementally, every slice tested, with a short note of the design choices made. A reviewer can follow the slices and trust each was proven, not asserted.
