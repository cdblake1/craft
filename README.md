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
| **`craft-journal` MCP** | Resume continuity and findings reuse. Relevance-ranked (BM25) search over prior findings, per-branch plan and step-log, draft seeding. 9 tools. |
| **`craft-compose` MCP** | Roadmap, plan, item work composition. Create and link nodes, status, deterministic roll-up, the unified tree. Write-time PII guard. 7 tools. |
| **Node hook dispatcher** | Runs the lifecycle handlers in an explicit, ordered registry across `sessionStart`, `postToolUse`, `postToolUseFailure`, and `sessionEnd`. |
| **Storage adapter + sync** | One git-backed adapter under both MCPs and every hook; opt-in session-boundary sync across machines. |

The four workflow skills form a pipeline, most agent work starts at the top: **research** (answer the question, surface hypotheses) leads to **experiment** (validate the winners empirically), which leads to **implementation** (build them), with **decompose** structuring the work. Each skill earns its place by a pre-registered behavior-change A/B before it ships; the research and experiment workflows were validated at 9/9 vs 0/9 on their headline behaviors (`copilot-tools/experiments/craft-rx-workflow-validation/`).

## Architecture

Everything addresses data through a single storage adapter (`lib/storage.js`), by a logical, slash-separated key, never the filesystem directly. The journal and compose MCPs and every hook share that one data layer, so persistence and cross-machine sync are solved once, in one place. The default backend is a git-backed directory; the interface is deliberately small so a future multi-user backend can replace it without rewriting the layers above. The full design is in [`docs/design/0001-foundation-and-work-composition.md`](docs/design/0001-foundation-and-work-composition.md).

The hooks are where the value surfaces automatically:

- **`sessionStart`** pulls the latest data (when sync is configured), then injects one merged block: where you left off (last-session recap and current plan), prior findings ranked by relevance to the branch, the active work composition (in-flight plans and open items), and any captured failures awaiting triage.
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

## Install

```
copilot plugin marketplace add calebblake_microsoft/craft
copilot plugin install craft@craft
```

Node is required (the MCP servers and hooks run on `node`).

Verify it loaded with `/env`, which lists the skills, MCP servers, and hooks the session sees. You should see the four craft skills, the `craft-journal` and `craft-compose` MCP servers, and the craft hooks.

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

Useful environment switches: `CRAFT_SYNC_DISABLE`, `CRAFT_FAILURE_CAPTURE_DISABLE`, `CRAFT_WORKTREE_INJECT_DISABLE`, `CRAFT_DISPATCH_DISABLE` (and per-event `CRAFT_DISPATCH_<EVENT>_DISABLE`).

## Test

```powershell
pwsh tests/Test-Craft.ps1
```

Runs the node test suite plus manifest and reality-gate checks (the MCP servers are exercised as real stdio processes). The full suite runs in a few seconds and spawns no git.

## Status

Staged in a personal repo and not yet listed on a public marketplace. MIT licensed and built host-agnostic, intended to be shared more widely later. The copilot-tools journal and backlog copies keep running until craft is the live install.
