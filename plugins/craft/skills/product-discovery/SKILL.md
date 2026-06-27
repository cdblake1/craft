---
name: product-discovery
description: 'Validate that an application is the right thing to build before any spec or code: frame the problem as a job to be done, read the four product risks (value, usability, feasibility, viability), name the riskiest assumption and the cheapest test for it, and define success as outcomes. The discovery half of the PM discipline; runs upstream of product-spec. Use for: is this worth building, validate the idea, what problem are we solving, who is this for, opportunity assessment, the four product risks, jobs to be done, riskiest assumption, define success metrics, discovery, problem framing, should we build this. NOT for: the feature surface or competitive matrix (see product-spec), the experience (see uiux-design), judging a built product (see product-quality), shipping decision (see release-readiness), a single feature or chore (just build it).'
---

# Product discovery (is this the right thing to build)

Validate the problem before the solution. This skill owns the question every other craft skill assumes
already answered: is this app worth building, for whom, and against which risks. It is the discovery
half of the PM discipline; its peer `product-spec` owns the feature surface, and it runs first so the
spec starts from a validated problem rather than a feature list. The whole point: the most expensive
way to discover an idea was wrong is to build it, so the risks get tackled up front.

**Skip-gate:** this is for application-scale work, or a major new capability inside one. A single
feature or a chore does not need a discovery pass; name the change and build it.

**Honest adaptation (read this first).** The PM discovery literature assumes a human team with
customers it can interview every week. An agent working from a brief has no live customers. So this
skill does the *reasoning* disciplines of discovery (frame the job, read the four risks, find the
riskiest assumption, define outcomes) and grounds them in **research evidence**, not in interviews it
cannot run. Where a stage would normally mean "go talk to users," it means "ground this in the
category research `product-spec` will also use." State that substitution; do not pretend to have
talked to anyone.

## Stage 1 - Frame the problem as a job, before any solution

Name the problem and the job to be done before naming a single feature.

- State, in one crisp sentence each: **what problem** this solves, and **for whom**. If the problem
  statement is a list of features, it is not a problem statement yet; keep going until it is the gap a
  user feels, not the thing you want to build.
- Frame the **job to be done**: the functional, and where they matter the social and emotional,
  outcome the user is trying to achieve. The job outlives any product, so it is the stable target.
- Capture the **circumstance**: when and why the user reaches for a solution. This is what makes the
  problem real, not the demographics.

## Stage 2 - Read the four product risks

Assess all four risks the category names, not just whether the thing can be built.

- **Value** - will users choose or buy it. The risk most often skipped and most often fatal.
- **Usability** - can users figure out how to use it.
- **Feasibility** - can it be built with the time, skills, and technology available.
- **Viability** - does it work for the business and the constraints around it (cost, legal, support).

Write one honest paragraph per risk. A one-dimensional read (only feasibility, only usability) is the
named anti-pattern this stage exists to prevent. Ground the value read in the incumbent demand and
category evidence `product-spec` surfaces, since you cannot run a live demand test.

## Stage 3 - Name the riskiest assumption and its cheapest test

Find the single assumption that, if wrong, invalidates the effort, and decide how to test it cheaply.

- State the **riskiest assumption** explicitly. It is usually a value or feasibility bet, the thing
  the whole app leans on.
- Name the **cheapest test** that would expose it: a throwaway prototype, a spike, a research probe,
  not a finished build. The principle is to learn as quickly and cheaply as possible.
- Hand that test to the build as a **spike**, sequenced first. `app-decompose` already orders
  spike-gated, riskiest parts first; this is the input that tells it which part that is.

## Stage 4 - Define success as outcomes, not outputs

Decide what success means before the spec, in terms of impact rather than features shipped.

- Define the **outcome measures**: the change in user behavior or business result that means this
  worked. "Feature X ships" is an output; "users complete the job in one session" is an outcome.
- These measures are the seed the spec's validation plan and the `release-readiness` go/no-go both
  build on, so write them to be testable later even if they cannot be measured now (pre-users).
- Keep them few. One leading outcome that connects user value to product health beats a dashboard of
  vanity metrics.

## Stage 5 - Hand off to the spec, and reconcile

Discovery feeds `product-spec`; it does not produce the feature surface itself.

- Hand `product-spec` the **validated problem, the job, the four-risk read, the riskiest-assumption
  spike, and the outcome measures**. The spec turns the validated problem into the feature surface and
  the competitive matrix.
- Stay open to **reconciliation**: if the spec or a later quality pass shows the problem was framed
  wrong, reopen discovery. A single agent run is sequential, but the discovery question can be asked
  again whenever the evidence demands it, which is the discovery-and-delivery loop in miniature.

## End state

A validated problem a spec can build from: a crisp problem statement and job to be done, an honest
four-risk read, the riskiest assumption named with a cheap test sequenced first, and a few outcome
measures of success. The risks were tackled before the code, grounded in research rather than
interviews the agent cannot run. `product-spec` takes it from here; `product-quality` and
`release-readiness` reuse the outcome measures as the bar the finished product is judged against.
