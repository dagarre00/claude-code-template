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

# 2. Append a lightweight log entry — but only when NEW commits have landed
#    since the last entry. This Stop hook fires on every assistant idle (it is
#    not a true "session end"), so the dedup must be SHA-based, not time-based:
#    keying on "new commits since the last entry we wrote" means a quiet idle
#    never produces a duplicate, and the log-commit below (which advances HEAD)
#    is recorded as the new baseline so it can't re-count itself as new work.
log="docs/wiki/log.md"
marker=".claude/tmp/session-start-sha"
last_log_file=".claude/tmp/last-log-sha"
mkdir -p "$(dirname "$last_log_file")"

session_sha=""
[ -f "$marker" ] && session_sha=$(cat "$marker" 2>/dev/null || echo "")
head_sha=$(git rev-parse HEAD 2>/dev/null || echo "")

# Baseline for "what's new": HEAD recorded just after the last entry we wrote.
# Fall back to the session-start SHA if we haven't logged yet this container.
last_logged=$(cat "$last_log_file" 2>/dev/null || echo "")
[ -z "$last_logged" ] && last_logged="$session_sha"

# Count commits since that baseline (0 if none, or if the SHA is unknown/gone).
new_commits=0
if [ -n "$last_logged" ] && [ "$last_logged" != "$head_sha" ]; then
  new_commits=$(git rev-list --count "$last_logged..HEAD" 2>/dev/null || echo 0)
fi

# Log only when durable work (a commit) has landed since the last entry.
# Purely-uncommitted state is already surfaced by the warning in step 1, so it
# does not trigger a log entry (that path used to spam on every idle while dirty).
if [ "${new_commits:-0}" -gt 0 ] && [ -f "$log" ]; then
  # Skip logging until /project:init has run (it writes the first "init" entry).
  if ! grep -q '^\#\# \[.*\] init' "$log" 2>/dev/null; then
    exit 0
  fi

  stamp=$(date -u +"%Y-%m-%d %H:%M")

  # Uncommitted-file count (informational; 0 when clean).
  uncommitted=0
  if [ -n "$dirty" ]; then
    uncommitted=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  fi

  {
    printf '\n## [%s] session-end\n' "$stamp"
    printf -- '- Branch: %s\n' "$branch"
    printf -- '- New commits since last log: %s\n' "$new_commits"
    if [ "${uncommitted:-0}" -gt 0 ]; then
      printf -- '- Uncommitted files: %s\n' "$uncommitted"
    fi
  } >> "$log"

  # Auto-commit the log entry, then record the resulting HEAD as the new
  # baseline so this very commit isn't counted as "new work" on the next idle.
  git commit --only -m "chore(log): session-end $stamp" -- "$log" 2>&1 | head -3 | sed 's/^/  /' >&2 || true
  git rev-parse HEAD 2>/dev/null > "$last_log_file" || true
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
