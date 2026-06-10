#!/usr/bin/env bash
# SessionStart hook: lightweight repo health check.
# Non-blocking — always exits 0.
#
# CHANNEL: actionable warnings (divergence, venv to activate, uncommitted
# changes) go to STDOUT — SessionStart stdout is injected into the model's
# context, so the agent starts the session knowing the git state. This is
# also where the previous session's "you left work uncommitted" surfaces,
# since a Stop hook can't inject context without blocking. Pure noise (the
# repo banner, the once-per-project "not Python" nudge) stays on stderr.
#
# This hook is conservative by design: it warns, never modifies state, with
# two exceptions: it writes .claude/tmp/session-start-sha so wiki-drift-check
# and session-end can scope to this session, and it clears the per-session
# *-warned dedup markers so each in-flow reminder fires once this session
# (even when a session resumes at the same HEAD).
# The Python venv detection block only fires when Python markers are present
# (pyproject.toml / requirements.txt / setup.py). Delete that block if your
# project will never use Python.
set -uo pipefail

root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$root"

echo "[session-start] repo: $root" >&2

# 1. Fetch remote state so divergence numbers are accurate.
#    Quiet + non-blocking: network failures are ignored so the session still starts.
git fetch --quiet origin 2>/dev/null || true

# 2. Inform on divergence from upstream — no automatic pull.
#    (An aggressive `git pull --ff-only` is hostile mid-rebase or in team flows.)
branch=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")
if [ -n "$branch" ]; then
  upstream=$(git rev-parse --abbrev-ref "@{u}" 2>/dev/null || echo "")
  if [ -n "$upstream" ]; then
    ab=$(git rev-list --left-right --count "$upstream...HEAD" 2>/dev/null || echo "")
    if [ -n "$ab" ]; then
      behind=$(echo "$ab" | awk '{print $1}')
      ahead=$(echo "$ab" | awk '{print $2}')
      if [ "${behind:-0}" -gt 0 ] && [ "${ahead:-0}" -gt 0 ]; then
        echo "[session-start] WARNING: $branch has DIVERGED — $ahead ahead, $behind behind $upstream. Rebase or merge required before pushing."
      elif [ "${behind:-0}" -gt 0 ]; then
        echo "[session-start] $branch is $behind commit(s) behind $upstream — run: git pull --ff-only"
      elif [ "${ahead:-0}" -gt 0 ]; then
        echo "[session-start] $branch is $ahead commit(s) ahead of $upstream — push when ready."
      fi
    fi
  fi
fi

# 3. Warn if on a feature/fix branch — the standard starting point is `develop`.
#    This surfaces stale branch state early so the agent doesn't waste turns
#    trying to figure out why `git checkout develop` is needed.
if echo "$branch" | grep -qE '^(feat|fix|chore|docs|refactor|test|perf)/'; then
  echo "[session-start] NOTE: on feature branch '$branch'. If starting fresh work, switch first: git checkout develop"
fi

# 4. Python venv detection — only if this looks like a Python project.
#    Delete this whole block if your project doesn't use Python.
if [ -f "pyproject.toml" ] || [ -f "requirements.txt" ] || [ -f "setup.py" ]; then
  if [ -d ".venv" ]; then
    py=".venv/bin/python"
    [ -f ".venv/Scripts/python.exe" ] && py=".venv/Scripts/python.exe"
    if [ -f "$py" ]; then
      ver=$("$py" --version 2>&1 || echo "?")
      echo "[session-start] python venv at .venv ($ver) — activate with: source .venv/bin/activate"
    fi
  else
    echo "[session-start] python project detected but no .venv — consider creating one"
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

# 5. Uncommitted-changes warning. To stdout (into context) — this is also how
#    the previous session's leftover dirty tree reaches the model, since the
#    Stop-phase session-end hook can only nag on stderr.
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo "[session-start] WARNING: uncommitted changes:"
  git status --short 2>/dev/null | sed 's/^/  /'
fi

# Record HEAD at session start so wiki-drift-check and session-end can scope to this session.
mkdir -p .claude/tmp
git rev-parse HEAD 2>/dev/null > .claude/tmp/session-start-sha || true

# Reset per-session in-flow reminder dedup markers so test-first-check and
# wiki-drift-check each warn once this session. These are keyed off the
# session-start SHA, but a resumed session re-runs this hook at the SAME HEAD,
# so clearing them explicitly is what guarantees a fresh warning each session.
rm -f .claude/tmp/test-first-warned .claude/tmp/drift-warned-* 2>/dev/null || true

# Purge stale session-scoped markers (dirty-warned-*, push-warned-*) older than
# 30 days. Each new session generates a fresh SHA-keyed marker; old ones are
# never matched again but accumulate indefinitely without this cleanup.
find .claude/tmp -maxdepth 1 -name 'dirty-warned-*' -o -name 'push-warned-*' 2>/dev/null \
  | xargs -r find 2>/dev/null -mtime +30 -delete 2>/dev/null || true

exit 0
