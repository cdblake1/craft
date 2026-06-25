---
name: writing-spec
description: 'Structure a human-reviewable specification / design doc that a reviewer can judge fast on a PR before code is written. Use for: write a spec, draft a design doc for review, spec template, feature spec, implementation spec, spec for human review, what sections should a spec have, structure a design doc, RFC-style spec, design proposal for review. NOT for: prose voice / AI-ism / em-dash review (see writing-documentation), the build workflow itself (see implementation), code comments, UI strings.'
---

# Writing a Spec

A spec exists to let a reviewer decide, fast, whether the plan is right BEFORE code is written. This
skill owns the spec's STRUCTURE: the section spine and the rules that make it reviewable. It does not own
prose voice: for verdict-first phrasing, AI-ism scrubbing, em-dash sweep, and the mechanical self-review,
defer to the `writing-documentation` skill and run its checklist on the finished spec.

Synthesized from seven standards that converge on the same spine: IETF RFC 2119
(https://www.rfc-editor.org/rfc/rfc2119.txt), MADR (https://adr.github.io/madr/), Kubernetes KEP
(https://github.com/kubernetes/enhancements/tree/master/keps/NNNN-kep-template), Rust RFC
(https://github.com/rust-lang/rfcs/blob/master/0000-template.md), Oxide RFD
(https://oxide.computer/blog/rfd-1-requests-for-discussion), Python PEP 1/12 (https://peps.python.org/pep-0001/),
and Google design docs (https://www.industrialempathy.com/posts/design-docs-at-google/).

## When to use this skill

- You are about to write a spec, design doc, or RFC that a human will review.
- You are in the implementation workflow's Design stage and the change is non-trivial enough to warrant a
  written, reviewable spec.
- You are reviewing a spec and want to check it is structured for fast review.

Skip it for a one-line fix or an obvious change: make the edit, add a test, move on. Forcing a spec onto
a trivial change is noise.

## The template

Fill the sections that apply; mark a section "N/A" only with a one-clause reason. Headings are fixed so
reviewers can navigate any spec the same way. Keep the whole thing to a 20-minute read.

```markdown
---
title: <imperative phrase: verb + noun, e.g. "Add per-tenant rate limiting">
status: draft | in-review | accepted | rejected | superseded
area: <component / area path>
work-item: AB#NNNNNN        # or issue link
authors: <name>
reviewers: <names of the domain experts who must sign off>
confidence: high | medium | low
---

# <title>

> TL;DR: one sentence. What we are building and why. A reviewer decides whether
> to read on from this line alone.

## Problem / Motivation
The pain that exists today, with one concrete example or data point. What breaks
or is missing, and why now. No solution here. (For a bug fix, link the repro
verdict + evidence.)

## Goals
Falsifiable bullets, each ending in "so that <why>". A goal a reviewer cannot
test against the proposal is not a goal.

## Non-Goals
Things that look in scope but are deliberately out, each with its reason. Each
non-goal preempts one category of off-topic review comment.

## Root cause            (bug fixes only)
The specific file + function + mechanism that produces the reported behavior.

## Proposal / Design
The mental model first, then the change. Lead with the shape; put detail below.

### Diagram
At least one Mermaid diagram (a fenced `mermaid` code block) of the design: the
control/decision flow (flowchart), the call path (sequence diagram), or how the
parts fit (component/architecture). Lead with the diagram, then the prose. Mark
"N/A" only for a genuinely linear change, with a one-clause reason.

### API / Interface surface       (when an interface changes)
Sketch ONLY the types, fields, flags, or endpoints that drive a trade-off.
Do NOT paste full schemas or proto/SQL definitions; link them. Use RFC 2119
MUST / SHOULD / MAY for behavioral requirements, sparingly.

### Implementation notes
Key algorithmic or data-model choices, concurrency/ordering concerns. Pseudocode
only for a genuinely novel algorithm. Skip boilerplate.

## Alternatives considered
One block per serious option. For each: one sentence on what it is, then WHY it
was rejected. Include "Do nothing". The rejection reason is the load-bearing part.

## Risks / blast radius
| Risk | Severity (H/M/L) | Mitigation |
|------|------------------|------------|
Cover at least: security surface change, compatibility break, performance
regression, failure blast radius. FLAG any cross-team / downstream breakage as a
risk to surface (an autonomous author cannot resolve cross-team coordination).

## Validation / test plan
Concrete. Name the test types and the scenario each covers, and the oracle that
tells pass from fail. For a user-visible change, how it is dogfood-verified.

## Rollout / compatibility       (feature / user-facing)
Flag or staged? Rollback procedure? Effect on existing users/data on upgrade?
Deprecations? Cross-team coordination needed before launch?

## Open questions
Each with an owner and a "resolve by". Use checkboxes. An unowned question is a
blocker hiding as a comment.
- [ ] Q1: <question> -- owner: <name> -- resolve by: <milestone>

## References
Work item, related PRs, prior spec/ADR, external prior art.
```

## The 9 reviewability rules

1. Decision first. TL;DR + Goals + Non-Goals must be readable in under two minutes. If a reviewer must
   read the whole doc to learn what is being decided, it is not ready.
2. Non-goals carry their reason. A non-goal is "we are deliberately not doing X", not "it will not crash".
3. Alternatives are mandatory and the WHY-rejected is the only part with signal. "We considered X" with no
   reason generates more noise than omitting it.
4. Open questions are first-class: each has an owner and a milestone.
5. RFC 2119 keywords (MUST/SHOULD/MAY) mark which lines are hard requirements vs guidance. Use them with
   care and sparingly; overuse destroys the signal.
6. Sketch APIs, do not dump schemas. Paste only what drives a trade-off; link the full definition.
7. The risks table owns the blast radius, so a security or ops reviewer can scan it in 30 seconds. Do not
   bury risk in prose.
8. Length is a quality signal. Target a 20-minute read. AI-bloat (paragraphs restating their heading,
   padding bullets, hedging that makes every sentence true and uninformative) means the author has not
   made the decisions yet, and the spec is not ready.
9. A non-trivial flow or structure carries a diagram. Include at least one Mermaid diagram (a fenced
   `mermaid` block) for any non-trivial control flow, call path, or component interaction, so a reviewer
   grasps the shape from the picture before the prose. N/A only for a genuinely linear change, with a
   one-clause reason.

## Before you publish

1. Every applicable section is filled; each "N/A" has a one-clause reason.
2. The Alternatives section names every serious option with its rejection reason.
3. Every open question has an owner and a milestone.
4. Run the `writing-documentation` self-review on the file (verdict-first phrasing, no AI-isms, no
   em-dashes, tables for trade-offs). Fix every flag.
5. The whole spec reads in 20 minutes or it gets split.
6. The Proposal/Design carries at least one Mermaid diagram in a fenced `mermaid` block (or an N/A reason).
