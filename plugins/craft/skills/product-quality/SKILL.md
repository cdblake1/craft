---
name: product-quality
description: 'Assess an assembled application against a measurable, sourced quality bar and emit one prioritized gap list that feeds back into the build. Define quality signals before judging (goals-signals-metrics), score the built product against the spec feature matrix, the UX design bar, and the spec validation plan, find the gaps by importance versus satisfaction, then rank them by impact over effort. The quality-iteration half of the PM discipline; runs after slices land and feeds app-decompose. Use for: is the product actually good, what should we fix next, quality assessment, product review, prioritize the backlog, rank the gaps, find what is missing, assess the build, quality bar, what is most important to improve, holistic quality pass. NOT for: a single code change (see the code-review subagent), the feature surface (see product-spec), validating the idea up front (see product-discovery), the shipping decision (see release-readiness), slicing the work (see app-decompose).'
---

# Product quality (is it actually good, and what is next)

Take the assembled product, judge it against a measurable bar, and hand back one ranked list of what to
fix. This is the headline of the PM discipline and the gate the corpus was missing: `spec-review`
judges the plan, the code-review check judges a slice, and `conflict-resolve` judges a merge, but
nothing judged the **assembled product** and turned the result into prioritized work. That gap is why
an app-scale build feels piecemeal, a pile of merged features that nobody stepped back to assess as a
whole. This skill is the step back.

**Skip-gate:** this is for an assembled application, or a coherent wave of it. A single change is the
code-review subagent's job, not a product-quality pass.

**Precondition gate:** do not run this skill without something to assess against. It consumes the
`product-spec` feature matrix, the `uiux-design` bar, and the spec's validation plan. With no spec to
score against, you are judging by taste; produce the spec first, or fall back to the spec matrix alone
and say so.

## Stage 1 - Define the quality bar before judging

Decide what "good" means for this app type before scoring anything, so the assessment is measurable
rather than an opinion.

- Run **goals-signals-metrics**: for each quality goal of the app type, name the **signal** that would
  show it is met, and the **metric** that measures the signal. Define these up front; a bar invented
  after looking at the product just rationalizes what is there.
- Pull the three sources of the bar: the **feature matrix** from `product-spec` (what should exist),
  the **experience bar** from `uiux-design` (how it should feel), and the **validation plan** from the
  spec (the tests the product owes). Together these are the bar.
- Name the one **leading outcome** the product turns on (its north-star for the app type). You usually
  cannot measure it pre-users, so define it; it orders what matters when you rank gaps later.

## Stage 2 - Assess the assembled product against the bar

Score the built product as a whole, on evidence, not impression.

- For each feature in the matrix and each UX surface, score **present versus expected**: is it there,
  does it meet the bar, or is it a stub or a placeholder. Inspect the actual built artifact, not the
  plan that promised it.
- **Run or inspect the validation plan.** The plan the spec wrote is the product's debt; executing it
  is the heart of this stage. A product whose validation plan never ran is unproven by definition, the
  exact hole that ships a barely-validated app.
- Check each delivered slice against its **definition of done and acceptance criteria**. A slice that
  merged but does not meet its DoD is a gap, not a completed feature.
- Record evidence per finding. A score with no evidence is taste; a score with evidence is a bug
  report.

## Stage 3 - Find the gaps by importance versus satisfaction

Turn the assessment into a gap list framed the way the category frames opportunity.

- For each shortfall, capture **importance** (how much the bar and the leading outcome depend on it)
  and **satisfaction** (how well the built product meets it). The gap is the deficit, high importance
  and low satisfaction first.
- **Classify each gap by kind**: a must-be (its absence breaks the product), a performance gap (more
  is linearly better), or a delight gap (a differentiator). The kind changes how much the gap is worth,
  a missing must-be outranks a polish item.
- Separate a **true gap** (the bar is not met) from a **scope decision** (the bar was deliberately not
  aimed at). Record deliberate deferrals as reasoned non-goals, not as gaps.

## Stage 4 - Rank the gaps (the headline output)

Produce one ordered list, because an unranked gap list is just a complaint.

- Rank by **impact over effort**, the category's core prioritization move. Estimate each gap's reach
  and impact against its effort.
- **Discount confidence**: a gap argued from strong evidence outranks a gut-feel one of equal size.
  Carry the confidence on each row.
- **Sequence by cost of delay, not only expected value**: a gap that blocks the wedge or a release-
  readiness gate jumps the queue even if another gap is individually larger.
- The output is a **single ranked list**, each item concrete enough to pick up cold, each tagged with
  its kind and its evidence.

## Stage 5 - Feed the ranked gaps back into the build

Close the loop holistically, which is the whole reason this skill exists.

- Hand the ranked list to `app-decompose` as the **next wave** of parts. The decomposition stays
  holistic because the gaps came from assessing the whole product against one bar, not from reacting to
  one feature at a time.
- Keep the loop honest: after the wave ships, run this skill again. Quality iteration is a loop, take
  the assembled product, score it, re-prioritize, not a one-time review.

## End state

One ranked gap list, derived from scoring the assembled product against a bar defined before judging:
the spec feature matrix, the UX bar, and the spec validation plan actually run. Each gap is classified,
evidenced, and ranked by impact over effort with cost of delay respected. It feeds `app-decompose` as
the next wave, so the build improves against a whole-product bar instead of accreting feature by
feature. Run it again after the wave ships; that loop is what keeps quality holistic.
