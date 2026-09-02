---
name: project-adversary
description: Point a read-only second model at the current change. Dispatches the adversary agent (fresh context) over the diff, collects numbered findings in a mailbox file, triages each one, and re-reviews once. Diff-scoped and per-change — unlike project-review, which is periodic and whole-repo. Trigger on "/project:adversary", "/adversary", "run adversary", "audit current diff", "adversarial review", "second model diff check".
---

# /project:adversary (Command)

**Argument:** `$ARGUMENTS`

The authoritative procedure for this command is defined in [`.claude/commands/project/adversary.md`](../../../.claude/commands/project/adversary.md).
Follow that document's steps and preconditions verbatim, applying the Antigravity runtime mappings from [`AGENTS.md`](../../../AGENTS.md).

## Summary of Procedure

1. **Scope diff:** Resolve base ref or dirty tree. Keep scope small.
2. **Dispatch adversary:** Use `invoke_subagent` (TypeName: `self`, Role: `Adversary`, Model: `inherit`, read-only) following [`.claude/agents/adversary.md`](../../../.claude/agents/adversary.md) and [`.claude/skills/adversarial-review/SKILL.md`](../../../.claude/skills/adversarial-review/SKILL.md). Pass only diff scope, case IDs, mailbox `.claude/handoff/<slug>-findings.md`, and test command.
3. **Triage findings:** Default is Filed as todo. For `critical`/`major`, prompt human via `ask_question` / checkpoint for fix-now approval.
4. **Re-dispatch once if fixes landed:** Re-review fix commits only. Two rounds maximum.
5. **Log & Commit:** Log round counts to `docs/wiki/log.md`, commit round dispositions, and push. Clean up scratch mailbox.
