---
name: plan-writing
description: Subagent-side, preloaded into the planner. How to write an implementation plan for a complex or batched todo — scope, one-test steps, layers, risks, and the plan template.
user-invocable: false
---

# Plan Writing

When dispatched as `planner`, write the plan to `.handoff/<slug>-plan.md` (overwriting any prior version) and return the path plus a short summary. When asked for a plan in conversation, output it directly.

## Read first

- `docs/wiki/entities/<slug>.md` (or `docs/wiki/concepts/<slug>.md` for `[infra]`) — decompose its `## Behavior` cases.
- `docs/wiki/requirements.md` — relevant requirement section.
- `docs/wiki/architecture.md` — `## Stack`, `## Layers`, `## Testing strategy`.
- `docs/wiki/gotchas.md` — known failure points.
- `docs/wiki/commands.md` — verbatim test command and architecture check.
- One similar entity's implementation to mirror layout and naming.

## Plan structure

```markdown
# Plan: <slug>

## Goal
<one paragraph — what shipping this means in observable terms>

## Behavior cases covered
- <slug> B1: <case text, copied from the entity page>

## Approach
<2-4 sentences — approach, one-line justification vs alternatives, and what existing code/stdlib/dependency it reuses. On retry, name the prior failed approach and why this one is fundamentally different.>

## Steps
1. <action> (case: B1; layer: <layer>; touches: path)
2. ...

## Files to touch (estimate)
- path/to/file — layer — change description

## New dependencies between layers
- <from layer> → <to layer>: <why>, and the port/interface it goes through — or "none"

## Risks / unknowns
- <risk> → mitigation
- <case no subagent can verify> → command only the conductor can run

## Out of scope
- <explicit non-goal>

## Test command
<verbatim from docs/wiki/commands.md>
```

## Sizing rule

Each step must be small enough that **one failing test drives it** (`step N → test N → green N`). Split any step that covers multiple Behavior cases or more than three sub-changes, and order steps so each can fail Red independently.

## Layers

Assign every new file a boundary from `architecture.md § Layers` (none under the `flat` shape). Route any need the table forbids (an inner boundary reaching an outer one, a slice reaching another's internals) through a port or public API and list it under `## New dependencies between layers`. If the task cannot fit the declared boundaries, stop and report (changing the shape or a boundary requires a human decision and an ADR).

## Update on retry

When re-dispatched after a two-strike failure, **overwrite `.handoff/<slug>-plan.md` with a fundamentally different approach**, naming the failed approach and why the new one avoids that failure mode while keeping `## Behavior cases covered` identical.

## Anti-patterns

- **Pseudocode in steps** (name actions and files, not code).
- **Inventing requirements** (if a Behavior case is missing or ambiguous, stop and report).
- **Editing wiki pages.**
- **Over-building** (unforced files, abstractions, or dependencies when existing code/stdlib/platform suffices).
