#!/bin/bash
# .claude/hooks/auto-checkpoint.sh
# Stop hook: auto-creates a git checkpoint when a session ends
# Ensures you always have a rollback point — no LLM discipline required

INPUT=$(cat)

if ! command -v jq &> /dev/null; then
  exit 0
fi

# Prevent infinite loop
STOP_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')
if [ "$STOP_ACTIVE" = "true" ]; then
  exit 0
fi

# Only checkpoint if we're in a git repo with commits
if ! git rev-parse --git-dir &> /dev/null; then
  exit 0
fi
if ! git rev-parse HEAD &> /dev/null 2>&1; then
  exit 0
fi

# Only checkpoint if there are changes since the last checkpoint
LAST_CHECKPOINT=$(git tag -l 'checkpoint-*' --sort=-creatordate 2>/dev/null | head -1)
if [ -n "$LAST_CHECKPOINT" ]; then
  CHANGES=$(git log "${LAST_CHECKPOINT}..HEAD" --oneline 2>/dev/null | wc -l | tr -d ' ')
  DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  if [ "$CHANGES" = "0" ] && [ "$DIRTY" = "0" ]; then
    # Nothing changed since last checkpoint — skip
    exit 0
  fi
fi

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
TAG_NAME="checkpoint-${TIMESTAMP}-auto"
git tag "$TAG_NAME" HEAD 2>/dev/null || true

exit 0
