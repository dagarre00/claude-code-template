---
name: behavioral
description: Hard behavioral constraints. Each rule exists because of a specific past failure.
type: rule
paths: ["**"]
---

# Behavioral Rules

Hard constraints from real failures. Each rule exists because of a specific past mistake.

1. **Wiki-first, code-second.** Never change code behavior without also updating the relevant `docs/wiki/entities/<slug>.md`. If the spec is wrong, fix the spec first, then the code. The `wiki-drift-check` hook will warn at session end if you only touched code.
2. **Two-strike pivot.** If an approach fails twice on the same mechanism, try a fundamentally different one. Do not retry a third time.
3. **Verify before asserting.** Run it, don't assume it works. Never tell the human a feature works unless you've tested it.
4. **Never present uncertain information as fact.** If you're not sure, say so.
5. **Context discipline.** If context exceeds 50%, dump current state to `docs/wiki/session-checkpoint.md` and recommend `/project:fresh`.
6. **Rollback over fix-forward.** If an implementation attempt fails review, `/project:rollback` and retry from scratch. Fresh attempts succeed more often than patching a degraded attempt.
7. **No silent failures.** If a command fails, report the exact error. Don't move on pretending it succeeded.
8. **Scoped context for sub-agents.** Give sub-agents only the task, prior outputs, and relevant constraints. Never dump full memory.
9. **Write-guard limitation.** Agent write guards only apply when a named agent is invoked via the `Agent` tool. The main Claude Code instance is not role-guarded.
10. **Raw sources are immutable.** Never edit files in `docs/raw/`. Only append new ones.

## Add your own

<!-- Append new rules here as failures occur. Format: **Rule name:** description. -->
