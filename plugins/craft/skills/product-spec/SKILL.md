---
name: product-spec
description: 'Produce the feature-complete, competitive product/behavior half of an application spec: identify the app type and its best-in-class incumbents, research the full category feature surface, build a completeness/competitive matrix, derive the wedge, and emit a sourced spec. Use for: scope an app, spec out an application, what features does this app need, is this feature-complete, competitive feature analysis, feature matrix, category feature surface, best-in-class features, product spec, behavior spec, table-stakes features, what would make this competitive. NOT for: the experience/visual design (see uiux-design), the spec section structure only (see writing-spec), prose voice (see writing-documentation), breaking work into tasks (see decompose).'
---

# Product spec (feature-complete and competitive)

Produce the **behavior half** of an application spec: the feature surface, logic, data, and
architecture sketch, at a quality bar of **feature-complete and competitive with the best-in-class
for the app type**. This skill owns *what the app does*; its peer `uiux-design` owns *how it is used
and looks*. Together they make a spec a build can come out of usable on the first pass.

The load-bearing idea: you cannot claim feature-completeness or competitiveness from imagination. You
get there by **grounding in the real category**, the actual incumbents and the actual feature surface
they share, each claim sourced. A feature list invented at the keyboard is exactly what ships a
barely-usable first pass.

**Skip-gate:** this is for application-scale work. A single feature or a chore does not need a
category survey, use `writing-spec` directly and move on.

## Stage 1 - Identify the app type and its incumbents

Pin down what category this is before listing any feature.

- **Name the app type in one phrase** ("keyboard-first desktop code-review client for Azure DevOps"),
  specific enough that its competitors are identifiable.
- **Find the best-in-class incumbents** for that type, the products a reviewer would actually compare
  against. Use the `research` skill: name 3 to 6 real products, each verified to exist, not recalled.
- **Note each incumbent's positioning** in a sentence: who it is for and what it is known for. This is
  what you will have to match or beat.

If the app type is genuinely novel with no incumbents, say so explicitly and define the adjacent
categories you will borrow table stakes from. A claimed greenfield with no comparison is usually an
under-specified app type, look harder before accepting it.

## Stage 2 - Research the full category feature surface

This is where feature-completeness is earned. Use the `research` skill: grounded, triangulated,
every load-bearing claim carrying a verbatim quote and a URL.

- **Enumerate the table-stakes features** of the category, the set a credible entrant must have.
  Source each from a real incumbent or a category review, not from assumption.
- **Capture each incumbent's differentiators**, the features one has that others do not. These define
  where competition actually happens.
- **Do not invent features.** A feature that no incumbent has and no user asked for is scope you
  cannot justify; if you believe it is a real gap, label it a hypothesis, not a table stake.

## Stage 3 - Build the completeness/competitive matrix

Turn the research into one table a reviewer can scan: the category's features down the side, the
incumbents and the proposed product across the top.

| Feature (sourced) | Incumbent A | Incumbent B | Incumbent C | Proposed |
|---|---|---|---|---|

- **Table stakes** are the rows most incumbents share. The proposed column must cover them, or carry
  an explicit, reasoned non-goal for each gap. An unexplained empty cell in a table-stakes row is the
  feature-completeness hole this skill exists to close.
- **Differentiators** are the rows where incumbents diverge. The proposed product wins by its
  position on these, not by having more rows.
- Keep the matrix sourced: each feature row traces to where it came from.

## Stage 4 - Derive the wedge

From the matrix, name the **one defensible differentiator** the product leads with, the thing a
best-in-class incumbent cannot or will not copy quickly. Feature-completeness is the price of entry;
the wedge is the reason to switch. State it in one sentence, and name what makes it defensible.

## Stage 5 - Sketch the architecture and emit the spec

Sketch the system shape only to the depth the spec needs (major components and boundaries, the
riskiest technical assumption to spike first), not a full design.

Emit the behavior half of the spec using the `writing-spec` structure (problem, goals/non-goals,
proposal, alternatives-with-why, risks, validation, open questions) and run `writing-documentation`
on the prose. Every feature and every parity claim carries its source. Hand the feature surface to
the `uiux-design` skill so the experience is designed for the real features, and accept its
reconciliation when a flow reveals a missing feature.

## End state

A behavior spec a reviewer can trust on two axes at once: **feature-complete**, because the
table-stakes surface is covered and each gap is a reasoned non-goal, and **competitive**, because the
incumbents are named and the wedge is explicit and defensible. Every feature traces to a source, so
the completeness claim is checkable rather than asserted. The matrix and the wedge are the two
artifacts a decomposition and a UI/UX design can both build on.
