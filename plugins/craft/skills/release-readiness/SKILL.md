---
name: release-readiness
description: 'Decide whether an assembled application is ready to ship, against an explicit go/no-go bar scaled to the build stage. Run the spec validation plan, then check the launch gate items (success measures defined, accessibility, security and privacy with no PII leak, docs and support, rollout and rollback), render a readiness scorecard and a single go/no-go decision, and route a not-ready build back through product-quality. The release half of the PM discipline; the terminal gate over a build. Use for: is it ready to ship, release readiness, launch checklist, go/no-go, definition of done for the whole product, ship decision, launch gate, readiness review, production readiness, is this done. NOT for: judging product quality or ranking gaps (see product-quality), validating the idea (see product-discovery), the feature surface (see product-spec), a single slice (see the code-review subagent).'
---

# Release readiness (is it ready to ship)

Decide go or no-go on the whole build, against a bar that is explicit and scaled to the stage. This is
the terminal gate of the PM discipline: `product-quality` says how good the product is and what to fix
next, and this skill says whether what exists is ready to ship. The difference from a code-review gate
is scope, this judges the assembled product against a launch bar, not a slice against a diff. The
failure it exists to prevent is the one ReviewBridge hit: a build called done whose own validation plan
never ran.

**Skip-gate:** this is for an assembled application reaching a ship or milestone decision. A single
feature merge is the code-review gate's job; this is the gate over the build.

**Scale the bar to the stage (read this first).** The release literature comes from running production
services, so several of its gates (live monitoring, error budgets, staged-rollout automation) assume a
service with users. A prototype has neither. Scale the bar honestly: for a prototype, those become
*reasoned non-goals* you state, not boxes you fake; for a service with users, they are real gates. Say
which stage you are gating and which items apply.

## Stage 1 - Run the spec's validation plan

Execute the plan the spec already wrote. This is the core of the gate, not a formality.

- The spec's **validation plan** is the product's debt, the tests and oracles it promised (a parity
  comparison, a latency threshold, a usability check). Run them, or inspect the evidence that they ran.
- A product whose validation plan has not run is **not ready by definition**, whatever its feature
  count. Record the result of each oracle, pass or fail, with evidence.
- Fold in the **outcome measures** `product-discovery` defined: confirm the product can be measured
  against them, even if the measurement itself waits for users.

## Stage 2 - Check the launch gate items

Walk the launch bar, the recurring go/no-go items the category names. For each, record met, not met,
or reasoned non-goal for this stage.

- **Success measures defined** before launch, not invented after.
- **Accessibility**: the product meets the accessibility bar for its type (WCAG AA for a UI). Required
  by law in many contexts, so not optional for a shipping product.
- **Security and privacy**: a review for secrets, tokens, and PII leaks. No usernames in paths, no
  tokens in logs or shared artifacts. This one is never a non-goal; it applies at every stage.
- **Docs and support**: a user can find how to use it; the support path exists.
- **Rollout and rollback**: a staged-rollout and rollback or kill-switch story exists. For a service,
  a real gate; for a prototype, often a reasoned non-goal, state which.
- **Monitoring and operations**: live monitoring and alerting before launch. For a service, a real
  gate; for a pre-users prototype, a reasoned non-goal.

## Stage 3 - Render the decision

Produce one verdict with reasons, because a readiness review with no decision is a status report.

- Write a **readiness scorecard**: each gate item with its status and one line of evidence. The
  scorecard is the artifact a human or a fleet reads to trust the decision.
- Render a single **go or no-go** with a named basis. Go means the validation plan passed and every
  applicable gate item is met or a reasoned non-goal. No-go names exactly which items block.
- **Name the decision owner.** A go/no-go with no owner is the diffusion the launch literature warns
  against; in an autonomous loop the owner is the gate, and its verdict is the record.

## Stage 4 - Route a not-ready build back, and record the learning

Close the loop rather than dead-ending on a no-go.

- On **no-go**, hand the blocking items to `product-quality` as high-priority gaps, so they enter the
  next ranked wave rather than being lost. Not-ready is a routing decision, not a failure.
- Record what this build **proved and what to revisit** (a short, blameless note on what passed, what
  failed, and why). This learning feeds the next discovery and quality passes, the postmortem habit the
  category builds in.

## End state

A single go/no-go decision over the assembled build, backed by a readiness scorecard: the spec's
validation plan run, the launch gate items each met or marked a reasoned non-goal for the stage, and an
owner on the verdict. A no-go routes its blockers back through `product-quality` and records the
learning, so the gate moves the product forward instead of dead-ending. "Done" is now a decision with
evidence, not an assumption.
