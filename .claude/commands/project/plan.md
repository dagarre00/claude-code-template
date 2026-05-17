---
name: plan
description: Explicitly invoke the planner agent on a todo without starting the full /work TDD cycle. Useful for estimation, scoping conversations, or pre-planning a complex feature before committing to /work.
type: command
---

# /plan

You dispatch the `planner` agent on a single todo (or batch) and stop at the plan file. You do **not** branch, write tests, or write code — that's `/work`'s job.

## When to use

- Before deciding whether a todo is ready for `/work` — see the shape of the work first.
- Estimation conversations — the human wants a sense of step count and risk before committing branch effort.
- Complex feature you want sequenced and sanity-checked before `feat/*` is opened.
- Re-planning after a two-strike pivot, when the prior plan needs to be overwritten with a different approach.

## Preconditions

- `docs/wiki/entities/<slug>.md` exists and has at least one `## Behavior` case.
- `docs/wiki/commands.md` has a working test command.

If the entity page is missing or has no Behavior cases, **stop** and recommend `/interview` to define the spec first. The planner refuses to plan against an empty contract.

## Steps

1. **Identify the target.**
   - Argument is the entity slug (e.g. `/plan auth-login`) or `top` to mean "the next todo in `docs/wiki/todos.md`".
   - If `top`, read `docs/wiki/todos.md` and resolve to the matching entity slug.

2. **Confirm the entity page exists** at `docs/wiki/entities/<slug>.md` with at least one `## Behavior` case. If not, stop and recommend `/interview`.

3. **Dispatch the `planner` agent** with scope:
   - Entity slug.
   - The todo line(s) from `docs/wiki/todos.md` for context (including any `[complex]` tag or batch grouping).
   - The test command from `docs/wiki/commands.md`.
   - Paths to the entity page, `docs/wiki/requirements.md`, `docs/wiki/architecture.md`, `docs/wiki/gotchas.md`.

4. **Planner writes** `.claude/handoff/<slug>-plan.md` following the `plan-writing` skill.

5. **Report to the human in summarized form.** Do **not** dump the whole plan file. Show:
   - **Goal** (one line).
   - **Approach** (one line).
   - **Step count** + the first 2–3 step headlines.
   - **Top risks** (up to 3).
   - **Path to the full plan** so the human can read it in Obsidian.

6. **Recommend the next step:**
   - `/work` to execute the plan now.
   - `/interview` to refine the Behavior cases if the plan exposed spec gaps.
   - Human iteration on the plan, then re-run `/plan` (planner overwrites on retry).

## What you do NOT do

- **No branching.** No `feat/*` checkout. `/plan` runs on whatever branch you are on (usually `main`).
- **No test writing.** That's `tester` via `/work`.
- **No production code.** That's `implementer` via `/work`.
- **No tester or implementer dispatch.** `/plan` stops at the plan file. The human decides whether to follow up with `/work`.
- **No commits.** The plan lives in `.claude/handoff/` which is gitignored — there's nothing to commit.

## Failure modes

- **No entity page** → stop, recommend `/interview`.
- **Empty `## Behavior`** → stop, recommend `/interview` or `spec-writing`.
- **Planner can't produce a coherent plan** → the spec is too ambiguous. The planner will surface this via `human-checkpoint`; relay the ask to the human and recommend `/interview`.
- **Planner asks for a decision** → relay the `human-checkpoint` ask verbatim. Don't decide for the human.
