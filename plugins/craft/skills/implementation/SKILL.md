---
name: implementation
description: 'Build a non-trivial code change with discipline: aim, then design, then deliver in tested vertical slices. Use for: implement a feature, build this, add functionality, write the code for this, how should I build this, implement X, build a library or CLI or module, ship a change, non-trivial implementation, deliver in slices, test-first build, TDD this.'
---

# Implementation workflow

Build a non-trivial change the disciplined way: **aim, then design, then deliver in validated slices.** This workflow is opinionated about *how* to implement, not *what*. Its load-bearing stage is delivery: build in thin, tested slices instead of dumping untested code and hoping.

Each stage has a skip-gate. Do not perform ceremony on a genuinely trivial change (a one-line fix, an obvious rename). For those, make the clean edit, add or update a test, and move on.

## Stage 1 — Aim (a quick frame, before any code)

In a sentence or two, before writing code:

- State the real goal: what is true once this is done that is not true now.
- Surface the assumptions and ambiguities you are resolving, and how. If a human is available and the request is genuinely ambiguous, ask one sharp question; otherwise state your interpretation explicitly so it can be corrected.
- Name what "done" looks like concretely.

Keep this short. It is a frame, not a document.

## Stage 2 — Design (only when there is a real choice)

**Skip-gate:** if there is one obvious approach and no meaningful trade-off, skip this stage and build. Forcing a design section onto an obvious change is noise.

Otherwise, before coding, write a short design:

- The approach you will take, and the interface or API shape (names plus one-line intent).
- At least one alternative you considered and the specific trade-off that made you reject it. This is the part a reviewer actually wants; "here is my approach" with no alternative is not a design.
- Any cross-cutting concern that shapes the structure (concurrency, failure handling, compatibility, performance).

Sketch interfaces; do not paste full schemas. Keep it to the decisions someone would want to ratify before you build.

## Stage 3 — Deliver in validated slices (the core)

This is where the discipline pays off. Build in thin vertical slices, each proven before the next begins:

- **Slice vertically, riskiest first.** A slice is a thin end-to-end path, not a horizontal layer. Do the most uncertain part first, so a broken assumption surfaces in slice 1, not slice 6.
- **Test-first, every slice.** Write a failing test (red), implement until it passes (green), and keep the whole suite green. Run the tests on every slice, not once at the end.
- **Never accumulate untested code.** If a slice has no test, it is not done. A large dump of code "to test later" is the exact risk this workflow exists to retire.
- **Keep every slice shippable.** At the end of each slice you have working, tested code, not a half-built layer you can only judge at the end.

## When a slice contradicts the design

If building a slice proves the design wrong, stop and fix the design (Stage 2), then re-cut the affected slices. A design change caught in slice 2 is cheap; the same change after slice 6 is a rewrite. Do not paper over a design break inside a slice, that re-accumulates the risk you were retiring.

## End state

Working code, delivered incrementally, every slice tested, with a short note of the design choices made. A reviewer can follow the slices and trust each was proven, not asserted.
