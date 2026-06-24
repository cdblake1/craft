---
name: clarify-intent
description: 'Socratic interrogation to surface the real goal before designing, researching, or building. Use for: grill me, challenge my assumptions, clarify my intent, is this XY problem, what am I really trying to achieve, step back, interrogate me, pressure-test this, am I solving the right problem.'
---

# Clarify Intent

When a developer is about to commit to a research direction, design choice, or build effort, the underlying goal has often been silently picked before specifics surfaced. This skill grills the developer Q&A-style to surface the real goal before commitment.

This is a meta-skill: it applies regardless of domain. Use it whenever a direction feels wrong, the framing was inherited rather than chosen, or the developer wants to be challenged before spending real time or money.

## When to use this skill

Trigger phrases (non-exhaustive):

- "grill me" / "interrogate me" / "pressure-test this"
- "clarify my intent" / "what am I really trying to achieve"
- "challenge my assumptions" / "am I solving the right problem"
- "is this XY problem" / "what's the real goal"
- "I don't actually want X" / "step back" / "back up"
- "is this the right framing"

Do NOT use this skill when:
- The developer has explicitly said they know what they want and asks for execution.
- The current direction has already been validated (e.g., approved plan with clear goals).
- The conversation has moved to implementation details unrelated to goal choice.

## Procedure

### Step 1: Read what's on the table

Before asking anything, gather the existing framing:
- Current branch (`git rev-parse --abbrev-ref HEAD`).
- Plan file (`~/.copilot/session-state/<session>/plan.md` or per-branch journal `current-plan.md`).
- Most recent journal step-log if relevant.
- The doc, design, or proposal the developer is reacting against, if named.

Read these to anchor questions to the actual context. Do NOT skip; questions asked without context become generic and waste turns.

### Step 2: Name the assumption

Before asking the first question, state one assumption baked into the current framing that you suspect is unexamined. Make it a single sentence. Example: "The T4 doc assumes the question is 'does orchestration help on SWE-bench' but you may actually want to know whether to invest in agent infrastructure at all."

This is the opening move. It tells the developer what you're going to probe and gives them a chance to confirm or redirect before grilling begins.

### Step 3: Ask one question

Strict one-question-at-a-time. Never bundle. Never put options inside a question without using the `ask_user` tool with a choices array. Pick the question style based on what's already on the table:

| Style | Use when | Example |
|---|---|---|
| **XY problem detection** | The proposal feels solution-shaped, not problem-shaped | "What problem made you want to compare orchestration patterns? Not 'why this comparison,' but 'why this problem at all today.'" |
| **5 Whys** | The stated goal sounds like an instrumental sub-goal | "Why do you want SWE-bench numbers? What changes once you have them?" |
| **Pre-mortem** | The proposal has plausible failure modes the developer hasn't named | "Assume you run this experiment, spend the money, and get a clear answer. Six months later you've ignored it. What happened?" |
| **Counterfactual** | The developer can't articulate what would change with the answer | "If you already knew the result was 'O1 wins by 5pp,' what would you do tomorrow? Be specific." |
| **Cost-of-information** | The proposal is expensive relative to the decision it informs, OR the goal-character is uncertain | "What's the cheapest experiment that would change your next action? Not the most rigorous; the cheapest." Use this ONLY when the goal might be wrong; if the goal is known-and-unbuilt, ask **Right-sized first move** instead. |
| **Right-sized first move** | The goal is known-and-unbuilt (developer can already name the artifact they want; cheapness is not the bottleneck) | "What's the smallest first move that makes irreversible forward progress on the actual goal, and fits in one checkpoint? Not the cheapest probe; the smallest committed step." |
| **Stop-list (negative)** | The developer can't say what success looks like | "Name three things that are NOT the goal here. Sometimes the answer is sharper than the goal itself." |

Pick adaptively. Do not march through all seven. If two consecutive answers from the developer point at the same hidden goal, ask about that goal directly.

**Choosing between Cost-of-information and Right-sized first move.** These are not interchangeable; pick by goal-character.

- **Goal is exploratory** (developer is testing whether the goal itself is right; the result of the experiment would change the next action): use **Cost-of-information**. Cheapness is the right axis because you don't know if the whole direction survives.
- **Goal is known-and-unbuilt** (developer can already name the artifact they want; the only question is execution; "I know what I want, I just haven't built it yet"): use **Right-sized first move**. Cheapness is irrelevant when the direction is settled; the bias toward "cheapest probe" frames the work as still-undecided when it isn't.

If in doubt, ask the goal-character question first: "Is the question 'should we build this' or 'how do we build this'?" Then pick the cell.

### Step 4: Listen for the goal shift

After each answer, decide: did the developer's response (a) confirm the original framing, (b) reframe the problem entirely, or (c) reveal a sub-goal that is the real driver?

If (a), one more question to verify, then stop.
If (b) or (c), pivot to the new framing for the next question. Don't keep grilling the original framing.

### Step 5: Stopping criteria

Stop when ALL THREE of the following are true:
1. The developer has articulated the **real goal** in one sentence.
2. The developer has articulated **what success looks like** in concrete, measurable terms.
3. The developer has named **the next concrete move** that would advance the goal. The shape of "next move" depends on goal-character: for an exploratory goal, the cheapest experiment that would change behavior; for a known-and-unbuilt goal, the right-sized first committed step.

Also stop if:
- The developer explicitly calls done ("ok we're good," "got it," "stop").
- You have asked 8 questions and the goal still isn't clear. Surface the impasse: "I've asked 8 questions and the real goal isn't surfacing. Either the framing is genuinely correct, or we need a different lens than this skill provides."

### Step 6: Produce the goal brief

Output a single short brief, rendered in chat. The brief's middle section branches on goal-character: use **Cheapest experiment** for exploratory goals, **Right-sized first move** for known-and-unbuilt goals. Pick one; do not include both.

For an exploratory goal:

```
## Real goal
<one sentence>

## What success looks like
<concrete, measurable; what changes when the goal is achieved>

## Cheapest experiment that would change next action
<the smallest move that produces decision-relevant signal>

## What the original framing assumed
<one to two sentences naming the assumption you opened with in Step 2, refined by the conversation>

## Recommended next move
<one sentence; based on the real goal, not the original framing>
```

For a known-and-unbuilt goal:

```
## Real goal
<one sentence>

## What success looks like
<concrete, measurable; what changes when the goal is achieved>

## Right-sized first move
<the smallest committed step that makes irreversible forward progress and fits in one checkpoint; not a probe>

## What the original framing assumed
<one to two sentences naming the assumption you opened with in Step 2, refined by the conversation>

## Recommended next move
<one sentence; based on the real goal, not the original framing>
```

Keep the brief under 200 words. Close with a question: "Does this brief match what you actually want? If not, what's off?"

## Anti-patterns

- **Do not summarize from memory.** If a plan file, design doc, or journal exists, read it in Step 1. Do not pretend to know what's on the table.
- **Do not ask leading questions.** "Don't you actually want X?" assumes the answer. Use neutral framings.
- **Do not chain more than 8 questions.** If the goal hasn't surfaced by then, name the impasse and stop. Continuing past 8 is performance, not investigation.
- **Do not grill if the developer pushes back.** If they say "I really do want what I said," accept it and stop. The skill is opt-in.
- **Do not use this skill for implementation questions.** "What variable name should I use" is not an intent question.
- **Do not default to "cheapest experiment" for known-and-unbuilt goals.** If the developer has named the artifact they want and the only open question is execution, the right framing is **Right-sized first move**, not **Cost-of-information**. Defaulting to "cheapest" frames settled work as still-undecided and reframes execution as exploration; it is the most common goal-character miscalibration this skill makes.

## Maintenance

This skill is self-contained. The procedure does not depend on external state and should not need wiki edits. If the question taxonomy in Step 3 grows beyond ~10 styles, refactor into a wiki-pointer skill instead.
