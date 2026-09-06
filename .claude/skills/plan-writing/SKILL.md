---
name: "plan-writing"
description: "How to write an implementation plan for a complex or batched todo in this project. Loads when the planner agent runs, or when the human asks for \"a plan\", \"decomposition\", \"breakdown\", \"implementation strategy\", \"sequencing\"."
---

<!-- Generated from .harness/skills/plan-writing/SKILL.md; DO NOT EDIT. Run node scripts/sync-harness.mjs. -->

# Plan Writing

Use this as the `planner` every time you draft a plan for a `[complex]` todo or a batched cycle, before any test is written. Output is the complete Markdown plan in your final response. You are read-only:
do not create scratch or wiki files. The conductor collects the report through
MCP and passes its full text to the developer.

## Read first

- `docs/wiki/entities/<slug>.md` — the `## Behavior` section is the contract you are decomposing. List the case IDs you'll cover this cycle.
- `docs/wiki/requirements.md` — the relevant section. Cases must support requirements.
- `docs/wiki/architecture.md` — stack, layering, testing strategy. The plan must fit the project's pattern, not invent a new one.
- `docs/wiki/gotchas.md` — known failure points that should shape the sequence.
- `docs/wiki/commands.md` — copy the canonical test command verbatim into the plan.
- A glance at the existing implementation of one similar entity — mirror file layout and naming.

## Plan structure

Return the plan using this template; do not wrap the entire response in an outer
code fence or replace its content with a file path:

```
# Plan: <slug>

## Goal
<one paragraph — what shipping this todo (or batch) means in observable terms>

## Behavior cases covered
- <slug> B1: <case text, copied from the entity page>
- <slug> B2: <case text, copied from the entity page>

## Approach
<2-4 sentences — the chosen approach, with one-line justification vs alternatives. On retry, name the prior failed approach and why this one is fundamentally different.>

## Steps
1. <action> (touches: file/dir)
2. <action> (touches: file/dir)
3. <action> (touches: file/dir)

## Owned paths and dependencies (estimate)
- path/to/file.py — change description
- path/to/other.py — change description
- tests/... and docs/wiki/entities/... — verification/spec updates
- Shared ledgers/interfaces — specify conductor ownership or sequential execution
- Dependencies — which committed result must be integrated before this work starts

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

Each step should be small enough that **a single test can drive it**. If a step needs more than three sub-changes or covers more than one Behavior case, split it. The `developer` should be able to map step N → test N → green N without ambiguity.

## Where it lives

The authoritative deliverable is your complete returned report, captured in the
task's runtime output. The conductor may persist a copy at
`.harness/handoff/<slug>-plan.md`; that ignored file is not copied into worktrees.
The conductor forwards the full plan text to the developer. Runtime logs and
local worker commits are not an off-device backup; only the conductor pushes
verified integration commits. If a session ends, inspect existing task status
before regenerating a plan or duplicating active work.

## Handoff to the developer

You do not write tests or code — the `developer` does, reading your plan first. Steps are written one Behavior case at a time, and the `## Steps` order is the order the developer will write tests in. Make the sequence drive Red cleanly: if a step would force a test that can't fail for the right reason, fix the ordering in the plan rather than leaving the developer to bend the test.

## Update on retry

When re-dispatched after a failed `developer` attempt (two-strike rule — behavioral rule 5), **return a new complete plan with a fundamentally different approach**. Do not tweak. In the new `## Approach` section, explicitly name the prior approach, why it failed, and why the new approach should succeed. Keep `## Behavior cases covered` identical; only the sequencing and shape change.

## Anti-patterns

- **Pseudocode in steps.** Steps name the action and the file target, not the implementation. The `developer` chooses the code at the Green step.
- **Inventing requirements.** If a Behavior case is missing or ambiguous, escalate via `human-checkpoint` and recommend `/project:interview`. Never write a plan that assumes behavior the entity page does not list.
- **Editing entity pages.** Plans are how, not what. Spec changes go through `/project:interview` and `spec-writing`.
- **Cross-entity batching without a precedent.** If the batch crosses architectural boundaries (e.g. backend + frontend in one cycle) and no prior cycle did so, stop and ask the human.
- **Skipping the risks section.** "No risks" is rarely true on a complex todo. If you genuinely see none, state why — usually it means the scope is small enough that it shouldn't have been flagged `[complex]`.
- **Step count > Behavior case count by a large margin.** A blow-up usually means scope creep snuck in. Re-check `## Out of scope`.
