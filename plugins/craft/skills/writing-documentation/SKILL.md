---
name: writing-documentation
description: 'Writing long-form human-readable technical documentation (findings, design docs, READMEs, runbooks, decision records, wiki page bodies). Use for: write findings doc, draft RFC, write a postmortem, write a wiki page, before publishing this doc, before sharing this doc with the team, scrub AI tone, self-review checklist for prose, AI-ism check, em-dash sweep, doc voice review. NOT for: SKILL.md authoring, UI strings, code comments, or wiki path / formatting conventions (each is a separate concern from long-form prose voice).'
---

# Writing Documentation

A working guide for writing long-form human-readable technical documentation. Synthesized from four parallel research threads on 2026-05-27: the patterns that work in the user's existing skills, four industry frameworks (Diatáxis, Microsoft Writing Style Guide, Write the Docs, Google Developer Documentation Style Guide), and the academic literature on anti-patterns and AI-generated prose telltales.

The audience is anyone writing technical documentation for an engineering team -- a developer drafting a finding, an agent producing a wiki page, a tech lead writing a postmortem.

## When to use this skill

Trigger phrases (non-exhaustive):

- "write a findings doc" / "draft an RFC" / "write a postmortem"
- "write a wiki page" / "draft a design doc" / "write a README"
- "before I publish this" / "before I share this with the team"
- "scrub AI tone" / "AI-ism check" / "em-dash sweep"
- "self-review checklist" / "doc voice review"

Do NOT use this skill when:

- The work is authoring a SKILL.md file: frontmatter and skill mechanics are a separate concern; handle those with your skill-authoring guidance, then return here for the prose voice inside the body.
- The work is UI strings (button labels, dialog copy): those follow UI-text conventions, not long-form prose rules.
- The work is code comments or XML doc comments: those follow code-comment conventions, not long-form prose rules.
- The work is wiki-specific formatting (double-underscore bold, page paths, page IDs): handle the formatting mechanics separately. Wiki page bodies still benefit from this skill for prose voice.

## The six rules

Six rules drive 90% of the quality difference between a doc that gets read and a doc that gets skipped.

1. __Lead with the verdict, then the alternatives.__ The first sentence of every section answers the question the reader brought. Background goes after the payoff, not before.

2. __Pick one of four shapes and hold it.__ Tutorial, how-to, reference, explanation. Mixing two in one doc breaks both. See [references/doc-shapes.md](references/doc-shapes.md) for the compass.

3. __Tables for tradeoffs. Lists for sequences. Prose for nuance.__ Choose deliberately; do not default to prose for comparisons. See [references/structure-patterns.md](references/structure-patterns.md).

4. __No filler, no AI-isms, no em-dashes.__ Run the self-review checklist before publishing. See [references/self-review-checklist.md](references/self-review-checklist.md).

5. __Every page is page one.__ The reader arrived here by search, not by reading the previous page. Establish enough context that the page stands alone.

6. __Wrap up with `What we proved / What we found / What's next`.__ Use the shape if not always the exact labels. For findings and decision records; not for reference (which ends with see-also) or how-to (which ends with the payoff).

## Procedure

When writing or reviewing a doc, work in this order:

### Step 1: Identify the shape

Ask the question the reader is asking. Match it to one of the six shapes in [references/doc-shapes.md](references/doc-shapes.md). If the answer is "more than one shape", the doc is doing more than one job and should split.

### Step 2: Draft the verdict and the structure first

Write the opening verdict before the body. If the verdict is hard to write, the doc has no clear thesis yet; pause and clarify. Once the verdict is in place, sketch the section headers. The headers tell you whether you have one shape or several.

### Step 3: Write the body

Apply the voice and tone rules from [references/voice-and-tone.md](references/voice-and-tone.md). Use tables for tradeoffs and prose for nuance per [references/structure-patterns.md](references/structure-patterns.md). When in doubt, see the worked before-and-after examples in [references/worked-examples.md](references/worked-examples.md).

### Step 4: Self-review

Run the mechanical script before reading the draft yourself:

```powershell
& "$PSScriptRoot\scripts\Invoke-DocSelfReview.ps1" -Path C:\path\to\your-doc.md
```

The script flags AI-ism telltales, em-dashes, inflated diction, imprecise quantifiers, and tone disclaimers. Fix every flag before continuing. Then read the doc yourself against the 13-item checklist in [references/self-review-checklist.md](references/self-review-checklist.md), which catches what the script cannot (heading-voice consistency, first-sentence payoff, code-sample complexity, structural symmetry, table-prose congruence).

### Step 5: Final pass against the anti-pattern catalog

Skim [references/anti-patterns.md](references/anti-patterns.md). It names 30+ failure modes across three categories: structural, voice/tone, AI-isms. The script catches a subset of these. Reading the catalog after writing the doc tends to surface the larger structural mistakes the mechanical script cannot detect.

## The compact checklist

Run this before publishing any doc. The full version with patterns and replacements is at [references/self-review-checklist.md](references/self-review-checklist.md).

1. AI-ism grep is clean (no `delve`, `in summary`, `it is important to note`, `ensure that you`, `furthermore`, `moreover`, `in essence`).
2. Em-dash density is zero (or every em-dash is inside a block quote or code fence).
3. No paragraph exceeds five rendered lines.
4. No `utilize`, `facilitate`, `leverage`, `commence`, `terminate`, `endeavor`.
5. First sentence of each major section states the section's main point.
6. Heading voice is consistent within a section (all imperative or all noun-phrase).
7. Tables are used for multi-dimensional tradeoffs; prose for nuance; lists for sequences.
8. Wrap-up follows `What we proved / What we found / What's next` shape for findings docs.

## References

| File | When to read it |
|---|---|
| [references/doc-shapes.md](references/doc-shapes.md) | Picking the right shape; recognizing shape conflations |
| [references/voice-and-tone.md](references/voice-and-tone.md) | The 11 voice rules; the user preference map; the austere-reference exception |
| [references/structure-patterns.md](references/structure-patterns.md) | Intros, headers, table-vs-prose decisions, code blocks, wrap-ups |
| [references/self-review-checklist.md](references/self-review-checklist.md) | The 13 mechanical checks; the AI-ism replacement table |
| [references/anti-patterns.md](references/anti-patterns.md) | The 30+ catalog; deeper than what the checklist surfaces |
| [references/worked-examples.md](references/worked-examples.md) | Before/after rewrites illustrating the rules |
| [references/frameworks.md](references/frameworks.md) | The annotated reading list (Diatáxis, MS, Orwell, Zinsser, etc.) |

## Maintenance

When you discover a new anti-pattern in your own writing, add it to `references/anti-patterns.md` with a worked example. When a rule no longer matches your taste, edit `references/voice-and-tone.md`. The skill is meant to evolve with the writer.
