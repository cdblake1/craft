# Combined spec (Arm A): keyboard-first Azure DevOps review client

This is the combined output of the disciplined arm: the **behavior spec** (`product-spec` skill) and
the **UI/UX design spec** (`uiux-design` skill), produced by two subagents from one app brief and
composed here.

- **Behavior / product half:** [`arm-a-behavior.md`](arm-a-behavior.md), covering app type, 8 verified
  incumbents, a 24-feature sourced completeness/competitive matrix, the wedge, product model, core
  behaviors, architecture sketch. 55 sourced URLs.
- **UI/UX design half:** [`arm-a-uiux.md`](arm-a-uiux.md), covering 10 products UX-benched (17 sourced UX
  rows), 6 key flows, a 22-surface inventory, the interaction model, ASCII wireframes for the key
  surfaces, a visual design system, and an accessibility model. 33 sourced URLs. Figma render
  deferred (host cannot reach Figma); the tool-agnostic design is canonical.

## Wedge (features and experience)

- **Feature wedge:** local, reviewer-approved agent dispatch for Azure DevOps reviews, owning the
  keyboard review state, exact ADO anchors, verified local checkout, agent task envelope, patch
  intake, test output, and post-or-push decision in one audited loop (behavior spec).
- **Experience wedge:** a keyboard-first desktop review cockpit that binds the review surface, the
  agent run, and the ADO thread state in one local, low-latency session (design spec).

## Reconciliation

The UI/UX arm fed features back to the behavior arm rather than inventing them in the design (see the
"Reconciliation: features to add to the behavior spec" section in [`arm-a-uiux.md`](arm-a-uiux.md)).
This is the reconciliation loop the role contract requires.

## How this was produced

Two subagents, each given only the app brief, each instructed to read and follow its craft skill
(`product-spec`, `uiux-design`). No human authored the feature surface or the design. This is the
artifact the gate scores. See [`PREREGISTRATION.md`](PREREGISTRATION.md) and
[`scorecard.md`](scorecard.md).
