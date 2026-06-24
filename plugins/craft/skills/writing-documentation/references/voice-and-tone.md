# Voice and tone

The voice rules cross-cut all six doc shapes, with one explicit exception called out at the end. Apply these to tutorials, how-tos, explanations, findings docs, and the prose body of any other long-form doc.

## The eleven rules

1. __Lead with the verdict.__ The first sentence of every section answers the question the reader brought. Background goes after the payoff, not before.

2. __Second person, imperative voice.__ "Run the command", "Configure the database". Reserve "we" for documented team or org positions. Avoid "we will see that", "let us consider".

3. __Active voice. The actor is the subject.__ "Run the command to apply the configuration" beats "The configuration is applied by running the command". Use passive only when the actor is genuinely irrelevant ("The file was generated in 2021").

4. __Short sentences. Short paragraphs.__ Paragraphs cap at five rendered lines. Each paragraph covers one idea. Use sub-headings every two to four paragraphs in long sections.

5. __Sentence-case headings.__ Never `Title Capitalization`. Microsoft Style Guide is explicit: "Never Use Title Capitalization. Never Ever."

6. __Use contractions.__ "It's", "you'll", "we're". They land as confident, not casual. The user uses them in his own writing; they are house style.

7. __Cut the filler.__ "In order to" becomes "to". "Due to the fact that" becomes "because". "At this point in time" becomes "now". Orwell's rule III applies without modification: if it is possible to cut a word out, always cut it out.

8. __Replace inflated diction.__ The following table is the most common offenders. Run a search-and-replace at draft time.

   | Inflated | Plain |
   |---|---|
   | `utilize` | `use` |
   | `facilitate` | `enable`, `help` |
   | `leverage` | `use` |
   | `commence` | `start` |
   | `terminate` | `end` |
   | `endeavor` | `try` |
   | `aforementioned` | `the` |
   | `prior to` | `before` |
   | `subsequent to` | `after` |
   | `in the event that` | `if` |

9. __Use concrete numbers, file paths, observed behavior.__ Not "many users find that the performance is often improved by increasing the cache size", but "In our benchmarks, a 512 MB cache reduced latency by 40%".

10. __Hedge only when uncertain about the technical claim itself.__ "This option may cause issues on Windows" is a real conditional. "Perhaps consider" is noise. The reader cannot calibrate noisy hedges; remove them.

11. __When a claim is a hypothesis, label it.__ "I suspect X because Y, but I have not verified Z" beats stating X as fact. The honesty cost is one word; the trust dividend is large.

## The one exception: reference material

Reference docs do not get warm voice, friendly tone, or narrative scaffolding. They get facts. The reader is performing a lookup, not reading a chapter. Apply the eleven rules to tutorials, how-tos, explanations, and findings docs. Apply __austere__ voice to reference.

> "Reference material is like a map. One hardly reads reference material; one consults it. It should be austere." (Diatáxis, [diataxis.fr/reference/](https://diataxis.fr/reference/))

Austere means:

- No "useful tips".
- No examples that are not specifications of behavior.
- No friendly opening sentence to each section.
- No closing summary.
- No editorial voice.

The reference reader is in a hurry. Warmth is friction.

## House preferences

Common preferences encoded in the host's `copilot-instructions.md` (or analogous personal config) that extend the four frameworks above:

| Preference | Source | Framework alignment |
|---|---|---|
| No em-dashes anywhere | Personal instructions, em-dash rule | Extends Microsoft brevity. Also defeats the strongest AI-ism telltale. |
| No AI-isms ("delve", "in summary", "it is important to note", etc.) | Personal instructions, AI-ism list | Aligns directly with Microsoft's "edit out weak constructions". |
| Table-first for tradeoffs | Personal instructions, response-structure rule | Extends Write the Docs skimmability. |
| `What we proved / found / next` wrap-ups | Personal instructions, wrap-up shape | Extends Diatáxis explanation guidance for findings docs. |
| Brief honest verdicts before alternatives | Personal instructions, response-structure rule | Aligns directly with front-loading across all frameworks. |
| Markdown links for AzDO entities (PR, bug, build) | Personal instructions, linking rule | House style; no framework analog. |
| No filler openers ("great question", "happy to help", "of course") | Personal instructions, response-structure rule | Aligns with all frameworks' anti-noise principles. |

No genuine conflicts.

## The em-dash rule in detail

The user's rule is "avoid em-dashes everywhere, including in chat". This is stricter than any framework. Why it matters:

1. Em-dashes are the single strongest AI-generated prose telltale. The 2024 LLM literature documents this; models overuse em-dashes because they read as versatile, but a human writer with the same goal usually has a more precise punctuation choice.
2. Em-dashes invite parenthetical drift. A sentence with two em-dashes ("The config file, which can be found in the root directory, should be edited before deployment") has three independent clauses. Three clauses in one sentence is almost always wrong.
3. Em-dashes are visually noisy. They draw the eye more than commas or parentheses, often without reward.

Replacements:

| Where you wanted an em-dash | Better choice |
|---|---|
| Mild clause break | Comma |
| Elaboration | Colon |
| Aside | Parentheses |
| Strong emphatic interruption | Two sentences |

Em-dashes inside block quotes and code fences are exempted. Cited material legitimately uses them, and code is not prose.

## Concrete before-and-after

### Before

> Furthermore, it is important to note that utilizing the cache facility can, in many cases, lead to performance improvements, particularly when the workload is read-heavy.

Six telltales: `furthermore`, `it is important to note that`, `utilize`, `facility`, vague quantifier `in many cases`, parenthetical drift.

### After

> A read-heavy workload runs faster with the cache enabled. In our benchmarks, a 512 MB cache reduced latency by 40%.

Two sentences. Claim first. Evidence second. No filler.

### Before

> We will see that there are several approaches, some of which utilize different mechanisms, for facilitating the migration process.

### After

> Three approaches migrate the data. Each uses a different mechanism.

Two sentences. The reader can now ask "which three?" and the next paragraph answers.

## House style: what to keep

Some patterns from the framework guidance the user has explicitly kept:

- Sentence-case headings (Microsoft).
- Use of `you` as the subject (Google, Microsoft, all how-tos in Diatáxis).
- Code blocks with language fences (GitHub).
- TL;DR or verdict paragraph at the top (all frameworks via front-loading).
- Numbered procedures (Microsoft Learn editorial guide).

These are unsurprising; the rules above add the user-specific layer on top.
