# Worked examples

Six before-and-after rewrites: synthetic teaching cases and lightly anonymized real docs. Each shows a specific rule from `voice-and-tone.md` or `structure-patterns.md` in action.

## Example 1: opening a findings doc

The opening sentence carries the most weight per word. A findings doc that buries the verdict makes the reader work for it.

### Before

A findings doc that opens by listing what it captures instead of what it found:

> __Status:__ research notes from a working session that successfully ran the end-to-end import flow against a local test environment four times. Captures the procedure that worked, the silent failures along the way, code-quality findings from two prototype fixes, and a list of recommendations to bring to a conversation with the owning team.

Four lines. The reader is told the doc captures things but does not learn what was found.

### After

The rewrite:

> Running the import flow on a dev box works, but only after you discover six silent setup gaps. The procedure once you know them is straightforward; the gap is documentation, not code. This doc captures the gaps, two code-quality fixes prototyped during the session, the benchmarking observations behind those fixes, and a ranked list of items to bring to a conversation with the owning team.

Three sentences. The verdict ("works, but only after you discover six silent setup gaps") is in sentence one. The reader knows the answer in seven seconds and can decide whether to keep reading.

__Rule applied:__ Lead with the verdict (voice-and-tone rule 1).

## Example 2: prose comparison that wanted to be a table

When prose carries comparison across multiple dimensions, the reader has to build the mental table. Build it for them.

### Before

A synthetic version of the same content rendered as prose:

> The screenshot-fold optimization could either fold a screenshot into every UI-mutating action, which is the simpler implementation but produced over-verification in V2; or fold only for actions that are not `type` (V3, which actually made step 4 dramatically worse); or skip the fold entirely and look for the savings elsewhere (V1 baseline, the original behavior). Each has a different cost profile. The first reduces explicit screenshot actions the most but produces unpredictable agent behavior; the second is a partial reduction that did not help in measurements; the third gives up on the optimization and looks for the savings in a different mechanism.

Five sentences. The reader is building a mental table.

### After

The same information as a table:

| Config | What it does | Screenshots cut | Wall time vs baseline | Verdict |
|---|---|---|---|---|
| V1 (baseline) | Original behavior | 0% | reference | Reference point |
| V2 (fold all actions) | Auto-screenshot after every UI mutation including `type` | 60% | +12% | Over-verifies; reject |
| V3 (fold except `type`) | Auto-screenshot after click, key, scroll only | 40% | +135% | Worst case; reject |

The reader's eye reads down `Wall time` and gets the answer in three glances.

__Rule applied:__ Tables for multi-dimensional tradeoffs (structure-patterns "Tables, prose, lists").

## Example 3: failure-modes section without an index

A list of failure modes is easier to use when there is a one-row-per-item table at the top.

### Before

The original failure-modes section was six narrative entries in sequence:

```
### 1. `uv sync` fails with HTTP 403 from the private package feed
[symptom, why, workaround]

### 2. First run dies with FileNotFoundError on servers.json
[symptom, why, workaround]

### 3. Run finishes in 7 seconds with "Test Server not running"
[symptom, why, workaround]

...
```

The reader has to scan the headings to find the one matching their symptom.

### After

The rewrite added a one-row index table at the top:

> | # | The symptom that fails | The fix that worked |
> |---|---|---|
> | 1 | `uv sync` returns HTTP 403 from the private package feed | Install from public PyPI; skip the private-only dependency |
> | 2 | First run dies with `FileNotFoundError: servers.json` | `Copy-Item servers.dev.json $env:USERPROFILE\servers.json` |
> | 3 | Run finishes in 7 seconds with "Test Server not running" | Pass `--start_local_server true` |
> | ... | | |

Followed by the same six narrative entries. The table is the index; the entries are the chapter. The reader can jump to the entry they need without reading the four above it.

__Rule applied:__ Tables for multi-dimensional content (structure-patterns), plus an index pattern that makes long sections scannable.

## Example 4: inflated diction and connector overload

Three signals in one sentence: `furthermore`, `it is important to note that`, `utilize`, `facility`.

### Before

> Furthermore, it is important to note that utilizing the cache facility can, in many cases, lead to performance improvements, particularly when the workload is read-heavy.

Six telltales: `furthermore`, `it is important to note that`, `utilize`, `facility`, vague quantifier `in many cases`, parenthetical drift.

### After

> A read-heavy workload runs faster with the cache enabled. In our benchmarks, a 512 MB cache reduced latency by 40%.

Two sentences. Claim first. Evidence second. No filler.

__Rules applied:__ Cut filler (voice rule 7), replace inflated diction (rule 8), concrete numbers (rule 9), no AI-isms (the AI-ism replacement table).

## Example 5: heading voice inconsistency

Mixing imperative and noun-phrase headings within a section signals two different document types.

### Before

> ## Configuration
> ### Set up the database
> ### Authentication options
> ### Running the server

H2 is noun-phrase. The three H3s mix imperative, noun-phrase, and gerund.

### After (how-to flavor)

> ## Configure the service
> ### Set up the database
> ### Set up authentication
> ### Start the server

All imperative. The reader knows this is a how-to from the heading style alone.

### After (reference flavor)

> ## Configuration
> ### Database
> ### Authentication
> ### Server

All noun-phrase. The reader knows this is reference and treats each section as a lookup.

__Rule applied:__ Heading voice consistency (structure-patterns "Headers").

## Example 6: clever-first code sample

Tutorials and how-tos benefit from showing the simplest version first.

### Before

```python
async def run(self, settings: Mapping[str, Any], context: Optional[AzureContext] = None) -> Result[T, E]:
    """Execute the task with full error handling, retry logic, and telemetry."""
    async with self._tracer.span("task.run") as span:
        try:
            resolved = await self._resolve(settings, context)
            return await self._execute_with_retry(resolved, max_attempts=3)
        except (TaskException, AzureException) as ex:
            span.record_exception(ex)
            return Err(self._wrap_error(ex))
```

For a reader learning what the task framework does, this is a wall of syntax to parse before any understanding can land.

### After

The simplest possible first:

```python
async def run(self, settings):
    return await self._execute(settings)
```

Then, in a later section labeled "Production-ready version":

```python
async def run(self, settings: Mapping[str, Any], context: Optional[AzureContext] = None) -> Result[T, E]:
    """Execute the task with full error handling, retry logic, and telemetry."""
    async with self._tracer.span("task.run") as span:
        try:
            resolved = await self._resolve(settings, context)
            return await self._execute_with_retry(resolved, max_attempts=3)
        except (TaskException, AzureException) as ex:
            span.record_exception(ex)
            return Err(self._wrap_error(ex))
```

Same information. The reader gets the shape first; the production details when they are ready.

__Rule applied:__ Simplest sample first (structure-patterns "Code blocks"), plus the anti-pattern S9 (clever-first code samples).

## How to use these examples

Read them when you want to see the rules in action on real content. Each example pairs with the rule it demonstrates. When you have a draft and are not sure how to apply a rule, find the example that matches the shape of your problem and follow the pattern.

The set is intentionally short. The rules are easy to state; the examples make them concrete.
