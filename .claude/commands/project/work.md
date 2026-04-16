---
name: project-work
description: Pull the top pending TODO from wiki/todos.md and run the full query→plan→implement→test→review→update-wiki→log loop.
type: command
---

Run the **9-step work loop** for the top pending TODO in `docs/wiki/todos.md`.

## The loop

1. **Pick** — read `docs/wiki/todos.md`, select the top `P0`/`P1` row with status `Pending`. If ambiguous, ask the user.
2. **Query** — load `docs/wiki/requirements.md`, the relevant `docs/wiki/entities/<slug>.md`, `docs/wiki/architecture.md`, and `docs/wiki/gotchas.md`. Establish expected behavior, conventions, and known failure points. If the entity page is missing, create a stub from the requirements section.
3. **Plan** — draft a short implementation plan (5–10 bullets: files to touch, approach, risks). Present it to the user. **Wait for confirmation.** Never skip this step.
4. **Branch** — `feat/<slug>` or `fix/<slug>` based on TODO ID. Move the TODO row from `Pending` to `In Progress` in `docs/wiki/todos.md`.
5. **Implement** — dispatch the **implementer** agent with the task + plan + entity-page contents as scoped context.
6. **Test** — dispatch the **tester** agent. Fail the loop if tests don't pass; surface errors and stop.
7. **Review** — dispatch the **reviewer** agent. If Critical issues, fix and re-review or rollback.
8. **Update the wiki** — dispatch the **wiki-maintainer** agent with the diff + task context. It must:
   - Update `docs/wiki/entities/<slug>.md` to reflect what was built.
   - Add an ADR to `docs/wiki/decisions/` if a non-trivial choice was made.
   - Update `docs/wiki/requirements.md` if the spec changed (rare — ideally spec comes first).
   - Move the TODO from `In Progress` in `docs/wiki/todos.md` to `docs/wiki/completed.md` with the first commit SHA.
   - Update `docs/wiki/commands.md` if new commands were introduced.
   - Update `docs/wiki/gotchas.md` if the reviewer flagged new gotchas.
   - Append `## [YYYY-MM-DD] work | <task-title>` to `docs/wiki/log.md`.
9. **Commit** — conventional commit message (`feat(<area>): <desc>`) referencing the TODO slug.

## Rules

- Always branch before step 5.
- Never mark a TODO completed if tests fail or review has Critical items.
- Rollback over fix-forward: if implementation fails review twice, `/project:rollback` to the pre-work checkpoint and retry from step 3 with a revised plan.
- Wiki update in step 8 is **non-optional** — it's what keeps code and spec aligned. The `wiki-drift-check` hook will warn you at session end if you skipped it.
