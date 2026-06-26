---
name: drive
description: 'Drive an application build from its holistic roadmap: pull the next part, implement it in tested vertical slices, check the result back against the spec and design, keep the roadmap status honest, and re-plan when a slice contradicts the spec. The execution loop that keeps an app-scale build anchored to its plan. Use for: drive the build, execute the roadmap, build from the plan, work the roadmap, keep the build coherent, plan-anchored execution, build the app part by part, what part is next. NOT for: a single isolated change (see implementation), decomposing the spec (see app-decompose), writing the spec (see product-spec / uiux-design).'
---

# Drive (plan-anchored execution)

Execute an application build **from its roadmap**, so the result stays anchored to the validated spec
instead of drifting part by part. This skill owns the **outer loop**: pick the next part, build it,
prove it against the spec, keep the plan honest, repeat. The inner loop (how to build one part) is the
`implementation` skill's job; this skill makes sure each part lands where the plan said it would.

**Precondition:** a holistic, sequenced roadmap exists (from `app-decompose`) over a validated spec
(`product-spec` plus `uiux-design`). Without the roadmap, there is nothing to drive, decompose first.

## The loop, once per part

### 1. Pull the next part

Take the next part in the roadmap's sequence (riskiest and spike-gated parts come first). Re-read its
**definition of done** and the **spec feature(s) and UX surface(s)** it traces to. That trace is the
target you will check against, name it before writing code.

### 2. Build it with the implementation discipline

Build the part in thin, tested vertical slices using the `implementation` skill: riskiest slice first,
test-first every slice, never accumulate untested code, keep every slice shippable. For a part behind
a go/no-go spike, run the spike as slice one and honor its result before building further.

### 3. Coherence check, back to the spec and the design

This is the step that makes the build plan-anchored rather than piecemeal. When the part's slices are
green, check the result back against what the spec and design said:

- **Behavior:** does the part deliver the feature(s) it traces to, as the `product-spec` described?
- **Experience:** does the built UI match the `uiux-design` (the flow, the screen, the interaction,
  the design tokens, the accessibility model)? When a Figma design exists, compare against the frames.
- **Architecture:** does the part fit the spec's component boundaries, or did it smear across them?

A part that passes its own tests but does not match the spec is not done. Coherence is a separate gate
from green tests.

### 4. Update the roadmap, honestly

Move the part's status and roll up. A roadmap only helps while it matches reality, an "open" part that
shipped or a "done" part that drifted corrupts every view built on it. If the part revealed real
sub-work, add it; if it revealed a part that is no longer needed, drop it with a reason.

## When a slice contradicts the spec

If building a part proves the **spec** wrong (not just the part's local design), stop and fix the
spec, then re-decompose the affected parts before continuing. A spec break caught at part 2 is cheap;
the same break papered over and discovered at part 12 is a rewrite. Do not silently build away from
the spec, that re-creates the piecemeal drift this whole role exists to prevent. Name the
contradiction, fix the spec (`product-spec` or `uiux-design`), re-run `app-decompose` on the affected
slice, and resume.

## End state

An application built from its plan: each part implemented in tested slices, checked back against the
feature and UX surface it traced to, with the roadmap status honest at every step. Drift is caught at
the part that causes it, because each part is proven against the spec before the next begins. A
reviewer can follow the roadmap top to bottom and trust that the build matches the spec it came from.
