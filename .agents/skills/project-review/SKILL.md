---
name: project-review
description: Thorough review of the codebase against the wiki. Runs the reviewer agent in a fresh session context with no developer baggage. Flags critical issues, warnings, drift, missing tests, security/perf concerns. Use periodically (~every 5 todos), never inside project-work. Trigger on "/project:review", "/review", "periodic review", "audit codebase against wiki", "check for drift".
---

# /project:review (Command)

**Argument:** `$ARGUMENTS`

The authoritative procedure for this command is defined in [`.claude/commands/project/review.md`](../../../.claude/commands/project/review.md).
Follow that document's steps and preconditions verbatim, applying the Antigravity runtime mappings from [`AGENTS.md`](../../../AGENTS.md).

## Summary of Procedure

1. **Sync develop:** Run the canonical guarded sync in [`.claude/skills/feature-branching/sync-develop.md`](../../../.claude/skills/feature-branching/sync-develop.md).
2. **Dispatch reviewer:** Use `invoke_subagent` (TypeName: `self`, Role: `Reviewer`, Model: `inherit`) following [`.claude/agents/reviewer.md`](../../../.claude/agents/reviewer.md).
3. **Reviewer outputs report:** Writes `docs/wiki/decisions/review-YYYY-MM-DD.md`.
4. **Process findings:** Distribute Critical/Warning items to `docs/wiki/todos.md` and Drift items to `docs/wiki/wiki-todos.md`.
5. **Log & Commit:** Append to `docs/wiki/log.md`, commit (`docs(review): audit YYYY-MM-DD`), and push.
