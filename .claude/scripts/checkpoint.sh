#!/bin/bash
# .claude/scripts/checkpoint.sh
# Creates a deterministic git checkpoint. Run this — don't improvise.
# Usage: .claude/scripts/checkpoint.sh [optional-label]

set -e

if ! git rev-parse --git-dir &> /dev/null; then
  echo "ERROR: Not a git repository." >&2
  exit 1
fi

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LABEL="${1:-manual}"
TAG_NAME="checkpoint-${TIMESTAMP}-${LABEL}"
CURRENT_SHA=$(git rev-parse --short HEAD)
BRANCH=$(git branch --show-current 2>/dev/null || echo "detached")

# Create the tag
git tag "$TAG_NAME" HEAD

# Write session checkpoint file
CHECKPOINT_FILE="docs/wiki/session-checkpoint.md"
mkdir -p "$(dirname "$CHECKPOINT_FILE")"

cat > "$CHECKPOINT_FILE" << CKEOF
---
title: Session Checkpoint
created: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
tag: ${TAG_NAME}
branch: ${BRANCH}
sha: ${CURRENT_SHA}
---

# Session Checkpoint

- **Tag:** \`${TAG_NAME}\`
- **Branch:** \`${BRANCH}\`
- **SHA:** \`${CURRENT_SHA}\`
- **Created:** $(date -u +"%Y-%m-%dT%H:%M:%SZ")

## Recent commits
$(git log --oneline -10 2>/dev/null || echo "No commits yet")

## Modified files (uncommitted)
$(git diff --name-only 2>/dev/null || echo "None")

## Staged files
$(git diff --cached --name-only 2>/dev/null || echo "None")

## What was done
<!-- Agent: fill this in after running the script -->

## What's in progress
<!-- Agent: fill this in after running the script -->

## What's next
<!-- Agent: fill this in after running the script -->
CKEOF

echo "✓ Checkpoint created: ${TAG_NAME}"
echo "✓ Session state written to: ${CHECKPOINT_FILE}"
echo "✓ Branch: ${BRANCH} @ ${CURRENT_SHA}"
