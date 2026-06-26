---
name: app-decompose
description: 'Decompose a whole validated application spec into one holistic, sequenced roadmap of small, independently-shippable parts, riskiest first, each traceable to a spec feature and its UX design. The app-scale counterpart to the lightweight decompose skill. Use for: decompose the app, turn the spec into a roadmap, plan the whole build, sequence the build, what order to build the application, break the whole project down, holistic decomposition, application roadmap, build order for the app. NOT for: a single feature or sub-goal one level at a time (see decompose), the spec itself (see product-spec / uiux-design), executing a slice (see implementation).'
---

# App-scale decompose (the whole build, holistically)

Turn a **validated application spec** into one **holistic, sequenced roadmap**: the whole project
broken into small, independently-shippable parts, in dependency order, riskiest first, every part
traceable to the feature and the UX design it delivers. This is what makes an app-sized build come out
of one plan instead of accreting piecemeal.

## How this differs from `decompose` (read this first)

The lightweight `decompose` skill is deliberately anti-holistic: one level at a time, five to seven
children, "let the work reveal the next level". That discipline is correct at feature scale, where
planning ahead is speculation.

This skill is the opposite, **on purpose**, and only because its precondition is different: a
**validated, feature-complete, designed spec already exists**. When the destination is known and
agreed, decomposing the whole route up front is not speculation, it is the plan that prevents drift.
The YAGNI rule still applies *inside* a part; it does not apply *across* a spec you have already
committed to.

**Precondition gate:** do not run this skill without a validated spec (a `product-spec` plus a
`uiux-design` output, gated). With no spec, you are guessing the destination, use `decompose` and let
the work reveal it. With a spec, decompose the whole thing.

## Stage 1 - Read the spec as the coverage target

The spec is the contract the roadmap must cover. Before slicing anything:

- List the **feature surface** (from `product-spec`) and the **UX surfaces / flows** (from
  `uiux-design`). Together these are the set every part must, in aggregate, deliver.
- Note the spec's **architecture sketch** (major components and boundaries) and the **riskiest
  technical assumptions** flagged for a spike.

## Stage 2 - Cut the whole project into vertical parts

Slice the entire spec, not one layer of it.

- **Each part is a thin vertical slice**, an end-to-end capability a user or a test can exercise, not
  a horizontal layer ("the data model", "the UI") that is unshippable alone.
- **Each part is small**, the unit a single focused session can deliver and test. If a part needs more
  than a handful of slices, it is really several parts.
- **Cover the spec**: every feature and every UX surface maps to at least one part. A feature with no
  part is a hole; a part with no feature is invented scope.

## Stage 3 - Sequence by risk and dependency

Order the whole roadmap before starting any part.

- **Riskiest first.** The parts whose failure would invalidate the spec go first, especially anything
  behind a go/no-go spike (a technical assumption the spec depends on). A broken assumption must
  surface in part 1, not part 12.
- **Respect dependencies.** A part that needs another's output comes after it. Make the dependency
  edges explicit; they are the build order.
- **Keep each step shippable.** The sequence should let you stop after any part with a coherent, tested
  increment, never a half-built layer.

## Stage 4 - Make every part traceable

Traceability is what keeps the holistic plan honest as it executes.

- Each part names the **spec feature(s) and UX surface(s)** it delivers. This is the link the `drive`
  stage checks each slice against.
- Each part carries a one-line **definition of done** drawn from the spec, concrete enough to pick up
  cold.
- Run a **coverage check**: every spec feature appears in at least one part, every part traces to the
  spec. Record any deliberate deferral as an explicit, reasoned non-goal for this build.

## Stage 5 - Materialize the living roadmap

Write the roadmap into the living plan so it drives work across sessions, not a throwaway list.

- Create the roadmap and its parts in the work-composition host (the compose tree, or the host the
  `living-plan-and-engage` stage selects), with stable ids, dependency links, and status that rolls
  up.
- Keep status honest as parts move; a roadmap only helps while it matches reality.
- Shape each part so it can later be **handed to a worker** (a subagent or a fleet worker): a part is a
  self-contained, traceable, defined-done unit precisely so the `fleet-ready` stage can dispatch it.

## End state

One sequenced roadmap that covers the whole validated spec: small vertical parts, riskiest and
spike-gated first, dependency-ordered, every part traceable to a feature and a UX surface with a
concrete definition of done. It got decomposed up front, on purpose, because the spec made the
destination known. The `drive` stage executes it slice by slice, checking each result back against the
spec; the `fleet-ready` stage can dispatch its parts. The build comes out of this one plan, not
piecemeal.
