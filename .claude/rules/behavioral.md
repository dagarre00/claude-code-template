---
name: behavioral
description: Hard behavioral constraints. Each rule exists because of a specific past failure.
type: rule
paths: ["**"]
---

# Behavioral Rules

Hard constraints from real failures. Each rule exists because of a specific past mistake.

1. **Wiki-first, code-second.** Never change code behavior without also updating the relevant `docs/wiki/entities/<slug>.md`. If the spec is wrong, fix the spec first, then the code. The `wiki-drift-check` hook will warn at session end if you only touched code.
2. **Tests before implementation.** Never implement without failing tests first. The Red phase is mandatory — no exceptions.
3. **Never modify tests to pass.** If a test is failing and seems wrong, update the entity page spec first, regenerate the test, then implement. Changing a test to match broken code is not TDD.
4. **Two-strike pivot.** If an approach fails twice on the same mechanism, try a fundamentally different one. Do not retry a third time.
5. **Verify before asserting.** Run it, don't assume it works. Never tell the human a feature works unless tests pass.
6. **Never present uncertain information as fact.** If you're not sure, say so.
7. **Context discipline.** If context exceeds 50%, dump current state to `docs/wiki/session-checkpoint.md` and recommend `/project:fresh`.
8. **Rollback over fix-forward.** If implementation fails twice, `/project:rollback` and retry from scratch.
9. **No silent failures.** If a command fails, report the exact error. Don't move on pretending it succeeded.
10. **Scoped context for sub-agents.** Give sub-agents only the task, prior outputs, and relevant constraints. Never dump full memory.
11. **Write-guard limitation.** Agent write guards only apply when a named agent is invoked via the `Agent` tool. The main Claude Code instance is not role-guarded.
12. **Raw sources are immutable.** Never edit files in `docs/raw/`. Only append new ones.
13. **Reviewer is periodic.** Reviewer runs every ~5 completed TODOs via `/project:review`, not on every work iteration.

14. **Superpowers-first.** Before any implementation, debugging, creative work, or branch completion, check for an applicable superpowers skill and invoke it before acting. Even a 1% chance it applies is enough — see `using-superpowers` skill for the full rule.

## Add your own

<!-- Append new rules here as failures occur. Format: **Rule name:** description. -->
