# Pre-registration: app-PM spec validation (gate)

Pre-registered **before** running any subagent, per the `experiment` skill (decide by the rule, no
goalpost moving). This is the gate for the app-PM role: does a subagent, loading the craft
disciplines, produce a spec that is high-quality, feature-complete, well-designed, and competitive?

## Test case

- **App brief:** "A keyboard-first desktop code-review client for Azure DevOps pull requests."
- **Category incumbents (to be verified by the agents):** CodeRabbit, GitHub Copilot Code Review,
  Greptile, Qodo, Graphite, Ellipsis, Microsoft CodeFlow (desktop, no AI).
- **Reference bar:** ReviewBridge `docs/design/0002-feature-complete-vision.md`, a known-good but
  **behavior-only** vision (it has the feature surface; it lacks the UI/UX design this gate demands).

## Arms

- **Arm A (disciplined):** two subagents. A behavior subagent that reads and follows
  `skills/product-spec/SKILL.md`, and a UI/UX subagent that reads and follows
  `skills/uiux-design/SKILL.md`. Their outputs are combined into one spec.
- **Arm B (baseline):** one subagent, prompt "write a spec for this app", no craft skill loaded.

Both arms get the same brief, the same model, and the same tool access. Arm B exists so the result
shows whether the skills change behavior, not just whether one spec looks fine.

## Rubric (pre-registered oracles)

| Dim | Oracle | Pass condition |
|---|---|---|
| 1. High-quality | Run `Invoke-DocSelfReview.ps1` on the spec; check `writing-spec` sections present | 0 self-review flags AND the spec has problem, goals, non-goals, proposal, alternatives, risks, validation |
| 2. Feature-complete | Reference table-stakes set = the union of ReviewBridge `0002`'s feature surface (rings 1 to 3) and any table-stakes feature an incumbent has that `0002` lists. Coverage = fraction of that set present in the spec (a reasoned non-goal counts as covered) | >= 80% coverage |
| 3. Well-designed | Six design artifacts: (a) >= 3 user flows, (b) screen inventory covering all flows, (c) stated interaction model, (d) wireframes for key surfaces, (e) design system / tokens, (f) accessibility model | all six present and coherent |
| 4. Competitive | Names >= 3 real, verified incumbents AND states a defensible wedge on features AND a defensible wedge on UX, each sourced | all three |

## Decision rule (fixed before running)

- **Arm A passes the gate** iff dims 1, 3, 4 all pass AND dim 2 coverage >= 80%.
- **The skills are validated** iff Arm A passes the gate AND Arm A beats Arm B on **dim 2 (feature
  coverage)** and **dim 3 (design-artifact count)**. Equal-or-worse on those two means the disciplines
  did not earn their place, regardless of how Arm A reads.
- The Figma-rendered portion of dim 3 is **deferred** (Copilot CLI cannot reach Figma); dim 3 is
  scored on the tool-agnostic design artifacts only. This is a documented, pre-registered descope, not
  a moved goalpost.

## Honor-the-null

If Arm A does not pass, or does not beat Arm B on dims 2 and 3, the gate fails and the downstream
phases stay blocked. A failed gate is recorded as-is; the skills are revised, not the rule.

## Outputs (committed as evidence)

- `arm-a-behavior.md`, `arm-a-uiux.md`, `arm-a-combined.md` (disciplined arm)
- `arm-b-baseline.md` (baseline arm)
- `scorecard.md` (the rubric applied, with the decision)
