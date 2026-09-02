---
name: project-wiki-lint
description: Periodic wiki health check. Dispatches the wiki-maintainer to process the wiki-todos.md queue, run the computable reconciliation pass (schema gaps, asymmetric relations, unresolved contradicts), check lint invariants, find orphans, broken [[links]], stale claims, and missing ADRs. Run every few work cycles or when wiki-todos.md is piling up. Trigger on "/project:wiki-lint", "/wiki-lint", "lint wiki", "wiki health check", "reconcile wiki", "clean up wiki-todos".
---

# /project:wiki-lint (Command)

**Argument:** `$ARGUMENTS`

The authoritative procedure for this command is defined in [`.claude/commands/project/wiki-lint.md`](../../../.claude/commands/project/wiki-lint.md).
Follow that document's steps and preconditions verbatim, applying the Antigravity runtime mappings from [`AGENTS.md`](../../../AGENTS.md).

## Summary of Procedure

1. **Sync develop:** Run the canonical guarded sync in [`.claude/skills/feature-branching/sync-develop.md`](../../../.claude/skills/feature-branching/sync-develop.md).
2. **Overflow check:** Check `docs/wiki/log.md` for ≥ 100 entries; instruct maintainer to archive to `docs/wiki/summaries/log-archive-YYYY.md` if needed.
3. **Re-triage filed findings:** Check `todos.md` adversary backlog and re-grade/close resolved items.
4. **Dispatch wiki-maintainer:** Use `invoke_subagent` (TypeName: `self`, Role: `Wiki Maintainer`, Model: `inherit`) following [`.claude/agents/wiki-maintainer.md`](../../../.claude/agents/wiki-maintainer.md) and [`.claude/skills/wiki-update/SKILL.md`](../../../.claude/skills/wiki-update/SKILL.md).
5. **Reconciliation & Lint:** Process queue, ingest stragglers, check computable graph gaps, check lint invariants, and produce batched questions for the human.
6. **Review diff & Commit:** Verify `docs/wiki/` only was touched, commit (`chore(wiki): lint — ...`), and push.
