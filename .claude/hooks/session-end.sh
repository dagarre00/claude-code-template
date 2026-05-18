#!/usr/bin/env bash
# Stop hook (fires when the assistant goes idle): prompt to commit, append log.
# Non-blocking — always exits 0.
#
# Test execution is intentionally NOT done here. Tests run during the
# implementation TDD loop (via the tester/implementer agents); running them
# again at session close is redundant and can hang the close for minutes
# on large suites. See docs/wiki/architecture.md#testing-strategy.
set -uo pipefail

root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$root"

branch=$(git symbolic-ref --short HEAD 2>/dev/null || echo "(unknown)")

# 1. Prompt to commit if dirty.
dirty=""
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  dirty="yes"
  echo "[session-end] uncommitted changes on $branch:" >&2
  git status --short 2>&1 | head -10 | sed 's/^/  /' >&2
  echo "[session-end] consider committing before the next session." >&2
fi

# 2. Append a lightweight log entry — but only when work actually happened.
#    A session where HEAD didn't move and the tree is clean produces no entry,
#    so docs/wiki/log.md doesn't fill with empty stamps.
log="docs/wiki/log.md"
marker=".claude/tmp/session-start-sha"
stamp_file=".claude/tmp/last-log-stamp"
mkdir -p "$(dirname "$stamp_file")"
now_min=$(date -u +"%Y%m%d%H%M")
last_min=$(cat "$stamp_file" 2>/dev/null || echo "")

session_sha=""
[ -f "$marker" ] && session_sha=$(cat "$marker" 2>/dev/null || echo "")
head_sha=$(git rev-parse HEAD 2>/dev/null || echo "")

# Skip when: marker present, HEAD unchanged since session start, and tree is clean.
work_happened="yes"
if [ -n "$session_sha" ] && [ "$session_sha" = "$head_sha" ] && [ -z "$dirty" ]; then
  work_happened="no"
fi

# Per-minute dedup as a safety net against rapid re-fires.
if [ "$work_happened" = "yes" ] && [ -f "$log" ] && [ "$now_min" != "$last_min" ]; then
  # Skip logging until /project:init has run (it writes the first "init" entry).
  if ! grep -q '^\#\# \[.*\] init' "$log" 2>/dev/null; then
    exit 0
  fi

  stamp=$(date -u +"%Y-%m-%d %H:%M")

  # Count commits since session start (0 if no marker or same SHA).
  commits=0
  if [ -n "$session_sha" ] && [ "$session_sha" != "$head_sha" ]; then
    commits=$(git rev-list --count "$session_sha..HEAD" 2>/dev/null || echo 0)
  fi

  # Uncommitted-file count (0 when clean).
  uncommitted=0
  if [ -n "$dirty" ]; then
    uncommitted=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  fi

  {
    printf '\n## [%s] session-end\n' "$stamp"
    printf -- '- Branch: %s\n' "$branch"
    printf -- '- Commits this session: %s\n' "$commits"
    if [ "${uncommitted:-0}" -gt 0 ]; then
      printf -- '- Uncommitted files: %s\n' "$uncommitted"
    fi
  } >> "$log"
  echo "$now_min" > "$stamp_file"

  # Auto-commit the log entry so the session record doesn't sit in a dirty tree.
  git commit --only -m "chore(log): session-end $stamp" -- "$log" 2>&1 | head -3 | sed 's/^/  /' >&2 || true
fi

# 3. Remind to push if on a feature branch and ahead of remote.
if [ "$branch" != "main" ] && [ "$branch" != "master" ] && [ "$branch" != "(unknown)" ] && [ -n "$branch" ]; then
  upstream=$(git rev-parse --abbrev-ref "@{u}" 2>/dev/null || echo "")
  if [ -z "$upstream" ]; then
    echo "[session-end] '$branch' has no remote upstream — push when ready: git push -u origin $branch" >&2
  else
    ahead=$(git rev-list --count "${upstream}..HEAD" 2>/dev/null || echo 0)
    if [ "${ahead:-0}" -gt 0 ]; then
      echo "[session-end] '$branch' is ${ahead} commit(s) ahead of $upstream — push when the feature is ready." >&2
    fi
  fi
fi

exit 0
