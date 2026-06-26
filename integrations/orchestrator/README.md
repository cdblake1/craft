# craft x orchestrator strategy bundle

This is the **craft methodology as an orchestrator strategy bundle**. It lets the
[`cdblake1/orchestrator`](https://github.com/cdblake1/orchestrator) autonomous-delivery
daemon drive a build with craft's engineering discipline, using the orchestrator's
generic prompt-override mechanism (its design 0006). It is the decoupling boundary:
the orchestrator core names no methodology, and this bundle names no orchestrator
internals. They meet only at the public strategy-template contract.

## What's here

Two strategies. `craft-spec-first` plans and builds; `craft-autonomous` adds the gates
and the merge that remove the human from the per-feature loop.

| File | Role |
|---|---|
| `strategies/craft-spec-first.yaml` | spec-first build: scope + decompose, then tested slices. No gates; opens a draft PR for a human. |
| `strategies/craft-autonomous.yaml` | the full autonomous loop: spec-review gate -> build -> code-review gate -> strip the spec -> auto-merge on approval. |
| `prompts/craft-spec.md` | spec-authoring prompt: scope + decompose the craft way, then emit the phased plan JSON |
| `prompts/craft-autonomous-spec.md` | the autonomous variant: same, but pins the spec/design to `.craft-spec/` so it can be stripped before the PR |
| `prompts/craft-phase.md` | per-phase build prompt: build one tested vertical slice, coherence-checked |
| `prompts/craft-spec-review.md` | spec-review gate: judge the plan against the craft bar (`writing-spec`); deny a weak plan before any code |
| `prompts/craft-spec-fix.md` | revise the spec when the gate denies it |
| `prompts/craft-lcr-gate.md` | code-review gate: run `craft:Local-Code-Review` on the built change, deny on a blocking finding |
| `prompts/craft-lcr-fix.md` | address the review findings when the gate denies the change |

The prompts invoke craft's skills by name (`clarify-intent`, `research`,
`product-spec`, `uiux-design`, `app-decompose`, `implementation`, `drive`,
`writing-spec`, and the `craft:Local-Code-Review` subagent). For the worker to actually
load them, **craft must be installed in the orchestrator's agent environment** (it ships
as a Copilot CLI / Claude Code plugin; the skill-propagation hooks then surface the
right skill per phase).

## The autonomous loop

`craft-autonomous` is the spec-to-merge loop. It uses the orchestrator's generic
spec-gate, review-fix loop, strip-finalize, and auto-merge mechanisms (orchestrator
design 0007); the methodology lives entirely in this bundle's prompts.

```
spec (craft scope + decompose, written to .craft-spec/ + orchestrator-plan.json)
  -> spec-review gate ── deny ──> revise spec ──┐ (up to fix_max_iterations; exhausted => dead-letter)
        │ approve                                │
        └────────────────<───────────────────────┘
  -> build each phase as a tested vertical slice
  -> code-review gate (craft:Local-Code-Review) ── deny ──> fix ──┐ (up to cap; exhausted => stays a draft)
        │ approve                                                  │
        └────────────────────────<──────────────────────────────────┘
  -> strip .craft-spec/ + orchestrator-plan.json
  -> auto-merge to the base branch (only because the gate approved AND verification is green)
```

Both gates are *deny-capable wrappers* around read-only review: the gate agent runs the
review, then maps a blocking finding to a denial that drives a bounded fix loop. The
caps are the safety boundary — an exhausted loop never merges; it surfaces for a human.

## Use it

In the orchestrator target config (`targets.yaml`):

```yaml
strategies_dir: /path/to/craft/integrations/orchestrator/strategies
targets:
  - name: my-repo
    url: https://dev.azure.com/<org>/<project>/_git/<repo>   # or a github url
    provider: azure-devops                                    # omit for github
    strategy: craft-spec-first
    verify:
      command: ["dotnet", "test", "<solution>"]
```

The template's `prompt_file` paths resolve relative to the template file, so the
`strategies/` + `prompts/` pair can be pointed at directly.

## Placeholders

The orchestrator substitutes a fixed set of pipeline placeholders into these prompts
(see orchestrator design 0006). Spec prompt: `{{feature}}`, `{{verifyHint}}`,
`{{planFile}}`, `{{maxPhases}}`. Phase prompt: `{{feature}}`, `{{phaseIndex}}`,
`{{phaseTotal}}`, `{{phaseId}}`, `{{phaseTitle}}`, `{{phasePrompt}}`. Unknown tokens
are left verbatim. The prompts must keep the pipeline contract (write `{{planFile}}`
in the required JSON shape; commit, do not push), which they do.

The **gate** prompts (`spec_gate` and the `code-review` check) do not take `{{...}}`
substitution. The orchestrator frames each with the work-item context (id, title, the
original task) and appends a machine-readable verdict contract, so the gate prompt only
states *what to review and how to decide*; it outputs the verdict JSON the orchestrator
parses. The **fix** prompts (`fix_prompt_file`) are framed with the denied gate's
findings plus the work-item context; they state *what to change*, then commit.

## Decoupling

Deleting this directory leaves both craft and the orchestrator fully functional: the
orchestrator falls back to its built-in spec-first prompts, and craft is unaffected.
This bundle is the only place the two methodologies meet, and it depends only on the
orchestrator's public 0006 + 0007 contracts.
