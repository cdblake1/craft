# Frameworks

Annotated reading list. Five primary sources cover the modern technical-documentation literature. Three classic style guides cover the underlying prose rules. Read in this order.

## Modern documentation frameworks

### 1. Diatáxis ([diataxis.fr](https://diataxis.fr/))

The single most useful structural tool in technical documentation. Defines four shapes (tutorial, how-to, reference, explanation) and explains why mixing them breaks documents.

Read the [compass](https://diataxis.fr/compass/) page first (one screen, two minutes). Then the four shape pages in one sitting (90 minutes total). The [tutorials-how-to](https://diataxis.fr/tutorials-how-to/) page is the most concrete demonstration of why the framework matters: it explains the single most common conflation in software documentation.

Use Diatáxis when picking the shape of a new doc, or when an existing doc feels wrong and you cannot say why.

### 2. Microsoft Writing Style Guide ([learn.microsoft.com/style-guide](https://learn.microsoft.com/style-guide/welcome/))

The fastest high-value voice reference in existence. The [Top 10 Tips](https://learn.microsoft.com/style-guide/top-10-tips-style-voice/) page is a five-minute checklist you can run against any draft. The [Brand voice](https://learn.microsoft.com/style-guide/brand-voice-above-all-simple-human/) page covers the warm-and-relaxed-and-clear voice that Microsoft Learn aims for.

Use Microsoft Style Guide when reviewing voice and tone on a draft, or when working on docs that will land on docs.microsoft.com.

### 3. Write the Docs principles ([writethedocs.org/guide/writing/docs-principles](https://www.writethedocs.org/guide/writing/docs-principles/))

The five atomic-unit principles: ARID (Accept Repetition In Documentation), Skimmable, Exemplary, Consistent, Current. Particularly important for engineering orgs where "DRY everything" instincts will fight the ARID principle.

The companion book by Mark Baker, [Every Page is Page One](https://everypageispageone.com/the-book/), captures the principle that readers arrive at individual pages via search, not sequentially. Each page must establish its own context.

Use Write the Docs when shaping multi-page documentation sets, or when arguing for the docs-as-code workflow with engineers.

### 4. Google Developer Documentation Style Guide ([developers.google.com/style](https://developers.google.com/style))

A living, maintained, team-tested application of Orwell and Zinsser to software docs specifically, with concrete before-and-after examples. Read the [highlights](https://developers.google.com/style/highlights) page first (five minutes), then [Tone](https://developers.google.com/style/tone), [Voice](https://developers.google.com/style/voice), and [Word Choice](https://developers.google.com/style/word-choice).

The voice rule worth memorizing: "sound like a knowledgeable friend who understands what the developer wants to do."

Use Google Style Guide when writing developer-facing docs (API tutorials, getting-started guides, SDK docs).

### 5. GitHub Docs style guide ([docs.github.com/en/contributing/writing-for-github-docs/style-guide](https://docs.github.com/en/contributing/writing-for-github-docs/style-guide))

The most concrete editor-ready conventions for code blocks, alerts, headings, and emphasis. Especially valuable for the code-sample conventions: no `$` prompts, `ALL_CAPS` placeholders, language-tagged fences, 60-character line ceiling.

Use GitHub Docs when writing the code-sample-heavy sections of a how-to or tutorial.

## Classic style guides

### 6. George Orwell, "Politics and the English Language" (1946)

Twenty pages. Free at [orwellfoundation.com](https://www.orwellfoundation.com/the-orwell-foundation/orwell/essays-and-other-works/politics-and-the-english-language/).

The six rules apply without modification to technical writing:

1. Never use a metaphor, simile, or other figure of speech you are used to seeing in print.
2. Never use a long word where a short one will do.
3. If it is possible to cut a word out, always cut it out.
4. Never use the passive where you can use the active.
5. Never use a foreign phrase, a scientific word, or a jargon word if you can think of an everyday English equivalent.
6. Break any of these rules sooner than say anything outright barbarous.

Read first. Everything else builds on it.

### 7. William Zinsser, "On Writing Well" (1976, 7th ed. 2006)

Chapter 2 ("Simplicity") and Chapter 3 ("Clutter") are the most directly applicable to technical writing. Zinsser's central argument: "clutter is the disease of American writing; the cure is to strip every sentence to its cleanest components."

His concept of "clutter words" anticipates every AI filler phrase by 50 years. The chapter on rewriting is worth re-reading after every major doc you finish.

### 8. Strunk and White, "The Elements of Style" (1959, 4th ed. 1999)

The shortest of the primary sources (105 pages in the 4th edition) and the most quotable. Rule 13 ("Omit needless words") is the single most-quoted sentence in the book and the rule most commonly broken by AI-generated prose.

Read after Orwell to see the same principles applied at sentence and paragraph level.

## How to use this list

Three reading paths depending on what you need:

| If you need to | Read |
|---|---|
| Pick the right shape for a new doc | Diatáxis compass page (two minutes), then the four shape pages |
| Review voice and tone on a draft | Microsoft Top 10 Tips, then Google Tone and Voice |
| Build a documentation set (multi-page) | Write the Docs principles, plus Every Page is Page One |
| Get a one-time grounding in prose discipline | Orwell, then Zinsser chapters 2-3, then Strunk and White |
| Settle a specific argument about a code-sample convention | GitHub Docs style guide |

For a one-week study plan: Orwell on day 1, Diatáxis on day 2, Microsoft Top 10 Tips on day 3, then practice on real drafts for the rest of the week.

## Sources cited in other reference files

The framework citations in `doc-shapes.md`, `voice-and-tone.md`, `structure-patterns.md`, and `anti-patterns.md` come from this list. When a rule in one of those files needs a deeper explanation, follow the link back to the primary source listed here.
