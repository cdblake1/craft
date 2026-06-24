# Doc shapes

The single most useful structural tool in technical documentation is picking the right shape before you start writing. Six shapes cover almost everything. Mixing two of them in one document breaks both.

The framework is [Diatáxis](https://diataxis.fr/). It defines four shapes for product documentation. Two more shapes (findings and runbook) cover the work-product genres that Diatáxis does not name directly.

## The compass

| Shape | Reader's question | Reader needs this when | Length |
|---|---|---|---|
| __Tutorial__ | "I've never done this. Walk me through it safely." | Learning a new tool. Acquiring skill. | Long. End-to-end. Every step narrated. |
| __How-to guide__ | "I know what I need to do. How do I do it correctly here?" | Operating in a known domain. Applying skill to a goal. | Medium. Focused on the goal. |
| __Reference__ | "What exactly does this parameter, command, or flag do?" | Looking up a fact. Consulting, not reading. | As long as the machinery requires. Austere. |
| __Explanation__ | "Tell me about X. Why does it work this way?" | Building understanding. Acquiring cognition. | Variable. Bounded by the topic. |
| __Findings / decision record__ | "What did we learn, and why did we choose this?" | Capturing what was decided and why. ADRs, RFCs, postmortems. | Short to medium. Verdict-first. |
| __Runbook__ | "I'm on-call and something is broken. What do I do?" | Operating under time pressure with branching failure modes. | Short steps. No explanatory prose. |

## Picking the shape

Ask the reader's question. If you can write it down in one sentence, you know the shape. If you cannot, the document does not have a single audience and needs to split.

The Diatáxis compass collapses to four axes:

| | Action | Cognition |
|---|---|---|
| __Acquisition of skill__ | Tutorial | Explanation |
| __Application of skill__ | How-to | Reference |

Findings and runbooks both serve action with prior cognition, the same quadrant as how-to. They differ in tone and structure: findings document why a choice was made; runbooks tell the operator what to do under stress.

## The critical failure mode

Diatáxis names this directly: tutorials and how-to guides are the single most common conflation in software documentation. The result is a tutorial that does not teach (it assumes existing skill) and a how-to that does not guide (it lectures instead of directing).

> "A tutorial is a lesson. A how-to guide is a clinical manual. The distinction between a lesson in medical school and a clinical manual is the distinction between a tutorial and a how-to guide." (Diatáxis, [diataxis.fr/tutorials-how-to/](https://diataxis.fr/tutorials-how-to/))

Three other common conflations:

| Conflation | Symptom | Fix |
|---|---|---|
| Reference with embedded explanation | Reader looking up a flag value has to skim three paragraphs of why it exists before finding the value. | Move the explanation to an explanation page. Link from reference to explanation, not the other way around. |
| How-to with embedded tutorial | The how-to spends 200 words explaining what each tool does before getting to the actual steps. | Move the explanation out. The reader of a how-to already knows what the tools do. |
| Findings with embedded how-to | The findings doc bundles a complete reproduction procedure in the middle, breaking the narrative. | Either split into findings.md and procedure.md, or move the procedure to an appendix-style position late in the doc. |

## Shape-specific guidance

### Tutorial

The first rule of teaching is do not teach. Give the reader things to do, through which they learn. The tutorial must be __usefully complete__: the reader must encounter every action, concept, and tool they need. It must also be __concise in prose__: no word should be there that does not move the reader forward.

A tutorial succeeds when the reader, after finishing, can do the thing without re-reading the tutorial.

Conventions:

- Open with what the reader will accomplish. "In this tutorial we will create...", not "In this tutorial you will learn...". The latter is presumptuous.
- Narrate what each step will produce before the reader runs it: "You will see...", "After a few moments...". This converts a series of commands into a learning experience.
- Show the simplest possible code first. Add complexity later.

### How-to guide

The how-to assumes the reader is competent. The reader knows what they want to do; the doc tells them how to do it correctly in this specific situation.

Conventions:

- Open with the goal. "Configure the database for production." Not "About database configuration."
- Skip the background. Link to an explanation page for readers who want it.
- Each step is one action. Number them.
- Handle the failure modes the reader is most likely to hit. Skip the obscure ones.

### Reference

Reference is austere. The reader is consulting, not reading. Every word that is not a fact is clutter.

> "Reference material is like a map. One hardly reads reference material; one consults it." (Diatáxis, [diataxis.fr/reference/](https://diataxis.fr/reference/))

Conventions:

- Use tables for parameter lists, return values, error codes, version compatibility.
- Use bullet lists for enumerations.
- Use prose only for the one-sentence definition of each entity.
- No explanation. No tutorials. No "useful tips". Link out if needed.

### Explanation

Explanation is the only shape where prose is the dominant form. The reader is building a mental model; they need narrative.

Conventions:

- Open with what the reader will understand after reading. "After this page you will know why X works the way it does."
- Use diagrams generously. A picture of a system topology is worth a thousand words of how each component connects.
- Use comparisons. "X is similar to Y, except that...". The reader's existing mental model is the cheapest scaffolding.
- Admit opinion and perspective. Explanation is the place to say "this design has a flaw" or "an alternative would be better in some cases".

### Findings / decision record

Findings docs capture what was learned during a piece of work. ADRs (architecture decision records), RFCs, postmortems, research reports, and the user's local-mode findings doc all share this shape.

Conventions:

- Open with the verdict. The reader wants to know what was decided or what was found before they read the methodology.
- Place the highest-value content first. For a team-conversation doc, the recommendations are higher-value than the procedure. Put recommendations first.
- Wrap up with `What we proved / What we found / What's next`. The shape is more important than the labels.
- Date the document. Findings rot. A finding from last quarter may have been superseded; the date helps the reader decide.

### Runbook

Runbooks are how-tos under operational stress. The reader is on-call, something is broken, and they need to act now.

Conventions:

- No prose. Only steps and branches.
- Use a flowchart or numbered branches: "If X then Y; if not X then Z."
- Pre-stage commands the reader can copy-paste exactly. No placeholders the reader has to fill in mentally.
- Include verification: "After step 4, run `curl localhost:8080/health`. You should see HTTP 200. If you see 503, go to step 6."

## When the shape is ambiguous

If you cannot decide which shape a document is, the document is probably trying to do two jobs. Two responses:

- __Split it.__ Two short docs are easier to maintain than one long mixed doc. Cross-link them.
- __Pick the primary purpose and demote the rest.__ If 80% of the content is findings and 20% is how-to, write a findings doc and put the how-to in an appendix-style section near the end. This is the same advice as splitting, just with the split happening at the heading level instead of at the file level.
