# craft

**Opinionated engineering-discipline workflows for GitHub Copilot CLI.** Microsoft-internal.

craft encodes *how* to do serious engineering work well: aim before you fire, then deliver in validated slices. It ships **workflows**, composite, opinionated recipes for an engineering activity, rather than a grab-bag of tips.

## v0.1: the Implementation workflow

One workflow: **Implementation**, build a non-trivial change with discipline.

1. **Aim** — align on the real requirement: echo it back, probe the gaps (Mom Test + Socratic), converge on testable acceptance criteria.
2. **Design** — when there is a real choice, weigh an alternative and its trade-off first (skip-gated).
3. **Deliver in validated slices** — build in thin vertical slices, test-first, never accumulating untested code. *This is the core.*

It triggers on ordinary asks like "implement X", "build this", "add this feature".

## Why these stages, and why slices lead

craft's contents are chosen by evidence, not taste. The Implementation workflow was validated with a pre-registered behavior-change A/B: does loading it make an agent actually *do* the disciplined things it otherwise would not?

| Behavior | Baseline | With workflow | Result |
|---|:---:|:---:|---|
| Deliver in tested slices | 1/9 | **9/9** | validated, decisively |
| Design with an alternative + trade-off | 0/9 | 3/9 | real but modest |
| Aim / surface assumptions | 9/9 | 9/9 | no measured separation* |

\* The aim stage showed no separation in a *non-interactive* harness, which cannot exercise interactive intent-clarification. It is kept because it aligns requirements with a human in the loop, the case the A/B could not test, and now carries a researched interactive methodology (the Mom Test + Socratic questioning, converging on Given/When/Then acceptance criteria).

So the workflow leads with delivery-in-slices, keeps design as a gated secondary, and treats aim as a quick frame. Full method and results: `copilot-tools/experiments/craft-impl-validation/` (`verdict.md`, `verdict-t2.md`).

## Install

```
copilot plugin marketplace add calebblake_microsoft/craft
copilot plugin install craft@craft
```

## Test

```powershell
pwsh tests/Test-Craft.ps1
```

Validates the manifests and the skill front-matter.

## Roadmap

v0.1 is deliberately one workflow. Each future workflow must earn its place by the same validation bar before shipping: **Debugging/RCA**, **Refactoring**, **Experiment**, and **Research** workflows, plus a shared **code-review** gate. craft grows only by evidence.

## Status

Staging in a personal repo; Microsoft-internal use only, not for public marketplace listings. Built host-agnostic for a clean cut-over to an internal home later.
