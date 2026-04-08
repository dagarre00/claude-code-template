#!/bin/bash
# .claude/scripts/status.sh
# Gathers project status from deterministic sources. Run this — don't improvise.
# Usage: .claude/scripts/status.sh

echo "=== PROJECT STATUS ==="
echo ""

# Git info
if git rev-parse --git-dir &> /dev/null; then
  BRANCH=$(git branch --show-current 2>/dev/null || echo "detached")
  SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "none")
  DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  echo "Branch: ${BRANCH} @ ${SHA} (${DIRTY} uncommitted changes)"
else
  echo "Git: not initialized"
fi
echo ""

# Project state
STATE_FILE="docs/project-state.md"
if [ -f "$STATE_FILE" ]; then
  echo "=== PROJECT STATE ==="
  cat "$STATE_FILE"
else
  echo "Project state: not found (run /project:init)"
fi
echo ""

# Active TODOs
TODOS_FILE="docs/agent-context/active-todos.md"
if [ -f "$TODOS_FILE" ]; then
  echo "=== ACTIVE TODOS ==="
  cat "$TODOS_FILE"
fi
echo ""

# Recent changelog
CHANGELOG="docs/changelog.md"
if [ -f "$CHANGELOG" ]; then
  echo "=== LAST 10 CHANGELOG ENTRIES ==="
  tail -12 "$CHANGELOG"
fi
echo ""

# Recent checkpoints
TAGS=$(git tag -l 'checkpoint-*' --sort=-creatordate 2>/dev/null | head -3)
if [ -n "$TAGS" ]; then
  echo "=== RECENT CHECKPOINTS ==="
  echo "$TAGS"
fi
