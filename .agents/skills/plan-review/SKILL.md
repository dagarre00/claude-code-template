---
name: plan-review
description: How a read-only plan-adversary attacks a brief before any test exists — the plan on complex/batched cycles, the todo line on simple ones — with the six-category sweep, the blocker/risk/note vocabulary, and the report format. Worker-side procedure; how the conductor dispatches it and disposes of what it raises is the finding-disposition skill. Trigger on "review the plan", "pre-implementation review", "plan review", "premortem", "poke holes in the plan", "is this well specified".
type: skill
---

# Plan Review — the sweep

Your subject is intent — a plan, or a todo line plus the human's instruction — for a cycle that has not started. Every defect caught now costs a paragraph; caught after Red, it costs the cycle.

## The six-category sweep

Work them in order. 1–3 are where re-work comes from; 4–6 are where the surprises are.

| # | Category | Look for |
| - | --- | --- |
| 1 | **spec fidelity** | A named Behavior case with no step; a step no case asks for; a plan that restates a case instead of decomposing it |
| 2 | **testability** | A step with no observable outcome to assert; a step that cannot fail Red on its own; "add validation" with no stated input that must be rejected |
| 3 | **sequencing** | A step depending on a later one; a hidden prerequisite (migration, fixture, config, seeded data); two steps that must land together but are listed apart |
| 4 | **scope** | Creep past the todo; files outside the entity; a case needing work no step mentions |
| 5 | **known traps** | Walks into a `gotchas.md` entry, contradicts an ADR, breaks `architecture.md § Conventions`, or places code in the wrong layer / adds a dependency `§ Layers` forbids |
| 6 | **ambiguity** | A step whose "done" is not decidable; a todo with two readings; scope that rests on an unstated assumption. **This category escalates to the human** |

Two mechanical checks inside the sweep:

- **Case coverage.** List the case IDs your assignment names and map each to its step(s). A case with no step is a `blocker`, every time.
- **Red-first viability.** For each step, state the assertion that would fail before it is implemented. If you cannot, the step is not testable as written — a `risk` at minimum.

Verify before asserting: grep for a helper the plan assumes exists; state both readings of an ambiguous line and what each would produce. An unchecked finding is `confidence: low` or dropped.

## Severity (closed)

| Severity | Meaning |
| --- | --- |
| `blocker` | The cycle cannot correctly start as briefed — a case with no step, two live readings, a plan contradicting the spec or the layers |
| `risk` | Implementable, but likely to cause re-work — thin sequencing, a step hard to test first |
| `note` | Worth knowing, not worth stopping for |

Doubt grades **up**: unsure between `blocker` and `risk` → `blocker`, saying why it might be lower. A false blocker costs a paragraph; a missed one costs the cycle.

## Report format

Number findings `P1`, `P2`, … most severe first.

```markdown
**Subject:** plan | todo — <entity slug(s)>, cases <B1, B2>
**Checked:** <one line per category swept, and what you read>

## P1 — blocker — spec-fidelity — <one-line claim>

**Where:** plan step 4 | todo line | `path/to/file.py:42`
**What's wrong:** <2–3 sentences, mechanism not vibes>
**What it costs:** <what the cycle produces if this is not fixed first>
**Suggested resolution:** <the smallest change to the brief — one sentence, never a patch>
**Confidence:** high | medium | low

**Notes:** <tally of `note` items, one clause each>
```

`blocker` and `risk` get the full shape; a `note` is one clause in the tally. A round with nothing above `note` still carries the `Checked:` line — an unexplained pass is a failed review.

**Re-dispatched after a re-plan:** read the revised brief only, confirm or contest the changes, and do not reopen lines of attack you had the first time.
