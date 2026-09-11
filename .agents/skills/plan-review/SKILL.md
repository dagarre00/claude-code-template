---
name: plan-review
description: How to run and answer a pre-implementation adversarial review in this project — dispatching the read-only plan-adversary at a plan (complex/batched cycles) or at the todo itself (simple ones), the six-category sweep, the blocker/risk/note vocabulary, and the apply/escalate/reject protocol. Use before any test is written, when a cycle is about to start. Trigger on "review the plan", "before implementing", "is this todo ready", "pre-implementation review", "plan review", "premortem", "poke holes in the plan", "is this well specified".
type: skill
---

# Plan Review — Pre-Implementation Adversarial Pass

Runs **before Red**, over the intent rather than the code. A read-only `plan-adversary` reads the plan (`[complex]`/batched cycles) or the todo line and the human's instruction (simple ones) and returns numbered findings; each one is applied, escalated, or rejected in writing before the `developer` is dispatched.

**Why before rather than after.** The diff `adversary` finds what the code got wrong; by then the cycle is spent. This pass finds what the *cycle* will get wrong — a Behavior case no step covers, a step that cannot be tested Red-first, an instruction that admits two readings — while the fix is still a paragraph. The two are complements and never substitutes (behavioral rule 12).

**The default disposition inverts here.** `adversarial-review` defaults to Filed because fixing committed code mid-cycle skips Red-first and reorders the queue. Neither cost exists before any code is written, so the default is **Applied**: you change the plan, the todo, or the spec and proceed. Filing a plan finding for later is almost always wrong — you are about to implement the thing it is about.

## Read first

- `docs/wiki/gotchas.md` — the plan-adversary reads this too, and "the plan walks into a known trap" is its highest-yield category.
- The entity `## Behavior` cases the cycle claims to cover — every finding is scored against them.

## When it fires

- **Automatically:** the conductor's development-cycle command, before any test is written — **every cycle**, complex or simple. Unlike the diff review, this one is not gated on `[complex]`: a simple todo is exactly where an unstated assumption survives unchallenged.
- **Never:** after any test is written (that is `adversarial-review`), or as a substitute for a fresh interview pass when the spec itself is the problem — it *routes* there, it does not replace it.

## Steps

1. **Fix the subject.** One of exactly two:
   - **Plan** (`[complex]` or batched, step 4 ran) — the planner's full plan text.
   - **Todo** (simple cycle, no plan) — the todo line verbatim, plus the `$ARGUMENTS` instruction the human typed, if any.

   Nothing else is the subject. If the cycle has neither a plan nor a todo, the problem is upstream — how the conductor picked the work — not this review.

2. **Dispatch the `plan-adversary`** with *only*:
   - the subject from step 1 — a plan goes as `instructions_file: .handoff/<slug>-plan.md`, which the MCP reads in your checkout and inlines; a todo line goes inline in `instructions`. Either way the worker receives text: worktrees do not share scratch, so a path is never something it can open itself,
   - the entity slug(s) and the Behavior case IDs this cycle claims to cover,
   - the test command from `docs/wiki/commands.md`,
   - the branch name, so it can read the code the plan touches.

   **Do not pass** your own opinion of the plan, the planner's reasoning beyond the plan text, or a defence of the todo's wording. You are asking whether the brief survives a hostile reading; pre-answering the objection is how you get a rubber stamp.

   Findings come back **in the report**, not in a mailbox file. There is no scratch file for this review: the round is small, it happens before the worktree holds anything, and its record is the log entry (step 6).

3. **Read the findings.** A pass must still say what was checked — an unexplained "the plan looks fine" is a failed review, so re-dispatch once demanding the `Checked:` line.

4. **Dispose of every finding** — Applied / Escalated / Rejected, one each, no silence (behavioral rule 20).

   | Disposition | When | What you do |
   | --- | --- | --- |
   | **Applied** *(the default)* | The finding is right and the fix is a plan edit, a sharper todo line, or an added Behavior case ID | Edit `.handoff/<slug>-plan.md` — the same file the developer's dispatch will send — or the todo line in `docs/wiki/todos.md`. No re-dispatch of the planner for a paragraph. |
   | **Escalated** | The finding says the **spec** is wrong, ambiguous, or missing — not the plan | `human-checkpoint`, recommending a fresh interview pass. Do not guess the intent and proceed; this is the finding class this review exists to catch. |
   | **Rejected** | The finding misreads the plan, or names work outside this cycle's Behavior cases | One sentence of reason. Out-of-scope work worth doing becomes an ordinary todo line — not an `[adversary]` one, which is reserved for diff-review findings with a sha. |

   A `blocker` that is neither applied nor escalated cannot be rejected into silence: if you disagree with a blocker, that is a `human-checkpoint`, not a rejection.

5. **Re-plan only for a structural blocker.** If the findings show the plan's *approach* is wrong rather than its details — wrong decomposition, a step order that cannot work — re-dispatch the `planner` once with the findings attached. Anything smaller you apply yourself. **One round either way**: this review never re-reviews its own corrections. If a second dispatch would be round three on the same disagreement, that is a `human-checkpoint` with both positions stated.

6. **Record it in the cycle's log entry.** No commit exists yet to carry the dispositions, so the `work` log entry the conductor writes at the end of the cycle is the committed record (rule 20 — the record is committed, and here that is the log):

   ```markdown
   - Plan review: 3 findings — 2 applied, 1 rejected
     - P1 blocker spec-fidelity — Applied: B3 had no step; plan step 4 now covers it.
     - P2 risk testability — Applied: step 2 split so the parser fails Red on its own.
     - P3 note scope — Rejected: the retry policy is entity `billing`, not this cycle.
   ```

   Escalations are the exception worth naming twice: a cycle that stopped for a fresh interview pass says so in the report, not only in the log.

## The six-category sweep

Ordered by what actually costs a cycle. Categories 1–3 are where re-work comes from; 4–6 are where the surprises are.

| # | Category | Look for |
| - | --- | --- |
| 1 | **spec fidelity** | A named Behavior case with no step that implements it; a step implementing something no case asks for; a plan that restates the case instead of decomposing it |
| 2 | **testability** | A step with no observable outcome to assert; a step that cannot fail Red on its own (rule 2); "add validation" with no stated input that must be rejected |
| 3 | **sequencing** | A step depending on something a later step builds; a hidden prerequisite (migration, fixture, config, seeded data); two steps that must land together but are listed apart |
| 4 | **scope** | Creep past the todo; a step touching files outside the entity; under-scope — a case that needs work no step mentions |
| 5 | **known traps** | The plan walks into an entry in `docs/wiki/gotchas.md`, contradicts an ADR in `docs/wiki/decisions/`, or breaks a `## Conventions` rule in `architecture.md` |
| 6 | **ambiguity** | A step whose "done" is not decidable; a todo admitting two readings; an instruction whose scope depends on an unstated assumption. **This is the category that escalates** |

## Severity vocabulary (closed)

Deliberately not the diff review's four. Severity there decides whether a human is interrupted; here it decides whether the cycle may start.

| Severity | Meaning | Consequence |
| --- | --- | --- |
| `blocker` | The cycle cannot correctly start as briefed — a case with no step, an ambiguity with two live readings, a plan that contradicts the spec | Must be Applied or Escalated before Red. Never rejected without a `human-checkpoint` |
| `risk` | Implementable as written, but likely to cause re-work — thin sequencing, a step that is hard to test first | Apply if the fix is a paragraph; otherwise escalate |
| `note` | Worth knowing, not worth stopping for | Apply at your discretion; tally the rest |

Doubt grades **up** here, the opposite of the diff review. A false `blocker` costs one paragraph of discussion before any code exists; a missed one costs the whole cycle.

## Wiki update

- **Applied to a todo** → the sharpened line in `docs/wiki/todos.md`, committed with the cycle.
- **Escalated** → whatever the fresh interview pass writes to the entity page. This review writes no spec itself.
- **A trap the plan nearly walked into** → `gotcha-recording`, inline, in the cycle's first commit. The trap is real whether or not the plan hit it.
- **Dispositions** → the `Plan review:` field of the `work` log entry (step 6 above). Never a separate report; the periodic whole-repo review owns those.

## Anti-patterns

- **Defending the plan in the dispatch.** "Here's why step 3 is fine" produces agreement, which is not a review.
- **Filing plan findings for later.** You are about to implement the subject of the finding. Applied or Escalated; a filed plan finding is a cycle that knowingly starts wrong.
- **Letting it write the plan.** It raises; the `planner` or the conductor edits. A reviewer that rewrites the plan has authored the thing it was checking (rule 12).
- **Running it after Red.** Once tests exist the subject is code, and the right role is the diff `adversary`.
- **Skipping it on simple todos.** A one-line todo is where an unstated assumption travels furthest — it is precisely the cheap case to check.
- **Escalating everything.** A `human-checkpoint` per finding trains the human to approve without reading. One checkpoint, all escalations, once.
- **Round three.** Two positions that survive a re-plan are a decision, not a review. Take it to the human.
