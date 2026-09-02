---
name: project-interview
description: Grill-me-relentlessly Q&A to define a plan, a feature, or fill requirements. Walks down each branch of the decision tree, resolving dependencies one at a time. Always provides a recommended answer. Streams a transcript to docs/raw/interviews/ Q-by-Q and A-by-A (never batched at the end), then updates affected wiki pages. Trigger on "/project:interview", "/interview", "interview me", "grill me", "define requirements", "plan a new feature".
---

# /project:interview (Command)

**Argument:** `$ARGUMENTS`

The authoritative procedure for this command is defined in [`.claude/commands/project/interview.md`](../../../.claude/commands/project/interview.md).
Follow that document's steps and preconditions verbatim, applying the Antigravity runtime mappings from [`AGENTS.md`](../../../AGENTS.md).

## Summary of Procedure

1. **Sync develop:** Run the canonical guarded sync in [`.claude/skills/feature-branching/sync-develop.md`](../../../.claude/skills/feature-branching/sync-develop.md).
2. **Frame scope:** Infer topic from `$ARGUMENTS` or `docs/wiki/todos.md` / `requirements.md`. Derive transcript slug (e.g. `YYYY-MM-DD-<slug>.md`).
3. **Open transcript before asking:** Create `docs/raw/interviews/YYYY-MM-DD-<slug>.md` with `type: raw-transcript`.
4. **Append-only Q&A loop:**
   - Write question to transcript disk first with recommended answer.
   - Ask human using `ask_question` tool (for discrete choices) or visible chat text.
   - Append answer verbatim to transcript on disk immediately upon receipt.
   - Process answer and unblock next branch.
5. **Ingest transcript to wiki:** Update `requirements.md`, entity pages, architecture, and ADRs via [`.claude/skills/decision-recording/SKILL.md`](../../../.claude/skills/decision-recording/SKILL.md) and [`.claude/skills/wiki-update/SKILL.md`](../../../.claude/skills/wiki-update/SKILL.md).
6. **Log & Commit:** Append to `docs/wiki/log.md`, commit (`docs(wiki): interview — <slug>`), and push to active branch/develop.
