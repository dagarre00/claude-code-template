---
name: plan-writing
description: How to write an implementation plan for a complex or batched todo in this project. Loads when the planner agent runs, or when the human asks for "a plan", "decomposition", "breakdown", "implementation strategy", "sequencing".
type: skill
---

# Plan Writing

The plan is returned in full as your report — never written to disk. The developer receives its text.

## Read first

- `docs/wiki/entities/<slug>.md` — the `## Behavior` section is the contract you are decomposing. List the case IDs you cover this cycle.
- `docs/wiki/requirements.md` — the relevant section.
- `docs/wiki/architecture.md` — `## Stack`, `## Layers`, `## Testing strategy`. The plan fits the project's structure; it never invents a new one.
- `docs/wiki/gotchas.md` — known failure points that should shape the sequence.
- `docs/wiki/commands.md` — the test command and the architecture check, verbatim.
- One similar existing entity's implementation — mirror its layout and naming.

## Plan structure

Use this exact template:

```
# Plan: <slug>

## Goal
<one paragraph — what shipping this means in observable terms>

## Behavior cases covered
- <slug> B1: <case text, copied from the entity page>

## Approach
<2-4 sentences — the approach, with one-line justification vs alternatives. On retry, name the prior failed approach and why this one is fundamentally different.>

## Steps
1. <action> (case: B1; layer: <layer>; touches: path)
2. ...

## Files to touch (estimate)
- path/to/file — layer — change description

## New dependencies between layers
- <from layer> → <to layer>: <why>, and the port/interface it goes through — or "none"

## Risks / unknowns
- <risk> → mitigation
- <case no worker can verify> → the command it needs, which only the conductor can run

## Out of scope
- <explicit non-goal>

## Test command
<verbatim from docs/wiki/commands.md>
```

## Sizing rule

Each step is small enough that **one test drives it**. More than three sub-changes, or more than one Behavior case, → split it. The developer maps step N → test N → green N without ambiguity, in `## Steps` order, so order the steps so each can fail Red on its own.

## Layers

Every new file names its layer from `architecture.md § Layers`. A step that would make an inner layer (domain, application) import an outer one (adapters, infrastructure, a framework) is wrong as written: route it through a port the inner layer owns and an adapter the outer layer implements, and list that under `## New dependencies between layers`. If the plan cannot fit the declared layers, stop and report — changing the architecture is a human decision recorded as an ADR, never a plan step.

## Update on retry

When re-dispatched after a failed developer attempt, **overwrite the plan with a fundamentally different approach**. In `## Approach`, name the prior approach, why it failed, and why the new one should succeed. Keep `## Behavior cases covered` identical.

## Anti-patterns

- **Pseudocode in steps.** Steps name the action and the file, not the implementation.
- **Inventing requirements.** A missing or ambiguous Behavior case is a blocker to report, recommending a fresh interview pass — never a plan that assumes behavior the entity page does not list.
- **Editing entity pages.** Plans are how, not what.
- **Cross-entity batching without a precedent.** A batch crossing architectural boundaries with no prior cycle doing so → stop and report.
- **Skipping the risks section.** "No risks" on a complex todo usually means it should not have been flagged `[complex]` — say which.
- **Far more steps than cases.** Usually scope creep; re-check `## Out of scope`.
