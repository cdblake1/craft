# Product-quality assessment: the decompose capability

A whole-product pass over the **decompose capability** (the compose MCP + the `decompose` /
`app-decompose` skills) after the W1–W4 improvement pass. This is the step the validation gate does
not take: the gate ([`scorecard.md`](scorecard.md)) proves the design invariants hold; this skill
steps back, scores the assembled capability against a bar defined *before* judging, and hands back one
ranked list of what to fix next. Run per the `product-quality` skill. **Assessment only** — no fixes
are made here.

## Stage 1 — The quality bar (defined before judging)

### The three sources of the bar
- **Feature matrix** — the capability's design decisions D2–D7, the implemented slices,
  decisions D2–D7, the 8 implemented slices, the goals/non-goals, and the cross-cutting concerns.
- **Validation plan** — [`PREREGISTRATION.md`](PREREGISTRATION.md) (7 capability invariants + the
  compose suite + the stdio test).
- **Experience bar** — decompose-mcp has **no GUI** (an explicit non-goal of the capability). The `uiux-design`
  experience bar is therefore a **reasoned non-goal**; the "experience" is judged as the **tool-surface
  and skill-prose contract** instead: are the tools described, discoverable, and hard to misuse, and is
  the decomposition discipline legible.

### goals → signals → metrics
| Quality goal (for a work-composition tool) | Signal it is met | Metric |
|---|---|---|
| Structure is trustworthy | A tree built only through the tools is valid and survives a new session | Capability gate D3/D7 invariants pass (✔) |
| Failures get captured, not lost | An observable tool failure becomes a triageable item with no agent effort | **Capture rate** of failing sessions (design baseline: 44%) — *not currently measured* |
| Decompositions are well-leveled | Trees show right-sized passes (5–7 children, one level deep) and honest status | *No automated signal; prose discipline only* |
| The store never leaks identity | No path / email / link is ever persisted | PII guard rejects at write time; sanitize on auto-capture (✔, tested) |
| Context stays bounded | A large forest cannot blow the agent's context | `compose_tree` text cap + item-log compaction (✔, tested) |

### The one leading outcome (north-star)
**Work gets decomposed and tracked the same disciplined way in both modes (prompted and fleet), and
failures are reliably captured** — so an app-sized build comes out of one honest, living tree instead
of accreting piecemeal. Everything below is ordered by how much it serves this outcome.

## Stage 2 — Assessment of the assembled product (on evidence)

### Validation plan — run, not assumed
| Suite | Command | Result |
|---|---|---|
| Capability gate (7 invariants) | `node --test .../compose/capability.test.js` | **PASS** (D4, D3-a/b/c, D6, D7, link-integrity) |
| Full compose suite | `node --test plugins/craft/mcp-servers/compose/*.test.js` | **PASS** — ~79 tests, 0 fail |
| Stdio integration | `tests/Test-CraftComposeMcpStdio.ps1` | **PASS** — 8/8 |
| Sync handlers | `sync.test.js` | present + green |

### Feature surface — present vs expected
| Surface | Expected (bar) | Built | Verdict |
|---|---|---|---|
| Tool surface | Small, described, no dead-tool sprawl (D4) | 9 tools, each with description + object schema | **Meets** (count grew 7→9 with `compose_unlink`/`compose_update`, both described + tested) |
| Three-level model | roadmap→plan→item, enforced parents, ULIDs (D3) | Enforced; level rules rejected in tests | **Meets** |
| Roll-up | Deterministic shipped/(non-dropped), persisted (D3) | Implemented, persisted, repeatable | **Meets** |
| Failure capture | Trigger-based, fact-grounded, dedup, surfaces (D6) | `failure-record` + `failure-capture` hooks wired; fingerprint + sanitize tested | **Meets (mechanism)** |
| Tree injection | Session-start work-tree surfaced (slice 7) | `work-tree-injector` wired; injection tested | **Meets** |
| Mode-agnostic + persisted | Same tools both modes; new session sees same tree (D7) | Proven by D7 invariant | **Meets** |
| PII safety | Write-time reject + auto-capture sanitize | `pii.js` guard + `failure.sanitize` belt-and-suspenders | **Meets** |
| Decompose discipline | Leveling/amount/depth as reviewable prose (D7) | `decompose` + `app-decompose` skills | **Meets (as prose)** |
| Observability | Failure-signal log + on-demand reporter (cross-cutting) | Journal has `signal-report`; **compose failure capture has none** | **Gap** |
| Capability docs | A user can find how to use the 9 tools | Tool descriptions + skills; **no compose README / user doc** | **Partial** |

## Stage 3 — Gaps (importance vs satisfaction)

| # | Gap | Kind | Importance | Satisfaction | True gap vs scope |
|---|---|---|---|---|---|
| G1 | **No observability on failure capture.** D6's whole point is raising the capture rate (44% baseline), but nothing measures it for compose — the leading outcome is unmeasurable on its failure half. | Must-be (measurability) | High | Low | True gap |
| G2 | **Doc drift: "seven tools"** *(RESOLVED during the design-doc cleanup — `server.js` now reads "Nine tools" and lists all 9; the design catalog that also drifted was deleted)*. The header comment had said 7 tools while the real surface is 9 (`compose_unlink`, `compose_update`). | Must-be (correctness of docs) | Medium | ~~Low~~ → met | Resolved |
| G3 | **Leveling judgment is unguarded.** The gate proves structure, not whether a decomposition is well-leveled (5–7/one-level). No signal catches an over-deep or 30-child pass; it relies entirely on skill prose. | Performance | Medium | Low | Known caveat → true gap |
| G4 | **No live-agent / real-dispatch end-to-end.** The gate is in-process and deterministic; `fleet-conformance` locks the bridge contract but no live fleet run exercises a real decompose→dispatch loop. | Performance | Medium | Low | Documented caveat |
| G5 | **No compose capability README.** A new user discovers the 9 tools only via schemas + the skill; there is no one-page "what this is / how to drive it" doc next to the server. | Delight/onboarding | Low | Low | True gap |
| G6 | **Sync failure-mode visibility.** Sync is tested (`sync.test.js`), but the design's documented failure modes (undetected push, stale `index.lock`, `.pending-push` reconciliation) have no surfaced signal when they trip silently. | Performance | Low | Medium | True gap (minor) |

Deliberate scope decisions (recorded as reasoned non-goals, **not** gaps): no GUI/web view; no
parallel-DAG decomposition; no multi-user backend; no lesson capture (journal owns it); fleet
dispatch-at-any-level deferred to a later cross-repo phase.

## Stage 4 — The ranked gap list (headline output)

Ranked by impact/effort, confidence-discounted, with cost-of-delay respected.

| Rank | Gap | Kind | Impact / Effort | Confidence | Why here |
|---|---|---|---|---|---|
| **1** | **G1 — Add a compose failure-capture signal + on-demand reporter** (mirror the journal's `signal-report`). | Must-be | High / Low–Med | High | Unblocks measuring the north-star's failure half; the design already promised it and the journal pattern exists to copy. Cost of delay: every session that ships without it leaves D6 unproven in practice. |
| **2** | **G2 — Fix the "seven tools" drift** in the `server.js` header to 9. *(RESOLVED — done during the design-doc cleanup; header now reads "Nine tools" and lists `compose_unlink`/`compose_update`.)* | Must-be | Med / Low | High | Was the cheapest high-certainty fix; a described-surface promise (D4) with a wrong header comment is a correctness defect. Now closed. |
| **3** | **G3 — A leveling sanity check** (e.g. a lint/warning when a single pass adds >7 children or a tree exceeds 3 levels), turning the skill's soft rule into a surfaced signal. | Performance | Med / Med | Medium | Closes the largest mechanism-vs-judgment gap; medium effort because "well-leveled" is partly subjective — start with the two hard numeric limits the skill already states. |
| **4** | **G5 — Write a compose capability README** (the 9 tools, the three levels, the wave rule, the PII contract). | Delight | Low–Med / Low | High | Low effort, improves onboarding for both humans and fleet authors; pairs naturally with the G2 doc fix. |
| **5** | **G4 — One live decompose→dispatch smoke run** recorded as evidence (heavier, periodic, not CI). | Performance | Med / High | Medium | Real-world proof beyond the contract test; deferred because it is heavy and the contract is already locked. |
| **6** | **G6 — Surface sync failure modes** (emit a signal when `.pending-push` is written or a stale lock is cleared). | Performance | Low / Low–Med | Medium | Minor; raises operability of the cross-machine path without changing its mechanics. |

## Stage 5 — Feed-forward (documented, not executed)

Per the **assessment-only** scope, the loop is documented but not run: this ranked list is the input
`app-decompose` would consume as the **next wave** (G1–G2 as a first, low-risk wave; G3–G5 as a
second). Because the gaps came from scoring the whole capability against one bar, that next wave stays
holistic rather than reactive. Re-run this skill after any such wave ships — quality iteration is a
loop.

## End state

The decompose capability **meets its structural bar** (every validation suite green, every D3/D4/D6/D7
invariant upheld) and is strong on its core mechanism. The ranked gaps are about **proving and
measuring** the outcome (G1 observability, G4 live run), **doc correctness** (G2, G5), and **guarding
judgment the mechanism can't** (G3) — none of them a broken must-be in the shipped mechanism. The top
two are cheap, high-confidence, and should lead the next wave.
