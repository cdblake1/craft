# Structure patterns

How the doc is organized matters at least as much as what it says. Five conventions cover most of the work: intros, headers, tables vs prose vs lists, code blocks, and wrap-ups.

## Intros

One sentence orients the reader. State what this page is and what the reader will accomplish.

> "Intros should be concise, ideally one sentence long. Intros help people know if they're in the right place." (GitHub Docs style guide, [docs.github.com/en/contributing/style-guide-and-content-model/contents-of-a-github-docs-article](https://docs.github.com/en/contributing/style-guide-and-content-model/contents-of-a-github-docs-article))

Skip these openers:

- "In this document, I will..."
- The title restated as a paragraph
- "Background:" followed by 200 words of context

For findings docs, lead with the verdict. Not the methodology, not the audience note, not the date stamp. The finding.

### Good intros

For a findings doc:

> Running the new importer against production data works, but only after you discover six silent setup gaps. This doc captures the gaps, two code-quality fixes prototyped during the session, and a ranked list to bring to the team.

For a how-to:

> Build the CLI from source and install it locally for testing.

For an explanation:

> The plugin load mechanism works in three phases. This page explains why each phase exists and what failures look like in each.

For reference:

> All command-line options accepted by `suite_runner.py`.

Each one tells the reader, in fewer than 30 words, whether they are in the right place.

## Headers

Five rules:

1. __Start at H2 in skill markdown.__ The repo's tooling injects an H1; do not nest under your own.
2. __Use H3 sparingly. Avoid H4.__ If you are hitting H4 regularly, the document is trying to cover too much. Split it.
3. __Never skip levels.__ H2 to H4 is a structural break.
4. __Choose imperative or noun-phrase. Hold the choice.__ How-to: imperative ("Configure the database"). Reference: noun phrases ("Database configuration"). Explanation: gerund ("Configuring the database") or "About" ("About database configuration").
5. __Sentence case only.__ "Configure the database", not "Configure The Database".

Mixing voices is the most common error. An H2 "Configuration" alongside an H2 "Set up the database" signals that one section is reference and the other is how-to. Either the doc is doing two jobs, or the headings are inconsistent. Pick one and fix the other.

## Tables, prose, lists

The three forms serve different purposes. Pick deliberately.

| Use | When | Why |
|---|---|---|
| __Table__ | At least two things to compare across at least two dimensions. Tradeoff comparisons, option sets, parameter lists. | Prose forces the reader to build the mental table. A table makes the comparison visually scannable. |
| __List__ | Items are discrete and enumerable. No comparative dimensions. Order matters (numbered) or does not (bulleted). | Lists signal "scan these one at a time". Prose signals "follow the narrative". |
| __Prose__ | The rule has nuance or rationale that needs explanation. Causal or sequential relationships between ideas. | Tables collapse nuance; lists fragment it. |

### The two failure modes

__Over-tabulation:__ a two-column table for three things that have no real dimensions to compare. Symptom: rows like "X | The X system" and "Y | The Y system" where the second column adds no information. Fix: replace with a bulleted list, or just inline.

__Under-tabulation:__ five paragraphs comparing three deployment options across four criteria, written as prose. Symptom: the reader has to read the whole section twice to extract the comparison. Fix: extract attributes (rows) and options (columns), build the table, replace the prose with a one-sentence intro.

### Decision-shaped content

When you have decision-shaped content (the user is choosing among options), use the user's standard table columns:

| Column | What it holds |
|---|---|
| Option | The choice. Mark `(Recommended)` if there is one. |
| Viability | Can the user actually do this? "Yes", "Yes if X", "No, blocked by Y". |
| Pros | Why this option. |
| Cons | Why not this option. |
| Snippet (if useful) | A code or command preview. |

The shape forces concrete tradeoff reasoning. It also survives scrolling better than prose.

## Code blocks

Five conventions.

1. __Specify the language after the opening fence.__ ` ```powershell `, ` ```yaml `, ` ```python `. Syntax highlighting and search both depend on this.

2. __Lines stay under 80 characters where possible.__ Readers do not horizontal-scroll. 60 is better than 80 when the language allows.

3. __No `$` or `PS>` prompts before commands.__ The user copies the whole line; a prompt prefix breaks the copy.

4. __Placeholders in `ALL_CAPS`, not `<angle-brackets>`.__ The latter conflict with HTML rendering in some viewers.

5. __Code blocks are for copy-pasteable commands or canonical examples.__ Not for illustration of style. If the point is "this is the kind of thing you would write", a table or prose is usually clearer.

### When the code is itself the doc

Reference docs (API surfaces, configuration schemas) sometimes include code as the primary content. In those cases:

- The code block IS the body of the section.
- Surrounding prose is one sentence above (what this section documents) and one sentence below (where the related reference lives).
- No "explanation" of the code. The reader is reading reference.

## Wrap-ups

Three forms, one per shape.

### Findings, decision records, explanations

The user's signature shape:

```
## What we proved
- Claims with evidence.

## What we found
- Observations without claims.

## What's next
- Concrete actions, ranked.
```

The labels can vary (`Verdict / Open questions / Next steps`; `Worked / Broke / Parked`; `Decision / Rationale / Follow-ups`) but the three-block shape carries the meaning: certified outcomes, uncertified observations, and forward motion.

### How-to guides and tutorials

End with __next steps__. What does the reader do after this page?

- Link to a logical continuation.
- "You have just configured X. To validate, see Y. To extend, see Z."

Do not write a coda summarizing what just happened. Trust that the reader noticed.

### Reference

End with __see also__. Links to related reference, never a summary.

```
## See also
- [Configuration schema](configuration-schema.md)
- [Error codes](error-codes.md)
```

The reader is consulting; they came here for a fact and got it. They do not need a summary.

## Density and pacing

The right length is the length the content requires. Two heuristics:

- A finding doc with one finding is one page. With ten findings, ten pages, ranked.
- A how-to with five steps does not need an explanation of why the steps exist. Link to an explanation page for readers who want it.

The failure modes are symmetric:

- __Too short:__ a how-to that says "Run the deployer" without specifying arguments, location, or success criteria.
- __Too long:__ a how-to that explains how the deployer works internally before getting to the command. That is two docs.

## When the structure feels wrong

If you cannot decide where a paragraph belongs, the paragraph is probably the wrong shape. Apply the doc-shape classification from [doc-shapes.md](doc-shapes.md): what shape is this paragraph? If it does not match the doc's shape, move it or cut it.

If the doc has more than two H2 sections that feel unrelated, the doc is probably two docs. Split.

If every H2 section has the same shape (one paragraph, three bullets, one code block), the structure is templated rather than content-driven. Vary it. Let the content choose the form.
