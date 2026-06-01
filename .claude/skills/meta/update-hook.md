---
name: update-hook
description: How to add, modify, or retire a Claude Code hook (settings.json hook entry + script). Use when adding automated session/tool behavior, fixing a hook that drifted, or removing one. Trigger on "hook", "settings.json hook", "session start", "session end", "pre tool use", "post tool use".
type: skill
---

# Updating a Hook

Hooks are how the harness enforces invariants the agent can't be trusted to remember (test-first, format-on-save, session-start git pull). They live in two places: the script (`.claude/hooks/*.sh`) and the registration (`.claude/settings.json`).

## When a hook is the right answer

Use a hook when:
- The behavior must run **every time** a trigger fires, regardless of which agent is active.
- The behavior must run **even if the agent forgets** (TDD enforcement, formatting).
- It's safe to run unattended (no human decision needed).

Use a skill or command instead when:
- The behavior needs judgement (decide which test command to run, choose a refactor strategy).
- The behavior should be opt-in.

## Procedure — adding a hook

1. **Pick the phase** from Claude Code's hook lifecycle:
   - `SessionStart` — once at session start.
   - `Stop` — once at session end (assistant idle).
   - `PreToolUse` / `PostToolUse` — wraps each tool call; can be filtered by tool name and matcher.
   - `UserPromptSubmit` — fires when the user submits a message; can inject context.

2. **Write the script** at `.claude/hooks/<name>.sh`:
   - Shebang `#!/usr/bin/env bash`.
   - `set -euo pipefail` for strict mode unless you have a reason not to.
   - Read JSON input from stdin if the hook receives any (PreToolUse, PostToolUse, etc.).
   - Print human-readable status to stderr; the user sees it.
   - Exit 0 to allow / continue, non-zero to block (only PreToolUse can block).
   - On Windows, assume Git Bash; avoid GNU-only flags. Use `command -v` to feature-detect tools (`jq`, `python`, etc.).
   - `chmod +x` after writing.

3. **Register in `.claude/settings.json`** under the matching event:
   ```json
   {
     "hooks": {
       "PreToolUse": [
         {
           "matcher": "Write|Edit",
           "hooks": [
             {
               "type": "command",
               "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/<name>.sh"
             }
           ]
         }
       ]
     }
   }
   ```
   Always use `$CLAUDE_PROJECT_DIR/.claude/hooks/<name>.sh` — not a relative path. Hooks may fire from a working directory that is not the project root (CI, worktrees, sub-agents), so relative paths silently fail to find the script.
   Use `"matcher"` to narrow to relevant tools; an empty matcher fires on everything.

4. **Test the hook.**
   - Run it directly with a sample stdin: `echo '{}' | bash .claude/hooks/<name>.sh; echo "exit=$?"`.
   - Then verify in a real Claude Code session that the hook fires and behaves as expected.
   - For `PreToolUse` blockers, confirm the block message is clear and actionable.

5. **Update `CLAUDE.md`** — add a row to the "Hooks" table.

6. **Commit** with `feat: add <name> hook — <reason>`.

## Procedure — modifying a hook

1. Read the script and the settings.json entry together.
2. If you change what the hook blocks or warns about, make the message reflect the new behavior. Stale block messages are the #1 hook footgun.
3. Re-test directly with a sample stdin payload.
4. Commit with `refactor: <name> hook — <reason>`.

## Procedure — retiring a hook

1. Remove the entry from `settings.json`.
2. Delete the script.
3. Remove the CLAUDE.md row.
4. Append to `docs/wiki/log.md`.
5. Commit `chore: retire <name> hook`.

## Cross-platform notes

- The dev environment is Windows + Git Bash, sometimes WSL, sometimes Mac. Stick to POSIX. No `realpath`/`readlink -f`, no `mapfile`, no `&>>`.
- Use `python -c '...'` for JSON parsing if `jq` isn't installable in all dev environments — but document the dependency in `docs/wiki/gotchas.md`.
- Always chmod +x the script after writing. Windows preserves the bit through git.

## Anti-patterns

- **Hooks that prompt the user.** Hooks can't be interactive. If you need a decision, print a clear suggestion and exit 0 (or block with a message telling the user what to run next).
- **Hooks that mutate code.** PostToolUse formatters are OK; anything more invasive belongs in a skill.
- **Hooks that swallow errors silently.** Always echo to stderr what the hook found, even on success.
- **Hooks without a clear failure message.** A blocked PreToolUse without a "here's what to do" message frustrates the user.
