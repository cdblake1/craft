# craft x orchestrator strategy bundle

This is the **craft methodology as an orchestrator strategy bundle**. It lets the
[`cdblake1/orchestrator`](https://github.com/cdblake1/orchestrator) autonomous-delivery
daemon drive a build with craft's engineering discipline, using the orchestrator's
generic prompt-override mechanism (its design 0006). It is the decoupling boundary:
the orchestrator core names no methodology, and this bundle names no orchestrator
internals. They meet only at the public strategy-template contract.

## What's here

| File | Role |
|---|---|
| `strategies/craft-spec-first.yaml` | a strategy template (`build: spec-first`) that points at the two prompt files |
| `prompts/craft-spec.md` | the spec-authoring prompt: scope + decompose the craft way, then emit the phased plan JSON |
| `prompts/craft-phase.md` | the per-phase build prompt: build one tested vertical slice, coherence-checked |

The prompts invoke craft's skills by name (`clarify-intent`, `research`,
`product-spec`, `uiux-design`, `app-decompose`, `implementation`, `drive`). For the
worker to actually load them, **craft must be installed in the orchestrator's agent
environment** (it ships as a Copilot CLI / Claude Code plugin; the skill-propagation
hooks then surface the right skill per phase).

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

## Decoupling

Deleting this directory leaves both craft and the orchestrator fully functional: the
orchestrator falls back to its built-in spec-first prompts, and craft is unaffected.
This bundle is the only place the two methodologies meet, and it depends only on the
orchestrator's public 0006 contract.
