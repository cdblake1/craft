# Pre-registration: decompose-capability validation (gate)

Pre-registered **before** scoring, per the `experiment` skill (decide by the rule, no goalpost
moving). This gate validates the **decompose capability**, the compose MCP plus the decompose
discipline it enforces, as a whole, the way `app-pm` validates the spec-writing skills. It is the
validation plan the capability owed (it previously had only function-level unit tests).

## What is under test

- **The artifact:** `plugins/craft/mcp-servers/compose/` (the compose MCP: 9 tools, the node model,
  failure capture, the work-tree injection) and the `decompose` / `app-decompose` skills that drive it.
- **The reference bar:** design `0001-foundation-and-work-composition.md`, decisions D3, D4, D6, D7 and
  the cross-cutting concerns. These are the contract the capability claims to uphold.

## Oracle: the capability invariants

The gate is the runnable end-to-end test
`plugins/craft/mcp-servers/compose/capability.test.js`, which drives a full decompose lifecycle
through the real MCP dispatch and the real model and asserts one invariant per design promise:

| # | Invariant (from design 0001) | Oracle |
|---|---|---|
| D4 | A small, fixed, **described** tool surface (no dead-tool sprawl) | `tools/list` is exactly the documented 9-tool set, each with a description and an object input schema |
| D3-a | Three levels with **enforced** parents | an item cannot link to a roadmap; a plan cannot link to a plan |
| D3-b | **Deterministic** count-based roll-up | shipped / (non-dropped), persisted, repeatable (same input gives the same number) |
| D3-c | Roadmap health stays **narrative** | a roadmap node never carries a computed `completion_pct` |
| D6 | Trigger-based failure capture that **surfaces** | a recorded failure fact becomes an open `failure` item that appears in the work-tree injection and can be triaged away |
| D7 | **Mode-agnostic + persisted** | the tools alone build a valid tree that a second session (new instance over the same store) sees identically |
| + | Link integrity reported, orphans **never dropped** | a dangling item link is reported by rollup and the orphan still appears in `compose_tree` |

## Decision rule (pre-registered)

- **GATE PASSED** iff **all** invariants pass in `capability.test.js` AND the full compose suite
  (`node --test plugins/craft/mcp-servers/compose/`) and the stdio test
  (`tests/Test-CraftComposeMcpStdio.ps1`) are green.
- A single failing invariant fails the gate; the capability is not validated until it is fixed.

## Scope and honest caveats

- This gate validates the **mechanism** (the MCP + model + capture loop upholds the design
  invariants), not the **judgment** (whether a given decomposition is well-leveled). Leveling is the
  `decompose` skill's prose discipline; `fleet-conformance.test.js` separately locks the bridge-ready
  contract that the dispatch path depends on.
- It is a deterministic, in-process gate (no live agent, no network), so it is fast and runs in CI;
  the trade-off is that it proves the invariants hold, not that an agent always chooses to use them
  well.
