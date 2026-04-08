#!/bin/bash
# .claude/hooks/on-task-complete.sh
# Stop hook: appends a session summary row to docs/changelog.md
# Checks stop_hook_active to avoid infinite loops

INPUT=$(cat)

if ! command -v jq &> /dev/null; then
  exit 0
fi

# Prevent infinite loop
STOP_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')
if [ "$STOP_ACTIVE" = "true" ]; then
  exit 0
fi

CHANGELOG="docs/changelog.md"
if [ ! -f "$CHANGELOG" ]; then
  exit 0
fi

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"' | cut -c1-8)

# Gather git context
BRANCH=$(git branch --show-current 2>/dev/null || echo "—")
COMMITS=$(git log --oneline -1 2>/dev/null | cut -c1-7 || echo "—")
DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')

echo "| ${TIMESTAMP} | ${SESSION_ID} | \`${BRANCH}\` | ${COMMITS} | ${DIRTY} | — |" >> "$CHANGELOG"

exit 0
