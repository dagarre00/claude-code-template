---
name: plan-review
description: Subagent-side, preloaded into the plan-adversary. How the read-only plan-adversary attacks a brief before any test exists — six-category sweep, blocker/risk/note severity vocabulary, and report format; the conductor's side is finding-disposition.
user-invocable: false
---

# Plan Review — the sweep

Review the pre-implementation brief (plan or simple-cycle todo line) before any test is written.

## The six-category sweep

Sweep all 6 categories in order:

| # | Category | Look for |
| - | --- | --- |
| 1 | **spec fidelity** | Named Behavior case with no step; step no case asks for; plan restating a case instead of decomposing it |
| 2 | **testability** | Step with no observable assertion; step that cannot fail Red on its own; "add validation" without specifying rejected inputs |
| 3 | **sequencing** | Step depending on a later step; hidden prerequisite (migration, fixture, config); coupled steps listed apart |
| 4 | **scope** | Creep past the todo; files outside the entity; over-building (unforced file, abstraction, or dependency when existing code/stdlib/platform suffices; required `§ Layers` ports excepted) |
| 5 | **known traps** | Walks into a `gotchas.md` entry, contradicts an ADR, breaks `architecture.md § Conventions`, or violates `§ Layers` |
| 6 | **ambiguity** | Undecidable "done" criteria; two valid readings of a step or todo; unstated assumption (**escalates to human**) |

Always perform two mechanical checks:
- **Case coverage:** Map every briefed Behavior case ID to its step(s). A case with no step is always a `blocker`.
- **Red-first viability:** State the failing assertion for each step. If none exists, grade at least `risk`.

Verify claims before reporting (grep for assumed helpers; state both readings of an ambiguity). Drop or mark `confidence: low` if unverified.

## Severity (closed)

| Severity | Meaning |
| --- | --- |
| `blocker` | Cycle cannot start safely — unmapped case, two live readings, or spec/layer contradiction |
| `risk` | Implementable, but likely to cause rework — thin sequencing or hard-to-test step |
| `note` | Minor observation not worth stopping for |

Grade **up** on doubt (`blocker` over `risk`, explaining why).

## Report format

Number findings `P1`, `P2`, … most severe first:

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

`blocker` and `risk` get full sections; `note` items go in the `Notes:` tally. If nothing exceeds `note`, say so with the `Checked:` lines. On re-dispatch after a re-plan, check only the revised brief without reopening round-one lines of attack.
