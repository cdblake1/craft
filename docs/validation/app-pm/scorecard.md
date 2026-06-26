# Scorecard: app-PM spec validation gate

The pre-registered rubric ([`PREREGISTRATION.md`](PREREGISTRATION.md)) applied to the two arms. Scored
after running, against the fixed decision rule. No goalposts moved; the one descope (Figma render of
dim 3) was pre-registered.

## Evidence summary

| Signal | Arm A (disciplined) | Arm B (baseline) |
|---|---|---|
| Subagents | 2 (behavior + UI/UX), each following its craft skill | 1, no skill |
| Source URLs | 88 (55 behavior + 33 design) | 0 |
| Verified incumbents | 8 product, 10 UX-benched | 0 |
| Completeness/competitive matrix | 24 features sourced | none |
| Design artifacts (of 6) | 6 (flows, screen inventory, interaction model, wireframes, design system, accessibility) | <= 3 (interaction model, scattered a11y, flows) |
| Wireframes / screen inventory | yes (148 box-drawing rows; 22-surface inventory) | none |
| Wedge | features and UX, both stated and defensible | none |

## Rubric scoring

| Dim | Oracle | Arm A | Arm B |
|---|---|---|---|
| 1. High-quality | self-review 0 flags + writing-spec sections | **PASS** (both halves 0 flags, full structure) | **PASS** (0 flags, full structure) |
| 2. Feature-complete | >= 80% of the reference table-stakes set, each sourced | **PASS** (covers `0002` ring 1 to 2 table-stakes and adds category features: custom rules, noise controls, full/cross-repo context, enterprise admin, analytics; every feature sourced) | **FAIL** (misses custom rules, noise controls, learns-from-feedback, PR walkthrough/summary, analytics; and **0 sources**, so completeness is unverifiable) |
| 3. Well-designed | all six design artifacts present and coherent | **PASS** (6 of 6, verified) | **FAIL** (no wireframes, no screen inventory, no design system) |
| 4. Competitive | >= 3 verified incumbents + a defensible feature wedge + a defensible UX wedge, sourced | **PASS** (8 incumbents, sourced matrix, feature and UX wedge) | **FAIL** (0 incumbents, no wedge, no sourcing) |

## Decision (by the pre-registered rule)

- **Arm A passes the gate:** dims 1, 3, 4 all pass and dim 2 coverage is >= 80%. **YES.**
- **The skills are validated:** Arm A passes the gate AND beats Arm B on dim 2 (24 sourced features
  vs an unsourced set missing ~5 table-stakes) AND on dim 3 (6 of 6 design artifacts vs <= 3, with no
  wireframes or design system in the baseline). **YES.**

**Result: GATE PASSED. The `product-spec` + `uiux-design` disciplines are validated.**

A subagent, given only an app idea and type, autonomously produced a spec that is high-quality,
feature-complete, well-designed, and competitive with the best-in-class for the app type. The baseline
shows the separation is real: an undisciplined one-pass spec is competent in structure but has zero
competitive grounding, misses non-obvious table-stakes, and carries no usable design.

## Caveats and scope

- **Strong baseline.** Arm B is a capable spec (inbox, keyboard model, findings, dispatch). The
  separation is on the disciplines' headline behaviors (sourced feature-completeness, competitive
  grounding, an actual design), not on basic competence. This is the honest, conservative read.
- **Single trial, single category.** One app type (ADO code-review), one run per arm. Decisive on
  this case; a broader claim needs more categories and trials.
- **Figma deferred.** Dim 3 scored on the tool-agnostic design only; the Figma render path is
  unvalidated (Copilot CLI cannot reach Figma's MCP). Pre-registered descope.
- **Reference bar.** Feature-completeness scored against `0002`'s behavior surface, a known-good but
  behavior-only reference; Arm A also exceeded it on category features and added the UX design
  `0002` lacked entirely.
