# craft

**Opinionated engineering-discipline tooling for GitHub Copilot CLI.**

craft encodes *how* to do serious engineering work well and gives a session the substrate to do it: workflow skills that shape behavior, two MCP servers for continuity and work composition, and lifecycle hooks that surface the right context at the right moment. Everything sits on one git-backed data layer that can follow you across machines.

## What's in it

| Component | What it does |
|---|---|
| **`research` skill** | Answer a question or uncover a hypothesis space with grounded, triangulated evidence, not a confident guess. The go-to first move for most work. Behavior-validated (see below). |
| **`experiment` skill** | Validate a hypothesis empirically: pre-register, run a real comparison, decide by the rule. Behavior-validated. |
| **`implementation` skill** | Build a non-trivial change with discipline: aim, then design, then deliver in validated tested slices. Behavior-validated. |
| **`decompose` skill** | The judgment layer for the compose MCP: how to break a goal into the roadmap, plan, item hierarchy (leveling, how many per pass, when to stop). |
| **`clarify-intent` skill** | Socratic interrogation that surfaces the real goal before you commit to a research direction, design, or build. The meta-skill for "am I solving the right problem". |
| **`writing-documentation` skill** | Long-form technical prose with discipline: pick one doc shape, lead with the verdict, no AI-isms, run the self-review script before publishing. |
| **Review agents** | Two read-only pre-push code reviewers (`Local Code Review` + `Local Code Review (Consistency)`). Bug-finding and convention-alignment as disjoint, composable passes over the local diff. |
| **`craft-journal` MCP** | Resume continuity and findings reuse. Relevance-ranked (BM25) search over prior findings, per-branch plan and step-log, draft seeding. 9 tools. |
| **`craft-compose` MCP** | Roadmap, plan, item work composition. Create and link nodes, status, deterministic roll-up, the unified tree. Write-time PII guard. 7 tools. |
| **Node hook dispatcher** | Runs the lifecycle handlers in an explicit, ordered registry across `sessionStart`, `userPromptSubmitted`, `postToolUse`, `postToolUseFailure`, and `sessionEnd`. |
| **Skill propagation** | Active, not passive: a `sessionStart` catalog injects the skills and the app-scale pipeline every session, and a `userPromptSubmitted` router reads each prompt and names the skill (or the whole chain) to load. So the skills get *used*, not just offered. |
| **Storage adapter + sync** | One git-backed adapter under both MCPs and every hook; opt-in session-boundary sync across machines. |

The four workflow skills form a pipeline, most agent work starts at the top: **research** (answer the question, surface hypotheses) leads to **experiment** (validate the winners empirically), which leads to **implementation** (build them), with **decompose** structuring the work. Each skill earns its place by a pre-registered behavior-change A/B before it ships; the research and experiment workflows were validated at 9/9 vs 0/9 on their headline behaviors (`copilot-tools/experiments/craft-rx-workflow-validation/`).

craft also ships standalone disciplines that compose with the pipeline rather than sitting inside it: the **`clarify-intent`** and **`writing-documentation`** skills, and two read-only **review agents**. See [The review agents](#the-review-agents) below.

## Architecture

Everything addresses data through a single storage adapter (`lib/storage.js`), by a logical, slash-separated key, never the filesystem directly. The journal and compose MCPs and every hook share that one data layer, so persistence and cross-machine sync are solved once, in one place. The default backend is a git-backed directory; the interface is deliberately small so a future multi-user backend can replace it without rewriting the layers above. The full design is in [`docs/design/0001-foundation-and-work-composition.md`](docs/design/0001-foundation-and-work-composition.md).

The hooks are where the value surfaces automatically:

- **`sessionStart`** pulls the latest data (when sync is configured), then injects one merged block: where you left off (last-session recap and current plan), prior findings ranked by relevance to the branch, the active work composition (in-flight plans and open items), any captured failures awaiting triage, and an always-on **skill catalog** that names the available skills and the app-scale pipeline (so the skills surface even on a cold repo with no data yet).
- **`userPromptSubmitted`** reads each prompt and, on a confident intent match, injects a terse directive naming the skill (or the whole `clarify-intent -> research -> product-spec + uiux-design -> app-decompose -> drive` chain) to load. It stays silent on an unmatched prompt, so it steers without adding noise. This is what makes propagation aggressive: skills are routed on every prompt, not just at session start.
- **`postToolUse`** records when you open a prior finding, so the journal can measure whether surfaced findings actually get used.
- **`postToolUseFailure`** accumulates observable failure facts (tool, error text, exit code) for the session.
- **`sessionEnd`** seeds a draft finding from the session's checkpoint, fingerprints and de-duplicates the session's failures into work items (PII-scrubbed), then pushes the data (when sync is configured).

Handler order is an explicit list, not a scraped numeric comment, which removes a class of silent ordering collisions.

## The skills

The four skills form a pipeline, **research → experiment → implement**, with **decompose** structuring the work. Most sessions begin at research. Each skill is chosen by evidence: it ships only after a pre-registered behavior-change A/B shows that loading it makes an agent *do* the discipline it otherwise skips.

### research

Answer a question or uncover a hypothesis space with grounded, triangulated evidence, the go-to first move. Validated with a 36-run blinded A/B:

| Behavior | Baseline | With workflow | Result |
|---|:---:|:---:|---|
| Grounded (cited + quoted evidence) | 0/9 | **9/9** | validated, decisively |
| Hypotheses labeled verified-vs-hypothesis | 0/9 | **9/9** | validated, decisively |
| Triangulated (2+ independent sources) | 0/9 | **9/9** | validated |

### experiment

Validate a hypothesis empirically: pre-register, run a real comparison, decide by the rule. Same A/B:

| Behavior | Baseline | With workflow | Result |
|---|:---:|:---:|---|
| Pre-registered before data | 0/9 | **9/9** | validated, decisively |
| Decide-by-rule (no goalpost moving) | 0/9 | **9/9** | validated, decisively |

\* The honor-the-null stage ships but is not yet behavior-validated (the probe task had a real winner). Full method and results: `copilot-tools/experiments/craft-rx-workflow-validation/`.

### implementation

Aim, then design, then deliver in validated slices. Delivery leads: build in thin vertical slices, test-first, never accumulating untested code.

craft's contents are chosen by evidence, not taste. The Implementation workflow was validated with a pre-registered behavior-change A/B: does loading it make an agent actually *do* the disciplined things it otherwise would not?

| Behavior | Baseline | With workflow | Result |
|---|:---:|:---:|---|
| Deliver in tested slices | 1/9 | **9/9** | validated, decisively |
| Design with an alternative and trade-off | 0/9 | 3/9 | real but modest |
| Aim / surface assumptions | 9/9 | 9/9 | no measured separation* |

\* The aim stage showed no separation in a *non-interactive* harness, which cannot exercise interactive intent-clarification. It is kept because it aligns requirements with a human in the loop, the case the A/B could not test. Full method and results: `copilot-tools/experiments/craft-impl-validation/`.

### decompose

The compose MCP enforces structure (three levels, a valid parent, a valid status). It cannot decide what makes a decomposition good. The decompose skill owns that judgment: pick the right level, create at most five to seven children per pass, go one level deep and let the work reveal the next, keep status and roll-up honest, and triage captured failures instead of letting them pile up. The same discipline applies whether a human prompts the session or a fleet worker pulls the node.

## The review agents

Two read-only agents review uncommitted or local changes before they hit a pull request, when the cost of a fix is a working-tree edit rather than a force-push and reviewer round-trip. They run on the local diff (working tree, staged, or topic-branch-vs-default) and produce a chat report. Neither edits, commits, pushes, or posts.

They cover **disjoint jobs** and compose: run both for full coverage, or either alone.

| Agent | Job |
|---|---|
| **`Local Code Review`** | Find bugs. One pass combining three review lenses (Advocate / Skeptic / Architect), a six-category checklist (design-coherence, api-contract, business-logic, test-fidelity, error-handling, concurrency), and implicit-invariant analysis: enumerate the state / threading / ordering / input invariants the diff assumes, then hypothesize and verify bugs against them. Every finding cites file:line, names a concrete trigger, and is verified by a second read before it ships. |
| **`Local Code Review (Consistency)`** | Match repo conventions. Reviews the diff against patterns already established in the same repository (sibling files, instruction files whose `applyTo` matches). Derives its rules from the repo at review time; ships no hard-coded checklist. Every finding cites a sibling demonstrating the convention plus a one-line fix. |

The bug-finder's rules forbid convention and style comments, so consistency is a separate agent rather than a section inside it. Both are host-agnostic: they reason about generic repository concepts (source vs test vs config, default branch, instruction files, a build gate that detects the repo's own warnings-as-errors flag) rather than any one toolchain. No model is pinned; both use the host default. See [`plugins/craft/agents/README.md`](plugins/craft/agents/README.md) for the full design.

Invoke by phrasing: "review my changes" / "self-review" / "pre-push review" for the bug-finder, "consistency review" / "convention review" for the Consistency agent.

## Install

```
copilot plugin marketplace add cdblake1/craft
copilot plugin install craft@craft
```

Node is required (the MCP servers and hooks run on `node`).

Verify it loaded with `/env`, which lists the skills, MCP servers, agents, and hooks the session sees. You should see the six craft skills, the two review agents, the `craft-journal` and `craft-compose` MCP servers, and the craft hooks.

## Using craft

Once installed, craft works with no configuration:

1. **Hooks run automatically.** Resume context, prior findings, the active work tree, and failure capture all happen with no prompting.
2. **Skills and MCP tools are offered to the agent automatically.** The host pre-loads each skill's name and description, and the agent invokes the matching workflow from how you phrase the work. Say "research the likely causes..." or "experiment whether X is faster..." and the matching skill is picked up. There are no instruction files to edit and nothing to paste.

Note on the built-in commands: Copilot CLI has its own `/research` and `/plan` slash commands. craft's `research` and `implementation` are *skills* (behavioral disciplines the agent loads mid-task), not those commands; they are complementary, and you can use either.

## Data and sync

Craft data lives under `~/.copilot/craft-data` by default, or wherever `$CRAFT_DATA_ROOT` points. Sync is **opt-in and off by default**: nothing turns the data directory into a git repo until you ask. To sync across machines, point it at a private git repo:

```
setx CRAFT_SYNC_REMOTE "git@github.com:<you>/<your-craft-data>.git"
```

With a remote configured, `sessionStart` pulls and `sessionEnd` commits and pushes. Append-only JSONL uses git's `merge=union` so concurrent appends from two machines merge without a hand-resolved conflict; a singleton lock serializes git operations on one host, and a failed push leaves a marker that reconciles on the next pull.

Useful environment switches: `CRAFT_SYNC_DISABLE`, `CRAFT_FAILURE_CAPTURE_DISABLE`, `CRAFT_WORKTREE_INJECT_DISABLE`, `CRAFT_PROPAGATE_DISABLE` (turns off both the skill catalog and the prompt router; or scope it with `CRAFT_CATALOG_INJECT_DISABLE` / `CRAFT_ROUTER_DISABLE`), `CRAFT_DISPATCH_DISABLE` (and per-event `CRAFT_DISPATCH_<EVENT>_DISABLE`).

## Test

```powershell
pwsh tests/Test-Craft.ps1
```

Runs the node test suite plus manifest and reality-gate checks (the MCP servers are exercised as real stdio processes). The full suite runs in a few seconds and spawns no git.

## Status

Staged in a personal repo and not yet listed on a public marketplace. MIT licensed and built host-agnostic, intended to be shared more widely later. The copilot-tools journal and backlog copies keep running until craft is the live install.
