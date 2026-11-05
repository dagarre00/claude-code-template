---
name: gotcha-recording
description: Subagent-side (loaded on demand by developer) or conductor. How to capture a project-specific failure mode or footgun in docs/wiki/gotchas.md so future cycles avoid it. Trigger on "gotcha", "burned by", "footgun", "surprising behavior".
user-invocable: false
---

# Recording a Gotcha

Project-specific traps go in `docs/wiki/gotchas.md` (universal agent discipline belongs in `.claude/rules/behavioral.md`).

## When

Record a gotcha when a surprising project/library/config quirk burned time, a passing test masked broken behavior, or two wiki pages contradicted each other in practice. Skip general language facts, typos, or already-documented rules.

## Procedure

1. Append under the relevant section of `docs/wiki/gotchas.md` (`## Critical` for data corruption or security risks):

   ```markdown
   ### <Short, scannable title>

   **When:** <the exact situation that surfaces it>
   **Symptom:** <what you saw>
   **Cause:** <what was actually happening>
   **Fix:** <what to do>
   **Related:** [[entities/<slug>]], [[concepts/<pattern>]]
   ```

   Keep each field to one short paragraph in impersonal voice. If no fix is known, write `Fix: TBD` and queue a wiki-todo.
2. Queue a `docs/wiki/wiki-todos.md` line if the gotcha implies a missing skill/command, or if `gotchas.md` reaches 20+ entries (`**When:**` count): `- [ ] YYYY-MM-DD agent: gotchas.md has N entries — compact it during the next wiki health pass` (use `Follow-ups:` if running as a subagent).
3. **Ship with the change that discovered it** (include `docs/wiki/gotchas.md` in the case's reported paths).
