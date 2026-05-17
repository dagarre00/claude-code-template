---
name: status
description: Show current project state — branch, top todos, recent log, recent checkpoints, uncommitted summary. Read-only. Use at session start, after a long break, or before deciding what to do next.
type: command
---

# /project:status

You print a one-screen status report. Read-only — never modifies anything.

## Steps

1. **Branch + HEAD:**
   ```bash
   git branch --show-current
   git log -1 --oneline
   ```

2. **Uncommitted summary:**
   ```bash
   git status --short
   ```
   Print counts (e.g. "3 modified, 1 untracked"), not the full list unless < 10 items.

3. **Recent commits (last 5):**
   ```bash
   git log -5 --oneline
   ```

4. **Top todos.** Read first 5 unticked items from `docs/wiki/todos.md`.

5. **Recent log entries.** Last 3 from `docs/wiki/log.md`.

6. **Recent checkpoints:**
   ```bash
   git tag --list 'checkpoint-*' --sort=-creatordate | head -3
   ```

7. **Pending wiki-todos.** Count of unticked lines in `docs/wiki/wiki-todos.md`. If > 10, suggest `/project:wiki-lint`.

8. **Print compactly** — one section per topic, two lines max. Format example:
   ```
   ## Status (YYYY-MM-DD HH:MM)
   Branch: feat/auth-login @ a1b2c3d
   Uncommitted: 2 modified, 0 untracked
   Recent: a1b2c3d feat(auth): add password hashing
           b4e5f6g test(auth): add hashing red tests
   Top todos:
     1. auth-login: add rate limiting on failed attempts
     2. auth-login: persist sessions in Redis
     3. profile: PATCH endpoint for display name
   Last log: 2026-05-11 13:42 work — auth-login
   Checkpoints: checkpoint-20260511T130001Z (latest)
   Wiki-todos pending: 4
   ```

9. **Suggest next action** based on state:
   - Dirty tree → suggest commit.
   - On main with todos → suggest `/project:work`.
   - Many wiki-todos → suggest `/project:wiki-lint`.
   - Many `feat/*` branches stale → suggest cleanup.

## What you do NOT do

- **No edits.** Read-only command.
- **No long output.** One screen is the budget.
- **No skipping sections.** Even if empty, print "(none)" — absence is information.
