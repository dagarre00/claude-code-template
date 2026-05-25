---
name: plan-writing
description: How to write an implementation plan for a complex or batched todo in this project. Loads when the developer plans a [complex] or batched todo before testing, or when the human asks for "a plan", "decomposition", "breakdown", "implementation strategy", "sequencing".
type: skill
---

# Plan Writing

Use this every time you draft a plan for a `[complex]` todo or a batched cycle, before writing any tests. Output is one markdown file at `.claude/handoff/<slug>-plan.md` (gitignored scratch you delete when the cycle is done).

## Read first

- `docs/wiki/entities/<slug>.md` — the `## Behavior` section is the contract you are decomposing. List the case IDs you'll cover this cycle.
- `docs/wiki/requirements.md` — the relevant section. Cases must support requirements.
- `docs/wiki/architecture.md` — stack, layering, testing strategy. The plan must fit the project's pattern, not invent a new one.
- `docs/wiki/gotchas.md` — known failure points that should shape the sequence.
- `docs/wiki/commands.md` — copy the canonical test command verbatim into the plan.
- A glance at the existing implementation of one similar entity — mirror file layout and naming.

## Plan structure

Write the plan to `.claude/handoff/<slug>-plan.md` using this exact template:

```
# Plan: <slug>

## Goal
<one paragraph — what shipping this todo (or batch) means in observable terms>

## Behavior cases covered
- <slug>#<case-anchor>
- <slug>#<case-anchor>

## Approach
<2-4 sentences — the chosen approach, with one-line justification vs alternatives. On retry, name the prior failed approach and why this one is fundamentally different.>

## Steps
1. <action> (touches: file/dir)
2. <action> (touches: file/dir)
3. <action> (touches: file/dir)

## Files to touch (estimate)
- path/to/file.py — change description
- path/to/other.py — change description

## Risks / unknowns
- <risk> → mitigation
- <unknown> → how it will be resolved (and at which step)

## Out of scope
- <explicit non-goal>
- <explicit non-goal>

## Test command
<copy verbatim from docs/wiki/commands.md ## Test>
```

## Sizing rule

Each step should be small enough that **a single test can drive it**. If a step needs more than three sub-changes or covers more than one Behavior case, split it. You should be able to map step N → test N → green N as you work the loop, without ambiguity.

## Where it lives

`.claude/handoff/<slug>-plan.md`. One plan per branch. `*-plan.md` is `.gitignore`'d, so plans are transient scratch and never reach the remote. Overwrite on retry rather than versioning; delete it when the cycle is done. **Because the plan is not committed, it does not survive a container recycle** — but neither does the rest of the cycle (the bundled commit happens only at the end of `/project:work`), so a recycle just restarts the todo and you re-derive the plan from the entity page's Behavior cases, which are the authoritative contract.

## Driving the loop from the plan

You write the tests and the code yourself — the plan is your own sequencing aid. Write tests one Behavior case at a time, in the plan's `## Steps` order. If you find the sequence forces a test that can't fail for the right reason, fix the plan first, then continue — don't bend the test to a bad plan.

## Update on retry

On a second attempt at the same mechanism (two-strike rule — behavioral rule 5), **overwrite the plan with a fundamentally different approach**. Do not tweak. In the new `## Approach` section, explicitly name the prior approach, why it failed, and why the new approach should succeed. Keep `## Behavior cases covered` identical; only the sequencing and shape change.

## Anti-patterns

- **Pseudocode in steps.** Steps name the action and the file target, not the implementation. You choose the code at the Green step.
- **Inventing requirements.** If a Behavior case is missing or ambiguous, escalate via `human-checkpoint` and recommend `/project:interview`. Never write a plan that assumes behavior the entity page does not list.
- **Editing entity pages.** Plans are how, not what. Spec changes go through `/project:interview` and `spec-writing`.
- **Cross-entity batching without a precedent.** If the batch crosses architectural boundaries (e.g. backend + frontend in one cycle) and no prior cycle did so, stop and ask the human.
- **Skipping the risks section.** "No risks" is rarely true on a complex todo. If you genuinely see none, state why — usually it means the scope is small enough that it shouldn't have been flagged `[complex]`.
- **Step count > Behavior case count by a large margin.** A blow-up usually means scope creep snuck in. Re-check `## Out of scope`.
