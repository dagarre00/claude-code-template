---
name: plan-writing
description: How to write an implementation plan for a complex or batched todo in this project. Loads when the planner agent runs, or when the human asks for "a plan", "decomposition", "breakdown", "implementation strategy", "sequencing".
type: skill
---

# Plan Writing

Use this every time you draft a plan for a `[complex]` todo or a batched cycle. Output is one markdown file at `.claude/handoff/<slug>-plan.md`, sibling to the tester's JSON handoff.

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

Each step should be small enough that **a single test can drive it**. If a step needs more than three sub-changes or covers more than one Behavior case, split it. The implementer should be able to map step N → test N → green N → commit N (or grouped commit) without ambiguity.

## Where it lives

`.claude/handoff/<slug>-plan.md`. One plan per branch — sibling to the JSON handoff at `.claude/handoff/<slug>.json` (see [[concepts/handoff-format]]). `*-plan.md` is `.gitignore`'d, so plans are transient and never reach the remote. Overwrite on retry rather than versioning. **Because the plan is not committed, it does not survive a container recycle.** If `/project:work` resumes a planned cycle mid-flight and the plan is gone, it re-dispatches the planner to regenerate it from the same scope — the committed Red tests + JSON handoff are the authoritative contract, and a regenerated plan must cover the same Behavior cases.

## Interaction with tester

The tester reads the plan to understand the intended decomposition before drafting failing tests. Tests are written one Behavior case at a time, and the plan's `## Steps` order should match the test order. If the tester finds the plan's sequence forces them to write a test that can't fail for the right reason, they hand back — fix the plan, then re-dispatch tester.

## Update on retry

When re-dispatched after a failed implementer attempt (the JSON handoff has `attempt >= 2`), **overwrite the plan with a fundamentally different approach**. Do not tweak — the two-strike rule (see [[glossary#two-strike-rule]]) applies. In the new `## Approach` section, explicitly name the prior approach, why it failed, and why the new approach should succeed. Keep `## Behavior cases covered` identical; only the sequencing and shape change.

## Anti-patterns

- **Pseudocode in steps.** Steps name the action and the file target, not the implementation. The implementer chooses the code.
- **Inventing requirements.** If a Behavior case is missing or ambiguous, escalate via `human-checkpoint` and recommend `/project:interview`. Never write a plan that assumes behavior the entity page does not list.
- **Editing entity pages.** Plans are how, not what. Spec changes go through `/project:interview` and `spec-writing`.
- **Cross-entity batching without a precedent.** If the batch crosses architectural boundaries (e.g. backend + frontend in one cycle) and no prior cycle did so, stop and ask the human.
- **Skipping the risks section.** "No risks" is rarely true on a complex todo. If you genuinely see none, state why — usually it means the scope is small enough that it shouldn't have been flagged `[complex]`.
- **Step count > Behavior case count by a large margin.** A blow-up usually means scope creep snuck in. Re-check `## Out of scope`.
