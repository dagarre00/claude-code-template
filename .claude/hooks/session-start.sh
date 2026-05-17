#!/usr/bin/env bash
# SessionStart hook: lightweight repo health check.
# Non-blocking — always exits 0.
#
# This hook is conservative by design: it warns, never modifies state
# (with one exception: it writes .claude/tmp/session-start-sha so that
# wiki-drift-check and session-end can scope their work to this session).
# The Python venv detection block only fires when Python markers are present
# (pyproject.toml / requirements.txt / setup.py). Delete that block if your
# project will never use Python.
set -uo pipefail

root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$root"

echo "[session-start] repo: $root" >&2

# 1. Inform on divergence from upstream — no automatic pull.
#    (An aggressive `git pull --ff-only` is hostile mid-rebase or in team flows.)
branch=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")
if [ -n "$branch" ]; then
  upstream=$(git rev-parse --abbrev-ref "@{u}" 2>/dev/null || echo "")
  if [ -n "$upstream" ]; then
    ab=$(git rev-list --left-right --count "$upstream...HEAD" 2>/dev/null || echo "")
    if [ -n "$ab" ]; then
      behind=$(echo "$ab" | awk '{print $1}')
      ahead=$(echo "$ab" | awk '{print $2}')
      if [ "${behind:-0}" -gt 0 ] || [ "${ahead:-0}" -gt 0 ]; then
        echo "[session-start] $branch: $ahead ahead, $behind behind $upstream (run 'git pull' manually if appropriate)" >&2
      fi
    fi
  fi
fi

# 2. Python venv detection — only if this looks like a Python project.
#    Delete this whole block if your project doesn't use Python.
if [ -f "pyproject.toml" ] || [ -f "requirements.txt" ] || [ -f "setup.py" ]; then
  if [ -d ".venv" ]; then
    py=".venv/bin/python"
    [ -f ".venv/Scripts/python.exe" ] && py=".venv/Scripts/python.exe"
    if [ -f "$py" ]; then
      ver=$("$py" --version 2>&1 || echo "?")
      echo "[session-start] python venv at .venv ($ver) — activate with: source .venv/bin/activate" >&2
    fi
  else
    echo "[session-start] python project detected but no .venv — consider creating one" >&2
  fi
else
  # Nudge only once per project — drop a marker so this doesn't repeat every session.
  stamp=".claude/tmp/venv-nudge-shown"
  if [ ! -f "$stamp" ]; then
    mkdir -p "$(dirname "$stamp")"
    echo "[session-start] no Python markers detected — if this project isn't Python, delete the venv block in .claude/hooks/session-start.sh" >&2
    touch "$stamp"
  fi
fi

# 3. Uncommitted-changes warning.
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo "[session-start] WARNING: uncommitted changes:" >&2
  git status --short 2>&1 | sed 's/^/  /' >&2
fi

# Record HEAD at session start so wiki-drift-check and session-end can scope to this session.
mkdir -p .claude/tmp
git rev-parse HEAD 2>/dev/null > .claude/tmp/session-start-sha || true

exit 0
