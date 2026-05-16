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
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo "[session-end] uncommitted changes on $branch:" >&2
  git status --short 2>&1 | head -10 | sed 's/^/  /' >&2
  echo "[session-end] consider committing before the next session." >&2
fi

# 2. Append a lightweight log entry (deduped per minute).
log="docs/wiki/log.md"
stamp_file=".claude/tmp/last-log-stamp"
mkdir -p "$(dirname "$stamp_file")"
now_min=$(date -u +"%Y%m%d%H%M")
last_min=$(cat "$stamp_file" 2>/dev/null || echo "")
if [ -f "$log" ] && [ "$now_min" != "$last_min" ]; then
  stamp=$(date -u +"%Y-%m-%d %H:%M")
  printf '\n## [%s] session-end\n- Branch: %s\n' "$stamp" "$branch" >> "$log"
  echo "$now_min" > "$stamp_file"
fi

exit 0
