# Local Code Review agents

This directory holds two pre-push code-review agents. They run on the local
repository state (working tree, staged, or topic-branch-vs-default) and produce
a chat-rendered report. They never post to a pull request, vote, or touch a
remote.

The two cover **disjoint jobs** and compose:

| File | Job | What it does |
|---|---|---|
| `Local-Code-Review.agent.md` | **Find bugs.** | The generalist. One pass over the diff combining three review lenses (Advocate / Skeptic / Architect), a six-category bug checklist (design-coherence, api-contract, business-logic, test-fidelity, error-handling, concurrency), and implicit-invariant analysis (enumerate the state / threading / ordering / input invariants the diff assumes, then hypothesize and verify bugs against them). Every finding cites file:line, names a concrete trigger, and is verified by a second read before it ships. Modal verdict is `Ship it`. |
| `Local-Code-Review-Consistency.agent.md` | **Match repo conventions.** | Reviews the diff against patterns already established in the same repository (sibling files in the same directory / project / name-suffix family, plus instruction files whose `applyTo` matches). Derives its rules from the repo at review time; ships no hard-coded checklist. Every finding cites a sibling file demonstrating the convention plus a concrete one-line fix. |

## Why two agents, not one

The bug-finder's rules explicitly forbid convention and style comments (that is
the analyzers' and formatters' job, not a reviewer's). Consistency is therefore
a genuinely separate job: it asks "does this match what the repo already does",
not "is this correct". Folding it into the bug-finder would make that agent
contradict its own rules, so it lives as its own agent.

They compose cleanly. Run both for full coverage, or run either alone:

- Run `Local Code Review` when you want a correctness pass before pushing.
- Run `Local Code Review (Consistency)` when you only care about whether the
  change fits the established patterns.

Because each agent cites file:line for every finding, running both and reading
the union is straightforward: a `(file, line)` that both flag is simply the same
spot seen through two lenses.

## Design notes

- **No model is pinned.** Both agents use the host default. They benefit from a
  large-context model on big diffs, since the verification pass re-reads every
  cited file.
- **Read-only by construction.** Neither agent edits, stages, commits, pushes,
  posts, or triggers builds. Both decline if asked.
- **Host-agnostic.** The agents reason about generic repository concepts (source
  vs test vs config, default branch, instruction files, build gates that promote
  warnings to errors) rather than any one toolchain. The build gate detects the
  repo's own warnings-as-errors flag and reproduces it with the repo's own build
  tool; if there is no such flag, the gate is skipped and says so.
