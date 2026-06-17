---
name: decompose
description: 'Break a goal into the roadmap -> plan -> item work hierarchy with discipline, using the compose MCP. Use for: decompose this, break down this work, plan out this goal, turn this into a roadmap/plan/items, structure this work, what plans does this need, decompose a roadmap goal, fleet decomposition, how should I break this down, organize work into plans.'
---

# Decompose work

Turn a goal into structured, trackable work in the **roadmap → plan → item** hierarchy, using the compose MCP. This skill is opinionated about *how* to break work down, not *what* the work is.

The division of labor is the whole point. The **compose MCP enforces structure**: three levels, a valid parent for every link, a valid status. It cannot decide the things that actually make a decomposition good or bad. Those are this skill's job:

- **Leveling** — is this a roadmap, a plan, or an item?
- **Amount** — how many children to create in one pass.
- **Depth** — how far down to go before you stop and let the work itself tell you the next level.

Both modes load this skill, a human-prompted session and an autonomous fleet worker, so work gets decomposed the same disciplined way regardless of who is driving.

**Skip-gate:** a single, self-contained task is just an item. Call `compose_capture` and move on. Do not stand up a roadmap and a plan to hold one chore, that is ceremony the structure does not need.

## Choose the level

Pick the level by what the thing *is*, not by how big it feels.

- **Roadmap** — a narrative outcome you steer toward, spanning more than one plan. Its health is a sentence ("on track", "blocked on X"), never a computed number. You will have few of these. `compose_roadmap`.
- **Plan** — a decided body of work with a definition of done. This is the unit you actually execute; it carries prose plus a rolled-up `completion_pct`. `compose_plan`, optionally under a roadmap.
- **Item** — one concrete leaf: a task, a change, a captured finding, a failure. This is the backlog. `compose_capture`, optionally linked to a plan.

Two quick tests keep the tree from bloating:

- **Don't create a roadmap unless at least two plans will hang off it.** One plan under a roadmap is a plan with a hat on.
- **Don't create a plan for a single item.** If the body of work is one concrete thing, capture the item directly; promote it to a plan only when it grows a second sibling.

When in doubt, level *down*: capture an item now, and let it earn promotion to a plan when real sub-work appears. Under-leveling is cheap to fix (`compose_plan` then `compose_link`); over-leveling leaves empty scaffolding that rots.

## Decompose one pass at a time

The failure mode is decomposing the whole tree upfront. Resist it. One pass creates **one level of children, then stops.**

- **At most five to seven children per pass.** If a node wants a dozen children, something is off: the parent is really two parents, several "children" are one child, or you are inventing work that does not exist yet. Split the parent or merge the children until the count lands in range.
- **Go one level deep, then stop.** When you decompose a roadmap, create its plans and stop, do not drill into each plan's items. When you start a plan, *then* capture its items. Decomposing three levels in one sitting produces fiction: the act of starting a plan is what teaches you its real items.
- **Breadth before depth.** Get the current level's siblings right before going deeper. A roadmap with the right five plans is worth more than one plan exploded into thirty speculative items.
- **Let work reveal the next level.** A node you have not started cannot be honestly decomposed. Leave it coarse until it is the thing you are actually doing.

Mechanically: `compose_plan` (or `compose_capture`) once per child, linking to the parent as you go (`compose_link` if you created a node separately). Keep each child's title concrete enough that someone could pick it up cold.

## Keep the tree honest

A decomposition is only useful while it matches reality. The tree lies the moment status drifts from the work.

- **Move status as the work moves.** `compose_status` when an item starts, ships, is dropped, or parks. An "open" item that actually shipped, or an "in-flight" plan nobody has touched in a week, quietly corrupts every view built on top.
- **Roll up after status changes.** `compose_rollup` the affected plan so its `completion_pct` reflects reality. Roll-up is deterministic (shipped over non-dropped), so it is only as honest as the statuses feeding it.
- **Roadmap health stays a sentence.** Never invent a roadmap percentage. Write the real state in its body: "on track", "blocked on the adapter", "descoped the sync work". A narrative the reader trusts beats a number that drifts.
- **Triage captured failures; do not let them pile up.** Auto-captured `failure` items surface at session start. Each one needs a *decision*, not accumulation: link it to the plan that will fix it (`compose_link`), or drop it (`compose_status <id> dropped`) when it is transient or noise. An untriaged failure heap defeats the point of capturing failures at all.

The session-start view shows in-flight plans and open failures precisely so this hygiene happens at the moment a session has the context to do it.

## Two modes, one discipline

The same rules apply whether a human prompted the session or a fleet worker pulled the node. That consistency is why the discipline lives in this skill and not in worker code: a human reviewing a fleet-decomposed tree sees exactly the conventions they would have applied themselves.

- **Prompted.** A human asks to decompose or plan a goal. Converge with them: one question about level or scope if it is genuinely ambiguous, then decompose a single pass, show the result, and let them steer the next pass. The human is the checkpoint between passes.
- **Autonomous (fleet).** A worker pulls a roadmap or plan node and decomposes it with no human in the loop. Same rules, but the checkpoint is gone, so converge with the *evidence* instead: read the parent's prose, the existing siblings, and recent items before creating anything. Be conservative, when the level or scope is genuinely unclear, `compose_capture` an item that names the ambiguity rather than inventing a plan or roadmap to resolve it. A wrong structural guess with no human to catch it is the expensive mistake.

Both modes obey the same pass size, the same one-level depth, and the same status hygiene. The only difference is what you converge against: a person, or the evidence already in the tree.

## End state

A tree where every node sits at the right level, with no empty scaffolding: roadmaps that genuinely hold multiple plans, plans with a real definition of done, items concrete enough to pick up cold. Statuses track the work, roll-ups are honest because the statuses feeding them are, roadmap health reads as a trustworthy sentence, and captured failures have been triaged into plans or dropped rather than left in a heap.

It got there one pass at a time. The compose MCP enforced the structure; this skill kept the structure sane. Anyone, a teammate or a fleet worker, can open `compose_tree` and trust that what they see is the real shape of the work.
