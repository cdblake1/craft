# Release-readiness: the decompose capability

A go/no-go over the **assembled decompose capability** (the compose MCP + the `decompose` /
`app-decompose` skills) after the W1–W4 pass. This is the terminal gate: `product-quality`
([`product-quality.md`](product-quality.md)) says how good it is and what to fix next; this skill says
whether what exists is **ready to ship**. Run per the `release-readiness` skill.

## Stage stage classification (the bar is scaled to this)

decompose-mcp is a **pre-users, internal developer-tool capability shipped inside the craft plugin** —
no live service, no external end-users, no network surface, local-first git-backed store. The release
literature's service gates (live monitoring, error budgets, staged-rollout automation) are therefore
**reasoned non-goals** at this stage and are marked as such below — they are not faked as met.
Security/privacy is the one gate that is **never** a non-goal and is treated as a real gate here.

## Stage 1 — The spec's validation plan, run

The validation plan is the product's debt; executing it is the core of this gate.

| Oracle | Evidence | Result |
|---|---|---|
| 7 capability invariants (D3/D4/D6/D7 + link integrity) | `capability.test.js` under `node --test` | **PASS** |
| Full compose suite (~79 tests) | `node --test plugins/craft/mcp-servers/compose/*.test.js` | **PASS, 0 fail** |
| Stdio JSON-RPC integration | `tests/Test-CraftComposeMcpStdio.ps1` | **PASS, 8/8** |
| Sync handlers | `sync.test.js` | **PASS** |

**Outcome measurability (folded in from discovery):** the north-star has two halves. The *decompose /
track* half is measurable through the tree and roll-up. The *failure-capture* half (D6's capture-rate
outcome, 44% baseline) is **not currently measurable for compose** — there is no failure-signal
reporter. This is the one outcome the build cannot yet be measured against (carried as gap **G1** in
`product-quality.md`).

## Stage 2 — Launch-gate items

| Gate item | Status | Evidence / basis |
|---|---|---|
| **Success measures defined** before launch | **Partially met** | Structural invariants are pre-registered and measured; the failure-capture-rate measure is defined in the design but has no reporter (G1). |
| **Accessibility** (scaled to a tool surface) | **Met (scoped)** | No GUI by design → WCAG is a reasoned non-goal. The accessible-surface equivalent — every tool described, object schemas, plaintext+fenced-JSON output the agent renders verbatim — holds. |
| **Security & privacy** (real gate, every stage) | **Met** | Write-time PII guard (`pii.js`: user paths, emails, AzDO/aka.ms links) on every free-text tool field; auto-capture runs `failure.sanitize` + a belt-and-suspenders detector pass so a failure item can never publish PII; design forbids secrets entering the data repo. No tokens/usernames in logged output (stderr is diagnostics only). |
| **Docs & support** | **Partially met** | Tool descriptions + the two skills document usage; repo `README.md` exists. **No compose-capability README** next to the server (gap G5). Support path = the skills + the validation docs. |
| **Rollout & rollback** | **Reasoned non-goal** | Not a service. "Rollout" = shipping plugin code; the data store is git-backed (history = rollback). No staged-rollout automation is in scope at this stage. |
| **Monitoring & operations** | **Reasoned non-goal (with one caveat)** | No live service to monitor. Caveat: the documented sync failure modes (undetected push, stale `index.lock`, `.pending-push`) have no surfaced signal when they trip (minor gap G6) — operability, not a launch blocker. |

## Stage 3 — Decision

### Readiness scorecard
| Item | Status | One-line basis |
|---|---|---|
| Validation plan run | ✅ | Every suite green: capability gate + ~79 compose tests + stdio + sync |
| Core mechanism (D3/D4/D6/D7) | ✅ | All invariants upheld on evidence |
| Security & privacy | ✅ | PII guard + sanitize, tested; no secrets/PII path to the synced store |
| Accessibility (tool-surface scope) | ✅ | Described tools + schemas; GUI a reasoned non-goal |
| Success measures | ⚠️ | Structure measured; failure-capture-rate not yet measurable (G1) |
| Docs & support | ⚠️ | Skills + repo README present; no compose README (G5). *(The "7 tools" drift, G2, was fixed during the design-doc cleanup.)* |
| Rollout / rollback | ➖ | Reasoned non-goal (not a service; git history = rollback) |
| Monitoring / ops | ➖ | Reasoned non-goal; sync-signal visibility a minor follow-up (G6) |

Legend: ✅ met · ⚠️ met-with-gap · ➖ reasoned non-goal for this stage.

### Verdict

**GO — ship the decompose capability at its current stage (internal plugin capability).**

**Basis:** the spec's validation plan ran and passed in full, every applicable launch-gate item is met
or a reasoned non-goal for a pre-users internal tool, and the one gate that is never a non-goal
(security/privacy) is met with tested evidence. The remaining ⚠️ items (failure-capture observability G1,
docs G5) are **quality gaps that do not block a pre-users ship** — they block the *next* milestone
(claiming the D6 capture-rate outcome is achieved), not this one. Per the pre-registered stage bar,
none of them is a broken must-be in the shipped mechanism.

**Decision owner:** this gate. In the autonomous loop the gate is the owner of record, and this
scorecard is the record.

**Condition on the GO:** the GO is for the *internal capability* stage only. It does **not** authorize
claiming D6's "auto-capture raised the failure-capture rate" outcome — that claim requires G1
(observability) first. Treat that as the explicit gate for the next milestone.

## Stage 4 — Route-back and learning

This is assessment-only, so the no-go routing is not triggered (the verdict is GO). The ranked gaps
are already handed to `product-quality.md` as the next wave; G1 leads it (G2 was closed during this
design-doc cleanup).

**Blameless learning note — what this build proved and what to revisit:**
- **Proved:** the compose mechanism upholds every design invariant under real MCP dispatch and a
  second-session reload; PII never reaches the synced store; the W1–W4 hardening (superlinear tree
  cost, bounded item log, status filter, text-size guard, orphan surfacing, link integrity, doc-write
  lock, unlink/re-parent) holds under test.
- **To revisit:** (1) the capability ships *measurable on structure but not on failure capture* — wire
  the failure signal + reporter (G1) before claiming the D6 outcome; (2) internal docs had drifted
  behind the tool surface ("7 tools" vs 9, G2 — fixed during this cleanup) — keep the server header in
  lockstep with `TOOLS` going forward; (3) judgment (leveling) remains unguarded by the mechanism (G3)
  — decide whether a soft lint is worth it. These feed the next discovery and quality passes.

## End state

A single **GO** over the assembled decompose capability, backed by a scorecard: the validation plan
run and green, every launch-gate item met or a reasoned non-goal for the pre-users stage, security and
privacy met with evidence, and an owner on the verdict. The GO is explicitly conditioned — it ships the
internal capability but not the D6 outcome claim — and the blocking-for-next-milestone gaps are routed
into `product-quality.md`'s next wave so the gate moves the product forward.
