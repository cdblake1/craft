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
  edges explicit in prose; because the compose model stores no dependency edge, they are encoded at
  materialization time as status **waves** (Stage 5): a dependent part stays un-`open` until its
  predecessors ship.
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

## Stage 5 - Materialize the living roadmap as dispatchable compose nodes

Write the roadmap into the compose tree so it drives work across sessions and is ready to hand to the
fleet. The structure is load-bearing: an autonomous worker (and the bridge that feeds it) consumes
**compose leaf items**, so each part must be a leaf item shaped to be picked up cold.

Map the decomposition onto compose's three levels:

- **Roadmap** (`compose_roadmap`): the whole build. Its body holds the one-paragraph outcome.
- **Plan** (`compose_plan`, linked to the roadmap): a coherent group of parts (often one per
  architecture component or one per dependency wave). Put the **shared context in the plan `body`**:
  the spec excerpt, the architecture boundary, and the features this plan delivers. A dispatcher folds
  the plan body into every child's prompt, so this is where cross-part context lives once.
- **Part = item** (`compose_capture`, linked to the plan via `plan_id`): one dispatchable unit. Each
  item MUST carry:
  - `next_action` - the **concrete task**, written so a worker with only this item + its plan body
    can execute it cold. This is the spine of the dispatched prompt; a vague `next_action` is a vague
    work order. Include the definition of done and the spec feature / UX surface it traces to.
  - `title` - a concrete, pick-up-cold summary.
  - `notes` - supporting context not in `next_action` (links to the spec/design section, acceptance).
  - `severity` - the part's priority (`high` / `medium` / `low` / `info`); a dispatcher maps this to
    execution value, so riskiest-first parts should outrank polish.
  - `category` - the kind of work (`feature`, `refactor`, `bug`, ...).
  - `status` - **`open` exactly when the part is ready to start** (see the wave rule below).

This is the bridge-ready contract: a dispatcher treats a leaf as ready when it is `status: open`, has
a `plan_id`, and carries a non-empty `next_action`. Every part you intend to be dispatchable must meet
all three. The `fleet-ready` reference documents the full mapping.

### The wave rule (how a sequenced roadmap survives a dependency-unaware dispatcher)

A dispatcher pulls **every** ready (`open`) leaf, with no view of your dependency edges. So encode the
build order in **status**, not just in prose:

- A part is `open` **only when its predecessors have shipped**. Until then keep it `parked` (or leave
  `next_action` empty), so it fails the ready test and is not dispatched early.
- The parts that are `open` at any moment are one **wave**: mutually independent, safe to run in
  parallel. The first wave is the riskiest / spike-gated parts.
- When a wave's parts ship, promote the next wave to `open`. The `drive` stage owns this promotion as
  it reconciles completed parts; it is the craft-side substitute for a dependency edge the compose
  model does not store.

- Keep status honest as parts move; a roadmap (and the wave gating) only helps while it matches
  reality. Roll up the plan after status changes.

## End state

One sequenced roadmap that covers the whole validated spec: small vertical parts, riskiest and
spike-gated first, dependency-ordered, every part traceable to a feature and a UX surface with a
concrete definition of done. It got decomposed up front, on purpose, because the spec made the
destination known. The `drive` stage executes it slice by slice, checking each result back against the
spec; the `fleet-ready` stage can dispatch its parts. The build comes out of this one plan, not
piecemeal.
