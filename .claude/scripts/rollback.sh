#!/bin/bash
# .claude/scripts/rollback.sh
# Lists checkpoints and rolls back to one. Run this — don't improvise.
# Usage: .claude/scripts/rollback.sh [tag-name]
# Without arguments: lists recent checkpoints
# With argument: rolls back to that tag

set -e

if ! git rev-parse --git-dir &> /dev/null; then
  echo "ERROR: Not a git repository." >&2
  exit 1
fi

if [ -z "$1" ]; then
  # List mode
  echo "=== Recent checkpoints ==="
  TAGS=$(git tag -l 'checkpoint-*' --sort=-creatordate 2>/dev/null | head -10)
  if [ -z "$TAGS" ]; then
    echo "No checkpoints found. Create one with: .claude/scripts/checkpoint.sh"
    exit 0
  fi
  echo "$TAGS" | while read tag; do
    SHA=$(git rev-parse --short "$tag" 2>/dev/null)
    DATE=$(git log -1 --format=%ci "$tag" 2>/dev/null | cut -d' ' -f1,2)
    echo "  ${tag}  →  ${SHA}  (${DATE})"
  done
  echo ""
  echo "To rollback: .claude/scripts/rollback.sh <tag-name>"
  exit 0
fi

TAG="$1"

# Verify tag exists
if ! git rev-parse "$TAG" &> /dev/null; then
  echo "ERROR: Tag '$TAG' not found." >&2
  echo "Available checkpoints:"
  git tag -l 'checkpoint-*' --sort=-creatordate | head -5
  exit 1
fi

CURRENT_SHA=$(git rev-parse --short HEAD)
TARGET_SHA=$(git rev-parse --short "$TAG")

# Warn if there are uncommitted changes
DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
if [ "$DIRTY" != "0" ]; then
  echo "WARNING: You have ${DIRTY} uncommitted change(s). They will be permanently lost by this rollback."
  echo "Stash them first if you want to keep them: git stash"
  echo ""
  echo -n "Continue anyway? (y/N) "
  read -r CONFIRM
  if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "Rollback cancelled."
    exit 0
  fi
fi

echo "Rolling back:"
echo "  From: ${CURRENT_SHA} (current HEAD)"
echo "  To:   ${TARGET_SHA} (${TAG})"
echo ""

# Create a safety tag before rolling back
SAFETY_TAG="pre-rollback-$(date +%Y%m%d-%H%M%S)"
git tag "$SAFETY_TAG" HEAD
echo "✓ Safety tag created: ${SAFETY_TAG} (in case you need to undo this)"

# Do the rollback
git reset --hard "$TAG"

echo "✓ Rolled back to: ${TAG} (${TARGET_SHA})"
echo ""
echo "If you need to undo this rollback: git reset --hard ${SAFETY_TAG}"
