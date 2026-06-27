# Scorecard: decompose-capability validation gate

The pre-registered rubric ([`PREREGISTRATION.md`](PREREGISTRATION.md)) applied to the compose MCP +
decompose discipline. Scored against the fixed decision rule; no goalposts moved.

## Evidence

The gate oracle is `plugins/craft/mcp-servers/compose/capability.test.js` (runs under
`node --test`), plus the existing compose suite and the stdio test.

| Invariant | Oracle | Result |
|---|---|---|
| D4: small described tool surface | `tools/list` == documented 9-tool set, each described + object schema | **PASS** |
| D3-a: three levels, enforced parents | item-to-roadmap and plan-to-plan links rejected | **PASS** |
| D3-b: deterministic roll-up | shipped/(non-dropped), persisted, repeatable | **PASS** |
| D3-c: narrative roadmap health | roadmap node carries no computed `completion_pct` | **PASS** |
| D6: failure capture surfaces | recorded fact becomes an open `failure` item, surfaces in the injection, then is triaged away | **PASS** |
| D7: mode-agnostic + persisted | tools alone build a tree a new instance over the same store sees identically | **PASS** |
| + link integrity / no silent drop | dangling link reported by rollup; orphan still in `compose_tree` | **PASS** |

Supporting suites: `compose.test.js`, `server.test.js`, `failure.test.js`, `frontmatter.test.js`,
`fleet-conformance.test.js`, and `Test-CraftComposeMcpStdio.ps1`, all green.

## Decision (by the pre-registered rule)

All seven capability invariants pass AND the full compose suite + stdio test are green.

**Result: GATE PASSED. The decompose capability is validated against its design invariants.**

## Scope and caveats

- **Mechanism, not judgment.** The gate proves the compose MCP + capture loop uphold the design
  invariants; it does not prove an agent always *levels* a decomposition well (that is the
  `decompose` skill's prose discipline, exercised by humans and reviewed, not asserted here).
- **In-process and deterministic.** No live agent and no network, so the gate is fast and CI-able;
  the trade-off is it validates the contract, not real-world dispatch end to end (the
  `fleet-conformance` test locks the bridge contract; a live fleet run is a separate, heavier check).
- **Single capability.** One capability (decompose/compose), scored on its own invariants. A broader
  claim about the whole craft toolchain needs the other capabilities' own gates.
