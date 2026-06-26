The spec-review gate denied the current plan. Revise the spec and the phased plan to
address the findings below, then stop. Do NOT implement the feature.

Make the smallest change that resolves every finding:

- Update `.craft-spec/SPEC.md` (the spec/design) and `orchestrator-plan.json` (the
  phased plan) so the gate's objections no longer hold.
- Keep `orchestrator-plan.json` in its required JSON shape (feature + ordered phases,
  each phase with id, title, and a complete self-contained prompt). Keep phases as
  thin, ordered, independently testable vertical slices that trace to the feature.
- Do not over-correct: address what the gate flagged, not unrelated rework.

Branch discipline: commit your revision directly on the CURRENT branch. Do NOT create
or switch branches, push, or open a pull request. Commit and stop.
