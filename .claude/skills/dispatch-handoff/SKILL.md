---
name: dispatch-handoff
description: Conductor-only. How to hand one role's dispatch to the human as a file they run in another harness (a fresh Claude Code session, Antigravity/agy, or another CLI) and verify the returned result through the same checks as a native dispatch.
user-invocable: false
---

# Dispatch Handoff

Hands a role's dispatch to the human as a file to run in an external harness when dispatch mode is `handoff` (`subagent-dispatch § Dispatch mode`). The brief, checkout, baseline check, and Red/Green proof are identical to a native dispatch.

## Read first

- `.claude/agents/<role>.md` — extract `model`, `effort`, `tools`, and `skills:`.
- [`handoff-template.md`](handoff-template.md) — template for `.handoff/<slug>-<role>-handoff.md`.

## Steps

1. **Baseline:** Require a clean tree and record `git rev-parse HEAD` and `git status --porcelain`. No other writer touches the checkout until the handoff returns.
2. **Paths:** `<slug>` is the entity slug or command name (`review`, `wiki`). Write `.handoff/<slug>-<role>-handoff.md` and expect `.handoff/<slug>-<role>-report.md` (delete any pre-existing report file first).
3. **Fill [`handoff-template.md`](handoff-template.md):**
   - **Brief:** the exact four-line `Task / Inputs / Scope / Return` block (rule 10: no conductor reasoning, files passed by path).
   - **Reading list:** `.claude/rules/behavioral.md`, `.claude/rules/workflow.md`, `subagent-contract`, `.claude/agents/<role>.md`, and each skill in the role's `skills:` list in order.
   - **Limits & model:** the role's `tools`, access mode (read-only vs write), `model`, and `effort` (note: Antigravity `--effort` caps at `high`).
4. **Hand over:** Tell the human the handoff file path and launch commands, and wait for `"done"` (with the harness/model used) or a pasted report. Make no edits while waiting.
5. **Take back:** Read `.handoff/<slug>-<role>-report.md` (or the pasted message). If missing or partial, ask the human to continue the external session once (partial again → `human-checkpoint`). Then run `subagent-dispatch § Wait, then check what it touched` step 2 (and `§ Prove and commit a developer case` for `developer`).
6. **Send back:** Give the human the deciding output tail to paste into the same external session (or write a fresh handoff file with `"these files are the previous attempt"` if starting a new session).
7. **Record harness:** For reviewer roles, record the external harness and model per `finding-disposition § Record the yield`.
8. **Clean up:** Delete both `.handoff/<slug>-<role>-*.md` files once accepted or discarded so later reviewers cannot read them.

## Anti-patterns

- **Leaking conductor reasoning** into the handoff file.
- **Skipping the baseline diff check** (external harnesses do not enforce `.claude/agents/` tool restrictions).
- **Running a reviewer in a session that already saw the author's context.**
- **Leaving stale `.handoff/` report files on disk.**
