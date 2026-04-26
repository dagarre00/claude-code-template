---
name: behavioral
description: Hard behavioral constraints. Each rule exists because of a specific past failure.
type: rule
paths: ["**"]
---

# Behavioral Rules

Hard constraints from real failures. Each rule exists because a past mistake made it necessary. These override default agent inclinations; harness hooks back several of them.

1. **Wiki-first, code-second.** Never change code behavior without also updating the relevant `docs/wiki/entities/<slug>.md`. If the spec is wrong, fix the spec first, then the code. The `wiki-drift-check` hook warns at session end if you only touched code.

2. **Tests before implementation.** Never implement without failing tests first. The Red phase is mandatory — no exceptions. The `test-first-check.sh` hook blocks code edits without a matching test on `feat/*` and `fix/*` branches.

3. **Never modify tests to make them pass.** If a test is failing and seems wrong, update the entity page spec first, regenerate the test, then implement. Changing a test to match broken code is not TDD.

4. **Tests must fail for the right reason.** A passing test before implementation tests existing behavior, not the new feature. Delete or fix any test that goes green prematurely.

5. **Two-strike pivot.** If an approach fails twice on the same mechanism, try a fundamentally different one. Do not retry a third time. Two failed implementations → `/project:rollback`.

6. **Verify before asserting.** Run it, don't assume. Never tell the human a feature works unless tests pass and you've read the output yourself. Use `superpowers:verification-before-completion`.

7. **Never present uncertain information as fact.** If you're not sure, say so.

8. **Context discipline.** If context exceeds 50%, dump current state to `docs/wiki/session-checkpoint.md` (via `/project:checkpoint`) and recommend `/project:fresh`. Don't trust `/compact`.

9. **No silent failures.** If a command fails, report the exact error. Don't move on pretending it succeeded.

10. **Scoped context for sub-agents.** Give sub-agents only the task, prior outputs, and relevant constraints. Never dump full memory.

11. **Raw sources are immutable.** Never edit files in `docs/raw/`. Only append new ones.

12. **Reviewer is periodic.** Reviewer runs every ~5 completed TODOs via `/project:review`, not on every work iteration. Reviewer must be on a `review/YYYY-MM-DD` branch before writing anything.

13. **Superpowers-first.** Before any implementation, debugging, creative work, or branch completion, check for an applicable superpowers skill and invoke it before acting. See the `using-superpowers` skill for the full rule.

14. **Honor the `red_confirmed` handoff.** Implementer agent must refuse to start if `.claude/handoff/<slug>.json` is missing or `red_confirmed` is not `true`. The Red phase has not been validated otherwise.

15. **Memory protocol.** Load `docs/wiki/todos.md` and `docs/wiki/gotchas.md` at the start of every task. Load `docs/wiki/requirements.md`, `docs/wiki/architecture.md`, and `docs/wiki/entities/<slug>.md` only when the task requires them. After significant work, write discoveries directly to the relevant wiki page — no separate memory snapshot.

16. **Use the existing workflow before improvising.** Slash commands and the agent routing table exist for a reason. If a workflow seems missing, propose adding one rather than working around the gap.

17. **Bootstrap on first run.** The first successful `/project:interview` or `/project:init` on a fresh clone MUST also specialize the template files (CLAUDE.md, HUMAN.md, SETUP.md, agent prompts, skills) to the actual project — see the `## Template → Project bootstrap` section of CLAUDE.md. The template files lie until this is done; don't skip it.

## Add your own

When a new failure pattern emerges that's broader than a single gotcha (i.e. it's a discipline issue, not a project quirk), append it here as a numbered rule. Project-specific failure points go in `docs/wiki/gotchas.md` instead.
