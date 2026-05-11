#!/usr/bin/env bash
# Stop hook (fires when the assistant goes idle): prompt to commit, append log,
# optionally run test suite on a cooldown.
# Non-blocking — always exits 0.
set -uo pipefail

root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$root"

branch=$(git symbolic-ref --short HEAD 2>/dev/null || echo "(unknown)")

# 1. Prompt to commit if dirty
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo "[session-end] uncommitted changes on $branch:" >&2
  git status --short 2>&1 | head -10 | sed 's/^/  /' >&2
  echo "[session-end] consider committing before the next session." >&2
fi

# 2. Append a lightweight log entry (deduped per minute)
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

# 3. Run test suite — only when on a feat/fix branch and at least 10 min since last run.
case "$branch" in
  feat/*|fix/*)
    test_stamp=".claude/tmp/last-test-run"
    now=$(date +%s)
    last=$(cat "$test_stamp" 2>/dev/null || echo 0)
    if [ $((now - last)) -ge 600 ]; then
      # Parse first command under "## Test" in commands.md
      cmds="docs/wiki/commands.md"
      if [ -f "$cmds" ]; then
        test_cmd=$(awk '/^## Test/{f=1;next} f && /^`/{gsub(/^`|`$/,""); print; exit}' "$cmds")
        if [ -n "$test_cmd" ]; then
          echo "[session-end] running tests: $test_cmd" >&2
          if bash -c "$test_cmd" >&2; then
            echo "[session-end] tests OK" >&2
          else
            echo "[session-end] TESTS FAILED — fix before next session" >&2
          fi
          echo "$now" > "$test_stamp"
        fi
      fi
    fi
    ;;
esac

exit 0
