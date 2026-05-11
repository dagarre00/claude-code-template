#!/usr/bin/env bash
# SessionStart hook: git pull, venv check, uncommitted warning.
# Intentionally non-blocking — always exits 0.
set -uo pipefail

root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$root"

echo "[session-start] repo: $root" >&2

# 1. Git pull --ff-only if branch has an upstream
branch=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")
if [ -n "$branch" ]; then
  upstream=$(git rev-parse --abbrev-ref "@{u}" 2>/dev/null || echo "")
  if [ -n "$upstream" ]; then
    echo "[session-start] git pull --ff-only ($branch <- $upstream)" >&2
    if ! git pull --ff-only 2>&1 | sed 's/^/  /' >&2; then
      echo "  (pull non-fast-forward or failed — check manually)" >&2
    fi
  else
    echo "[session-start] branch $branch has no upstream — skipping pull" >&2
  fi
fi

# 2. Python venv detection
if [ -d ".venv" ]; then
  py=".venv/bin/python"
  [ -f ".venv/Scripts/python.exe" ] && py=".venv/Scripts/python.exe"
  if [ -f "$py" ]; then
    ver=$("$py" --version 2>&1 || echo "?")
    echo "[session-start] python venv at .venv ($ver) — activate with: source .venv/bin/activate (or .venv\\Scripts\\activate on Windows)" >&2
  fi
elif [ -f "pyproject.toml" ] || [ -f "requirements.txt" ]; then
  echo "[session-start] python project detected but no .venv — consider creating one" >&2
fi

# 3. Uncommitted-changes warning
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo "[session-start] WARNING: uncommitted changes:" >&2
  git status --short 2>&1 | sed 's/^/  /' >&2
fi

exit 0
