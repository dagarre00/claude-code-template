#!/bin/bash
# .claude/hooks/raw-pending-check.sh
# Stop hook: if docs/raw/index.md has any `pending` rows at session end, remind the
# agent to run /wiki:ingest (to process them) and /wiki:lint (to verify integrity).
#
# Non-blocking (exit 0). Mirrors wiki-drift-check.sh style.

INPUT=$(cat)

if ! command -v jq &> /dev/null; then
  exit 0
fi

STOP_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')
if [ "$STOP_ACTIVE" = "true" ]; then
  exit 0
fi

INDEX="docs/raw/index.md"
if [ ! -f "$INDEX" ]; then
  exit 0
fi

# Match table rows whose Status column is `pending`.
# grep -c exits 1 when there are 0 matches (still prints "0") — use || true so
# the subshell exit code doesn't trigger set -e and so we don't double-echo "0".
PENDING_COUNT=$(grep -c '| pending |' "$INDEX" 2>/dev/null || true)
PENDING_COUNT="${PENDING_COUNT:-0}"

if [ "$PENDING_COUNT" -eq 0 ] 2>/dev/null; then
  exit 0
fi

# Show up to 5 pending filenames for context.
PENDING_LIST=$(grep '| pending |' "$INDEX" | sed -n 's/^| \[`\([^`]*\)`\].*/  • \1/p' | head -5)

{
  echo ""
  echo "⚠ RAW SOURCES PENDING"
  echo "$PENDING_COUNT source(s) in docs/raw/ have not been ingested:"
  echo "$PENDING_LIST"
  if [ "$PENDING_COUNT" -gt 5 ]; then
    echo "  • ... and $((PENDING_COUNT - 5)) more"
  fi
  echo ""
  echo "Before ending the session:"
  echo "  • Run /wiki:ingest   — process pending sources into the wiki"
  echo "  • Run /wiki:lint     — verify cross-links and flag contradictions"
  echo ""
} >&2

exit 0
