---
name: project-work
description: Pick the top todo (or batch consecutive todos sharing context), open a feat/* branch from develop, dispatch the planner for complex/batched work, then the developer through red→green→refactor→wiki-update, then commit, push, and (if the entity is fully done) open a PR to develop and return to develop. The core development loop. Trigger on "/project:work", "/work", "work on todo", "start development", "implement entity".
---

# /project:work (Command)

**Argument:** `$ARGUMENTS`

The authoritative procedure for this command is defined in [`.claude/commands/project/work.md`](../../../.claude/commands/project/work.md).
Follow that document's steps and preconditions verbatim, applying the Antigravity runtime mappings from [`AGENTS.md`](../../../AGENTS.md).

## Summary of Procedure

1. **Pick the work:** Fetch `origin/develop` and read `docs/wiki/todos.md`. Pick the top todo or the item specified in `$ARGUMENTS`.
2. **Fetch and branch:** Follow [`.claude/skills/feature-branching/SKILL.md`](../../../.claude/skills/feature-branching/SKILL.md) to branch `feat/<slug>` from `develop`.
3. **Verify Behavior cases:** Check `docs/wiki/entities/<slug>.md` (or concept page for `[infra]`). If missing, follow [`.claude/skills/spec-writing/SKILL.md`](../../../.claude/skills/spec-writing/SKILL.md).
4. **Plan if complex or batched:** For `[complex]` or 2+ batched todos, dispatch `planner` via `invoke_subagent` (TypeName: `self`, Role: `Planner`, Model: `inherit`) following [`.claude/agents/planner.md`](../../../.claude/agents/planner.md) and [`.claude/skills/plan-writing/SKILL.md`](../../../.claude/skills/plan-writing/SKILL.md). Plan output: `.claude/handoff/<slug>-plan.md`.
5. **Execute TDD Loop:** Run the loop once per Behavior case following [`.claude/agents/developer.md`](../../../.claude/agents/developer.md) and [`.claude/skills/tdd-loop/SKILL.md`](../../../.claude/skills/tdd-loop/SKILL.md):
   - Red (failing test, right reason) → Green (minimal code) → Refactor → Commit per case (`feat(<slug>): ...`) → Push.
   - For pauses or conflicts, see [`.claude/skills/human-checkpoint/SKILL.md`](../../../.claude/skills/human-checkpoint/SKILL.md) (using `ask_question`) and [`.claude/skills/git-recovery/SKILL.md`](../../../.claude/skills/git-recovery/SKILL.md).
6. **Verify Red, Green, and granularity:** Ensure full test suite is green and commits are granular.
7. **Wiki updates:** Tick Behavior cases (`[~]` → `[x]`), update implementation/test lists, remove completed todo.
8. **Adversarial review (complex/batched):** Dispatch `adversary` via `invoke_subagent` (TypeName: `self`, Role: `Adversary`, Model: `inherit`; prompt enforces read-only) following [`.claude/agents/adversary.md`](../../../.claude/agents/adversary.md) and [`.claude/skills/adversarial-review/SKILL.md`](../../../.claude/skills/adversarial-review/SKILL.md). Triage mailbox `.claude/handoff/<slug>-findings.md` and commit dispositions.
9. **Log cycle:** Append to `docs/wiki/log.md`, commit (`docs(<slug>): log cycle`), and push.
10. **Auto-PR when feature complete:** If all entity Behavior cases are `[x]`, follow [`.claude/skills/pr-create/SKILL.md`](../../../.claude/skills/pr-create/SKILL.md) to open PR to `develop`, log PR, and checkout `develop`.
11. **Report & Cadence check:** Report results to human and check review/lint cadences.
