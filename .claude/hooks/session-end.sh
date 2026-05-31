#!/bin/bash
# Stop hook -- session wind-down.
# - Remind to commit if the working tree is dirty
# - Append a session entry to docs/wiki/log.md (only if new commits landed)
#
# CHANNEL NOTE: a Stop hook cannot inject into the model's context without
# returning decision:block, which forces another turn and fights the project's
# "warn, never block" rule. So the dirty-tree reminder stays on stderr (a human
# FYI only); the MODEL-facing delivery of "you left work uncommitted" happens at
# the NEXT SessionStart, which prints it to stdout (into context). The real
# safety net against lost work is the command-level commit+push step
# (/project:work) and behavioral rule 19, not this hook.
#
# Order matters: check the dirty tree BEFORE appending the log line, otherwise
# the append itself would make the tree look dirty every time.
set -u

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
[ -z "$ROOT" ] && exit 0

# --- Dirty working tree reminder (stderr / human FYI; model gets it next SessionStart) ---
if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
  echo ">>> [session-end] Working tree is dirty -- commit + push before the container recycles." >&2
fi

# --- Append session log entry (only when new commits landed since last entry) ---
LOG="$ROOT/docs/wiki/log.md"
if [ -f "$LOG" ]; then
  LAST_SHA_IN_LOG="$(grep -oE '[0-9a-f]{7,40}' "$LOG" | tail -1)"
  HEAD_SHA="$(git rev-parse --short HEAD 2>/dev/null)"
  # Count commits since the last logged SHA
  if [ -n "$LAST_SHA_IN_LOG" ] && git cat-file -e "$LAST_SHA_IN_LOG" 2>/dev/null; then
    NEW_COMMITS="$(git rev-list --count "${LAST_SHA_IN_LOG}..HEAD" 2>/dev/null)"
  else
    NEW_COMMITS="unknown"
  fi

  if [ "$NEW_COMMITS" != "0" ]; then
    DATE="$(date +%Y-%m-%d)"
    HEAD_LINE="- $DATE — session ended at \`$HEAD_SHA\` ($NEW_COMMITS new commit(s) since last log)."
    printf '%s\n' "$HEAD_LINE" >> "$LOG"
  fi
fi

exit 0
