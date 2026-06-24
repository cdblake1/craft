# Self-review checklist

Run this before publishing any technical doc. The script `scripts/Invoke-DocSelfReview.ps1` automates checks 1, 2, 4, 5, 8, and 11. The rest require reading.

## The 13 checks

| # | Check | What to look for | Action |
|---|---|---|---|
| 1 | AI-ism telltales | `delve`, `in summary`, `to summarize`, `in essence`, `essentially`, `it is worth noting`, `it is important to note`, `ensure that you`, `furthermore`, `moreover`, `additionally`, `nevertheless`, `crucially` | Delete or rewrite every match. |
| 2 | Em-dash density | Any em-dash outside a block quote or code fence | Replace with comma, colon, parentheses, or two sentences. The user's rule is zero em-dashes anywhere. |
| 3 | Paragraph length | Any paragraph longer than five rendered lines | Split. |
| 4 | First-person plural overuse | `we will`, `let us`, `as we discussed` | Replace with `you` or imperative. Keep `we` only for documented team positions. |
| 5 | Inflated diction | `utilize`, `facilitate`, `leverage`, `commence`, `terminate`, `endeavor` | Replace with `use`, `enable`, `use`, `start`, `end`, `try`. |
| 6 | Passive voice | `is/are/was/were + past participle` constructions | For each, identify the actor; rewrite active unless the actor is genuinely irrelevant. |
| 7 | Heading voice consistency | All H2 and H3 within a doc-type section are either all imperative or all noun-phrase | Pick one; fix the others. |
| 8 | Imprecise quantifiers | `many`, `often`, `usually`, `frequently`, `sometimes`, `several`, `various` | Replace with a number or delete. |
| 9 | First-sentence payoff | The first sentence of each major section states the section's main point | If not, move the payoff up or delete the preamble. |
| 10 | Code-sample complexity | The first code sample in any how-to or tutorial is the simplest version that works | If production-grade, add a simpler version first. |
| 11 | Tone disclaimers | `may be controversial`, `some may disagree`, `please note`, `note that` (when used as filler) | Delete or replace with a factual claim. |
| 12 | Structure symmetry | All H2 sections have the same shape (sub-headings, bullet count, code blocks) | If so, the structure is a template artifact, not driven by content. Vary it. |
| 13 | Diatáxis classification | What shape is this section? Does it match the doc's declared shape? | If not, move it or cut it. |

## The AI-ism replacement table

The 13 most common AI-generated prose patterns and what a human writer reaches for instead.

| Telltale | Replace with |
|---|---|
| `delve into` | `look at`, `examine`, `go through` |
| `in summary`, `to summarize` (at end of section) | Nothing. The reader just read the section. |
| `it's important to note that` | The sentence itself, without the meta-prefix. |
| `ensure that you` | Imperative: "Configure the settings before X." |
| `furthermore`, `moreover`, `additionally` (overused) | `also`, `and`, or a new sentence. |
| Em-dash explosion (`X — Y — Z`) | Comma, colon, parentheses. |
| 400-word comprehensive-overview preamble | The direct answer, followed by background under its own heading. |
| `In essence`, `essentially` (restating what was already said) | If the first explanation was clear, stop. If not, rewrite it. |
| `Awesome!`, `Of course!`, `Obviously` | Strike. |
| `This may be controversial, but...` | The claim with appropriate evidence. |
| `I cannot provide specific advice on X, but...` | One sentence saying it is out of scope, then a link. |
| Over-explanation of obvious prerequisites | List only non-obvious prerequisites. |
| Structural mirror symmetry (every H2 has 3 bullets + 1 code block) | Let content drive structure. |

## How to run the script

From the worktree where your doc lives:

```powershell
& "$PSScriptRoot\..\scripts\Invoke-DocSelfReview.ps1" -Path C:\path\to\your-doc.md
```

The script returns:

- A pass count and a fail count per check.
- The first 10 offending lines for each failed check.
- Exit code 0 if all checks pass; non-zero if any fail.

The script does not change your file. It reports.

## What the script catches and what it does not

Catches:

- AI-ism telltales (check 1)
- Em-dash density (check 2; exempts block quotes and code fences)
- First-person plural patterns (check 4)
- Inflated diction (check 5)
- Imprecise quantifiers (check 8)
- Tone disclaimer patterns (check 11)

Does not catch:

- Paragraph length (check 3): the script approximates this, but rendered-line count depends on viewport width.
- Passive voice (check 6): hard to detect mechanically without false positives.
- Heading voice consistency (check 7): possible but the script does not currently do it.
- First-sentence payoff (check 9): semantic; requires reading.
- Code-sample complexity (check 10): semantic.
- Structure symmetry (check 12): the script does not measure it.
- Diatáxis classification (check 13): semantic.

Run the script first to clear the easy flags, then read the doc against the remaining checks.

## What to do with cited material

Cited quotes legitimately contain em-dashes, hedge words, and AI-ism-shaped phrases. The script exempts em-dashes inside ` > ` block quotes and inside code fences. For the AI-ism check, the script flags all matches; if a flagged line is inside a block quote you intended to keep verbatim, accept the flag and explain in the commit message or a sibling comment.

The rule is: do not change cited material to satisfy your own voice rules. Doing so falsifies the quote.

## When the checklist disagrees with your taste

The checklist encodes the user's documented preferences and the cross-framework consensus. When you find yourself wanting to break a rule deliberately, that is fine. Two cases:

1. __The rule is wrong for this context.__ Reference docs do not get warm voice (see [voice-and-tone.md](voice-and-tone.md)). A friendly intro on an API reference is a rule violation but a context fit. Keep the violation; note it in a code review comment so reviewers do not flag it.

2. __You disagree with the rule in general.__ Edit the rule. Either update `voice-and-tone.md` or open a discussion. The skill is meant to evolve with the writer.

When neither case applies, the rule wins. The point of a checklist is to overrule taste when taste is wrong.
