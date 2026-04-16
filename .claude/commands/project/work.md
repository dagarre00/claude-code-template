---
name: project-work
description: Pull the top pending TODO from wiki/todos.md and run the full query→plan→implement→test→review→update-wiki→log loop.
type: command
---

Run the **9-step work loop** for the top pending TODO in `docs/wiki/todos.md`.

## The loop

1. **Pick** — read `docs/wiki/todos.md`, select the top `P0`/`P1` row with status `Pending`. If ambiguous, ask the user.

2. **Query** — load `docs/wiki/requirements.md`, the relevant `docs/wiki/entities/<slug>.md`, `docs/wiki/architecture.md`, and `docs/wiki/gotchas.md`. Establish expected behavior, conventions, and known failure points. If the entity page is missing, create a stub from the requirements section.
   - **Stale check:** look at the entity page's `## Code References` section. If the `<!-- Last verified: -->` date is more than 30 days older than the `updated:` frontmatter, flag it before implementing — the implementer must re-verify those references as part of this task even if the underlying code is not changing.

3. **Plan** — draft a short implementation plan (5–10 bullets: files to touch, approach, risks). Present it to the user. **Wait for confirmation.** Never skip this step.

4. **Branch** — `feat/<slug>` or `fix/<slug>` based on TODO ID. Move the TODO row from `Pending` to `In Progress` in `docs/wiki/todos.md`.

5. **Implement** — dispatch the **implementer** agent with the task + plan + entity-page contents as scoped context. The implementer is responsible for updating the `## Code References` table in the entity page as it writes code — this happens atomically with the code change, not as a deferred step.

6. **Test** — dispatch the **tester** agent. Fail the loop if tests don't pass; surface errors and stop.

7. **Review** — dispatch the **reviewer** agent. Then follow the two-strike rule:
   - **No Critical issues** → proceed to step 8.
   - **Critical issues (first occurrence)** → dispatch the **implementer** for a targeted **patch pass**: fix only the specific items the reviewer flagged, no new scope. Re-dispatch the reviewer. This is the one allowed fix attempt.
   - **Critical issues remain after the patch pass** → `/project:rollback` to the pre-work checkpoint. Restart from step 3 with a revised plan that addresses the root cause. Do not attempt a third fix pass.
   - **Warning or Suggestion issues only** → proceed to step 8 and pass them to wiki-maintainer for `docs/wiki/gotchas.md`.

8. **Update the wiki** — dispatch the **wiki-maintainer** agent with the diff + task context. The `## Code References` table was already updated by the implementer in step 5; wiki-maintainer verifies it is current but does not rewrite it. Structural updates it must make:
   - Update the `## Behavior`, `## Interface`, and `## Design` sections of `docs/wiki/entities/<slug>.md` to match what was built.
   - Add an ADR to `docs/wiki/decisions/` if a non-trivial design choice was made.
   - Update `docs/wiki/requirements.md` if the spec changed (rare — ideally spec comes first).
   - Move the TODO from `In Progress` in `docs/wiki/todos.md` to `docs/wiki/completed.md` with the first commit SHA.
   - Update `docs/wiki/commands.md` if new commands were introduced.
   - Update `docs/wiki/gotchas.md` if the reviewer flagged new patterns or failure modes.
   - Append `## [YYYY-MM-DD] work | <task-title>` to `docs/wiki/log.md`.

9. **Commit** — conventional commit message (`feat(<area>): <desc>`) referencing the TODO slug.

## Rules

- Always branch before step 5.
- Never mark a TODO completed if tests fail or review has Critical items.
- The two-strike rule applies to both implementation and review: two failures on the same approach means pivot, not retry. `/project:rollback` and restart from step 3.
- Steps 5 (Code References) and 8 (structural wiki) are both non-optional. Skipping either creates drift. The `wiki-drift-check` hook warns at session end; the `code-ref-check` hook warns inline during step 5.
