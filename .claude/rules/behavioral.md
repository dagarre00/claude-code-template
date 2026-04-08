---
paths: ["**"]
---
# Behavioral Rules

Hard constraints from real failures. Each rule exists because of a specific past mistake.

1. **Two-strike pivot:** If an approach fails twice on the same mechanism, try a fundamentally different one. Do not retry the same thing a third time.
2. **Verify before asserting:** Run it, don't assume it works. Never tell the human a feature works unless you've tested it.
3. **Never present uncertain information as fact.** If you're not sure, say so explicitly.
4. **Context discipline:** If context exceeds 50%, dump current state to `docs/agent-context/session-checkpoint.md` and recommend starting a fresh session with `/project:fresh`.
5. **Rollback over fix-forward:** If an implementation attempt fails review, git rollback and retry from scratch. Fresh attempts succeed more often than patching a degraded attempt.
6. **No silent failures:** If a command fails, report the exact error. Don't move on pretending it succeeded.
7. **Scoped context for sub-agents:** When dispatching sub-agents, give them ONLY the task, prior outputs, and relevant constraints. Never dump full memory.

8. **Write-guard limitation:** Agent write guards only apply when a named agent is invoked via the `Agent` tool. The main Claude Code instance is not role-guarded. Don't treat write guards as security enforcement — they're a safety reminder for agent workflows.

## Add your own
<!-- Append new rules here as failures occur. Format: **Rule name:** description. -->
