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

# TODO queue
TODOS="docs/wiki/todos.md"
if [ -f "$TODOS" ]; then
  echo "=== TODOS (docs/wiki/todos.md) ==="
  cat "$TODOS"
else
  echo "TODOs: docs/wiki/todos.md not found (run /project:interview first)"
fi
echo ""

# Recent wiki log entries
WIKI_LOG="docs/wiki/log.md"
if [ -f "$WIKI_LOG" ]; then
  echo "=== LAST 5 WIKI LOG ENTRIES ==="
  grep "^## \[" "$WIKI_LOG" 2>/dev/null | tail -5
fi
echo ""

# Pending raw sources
RAW_INDEX="docs/raw/index.md"
if [ -f "$RAW_INDEX" ]; then
  PENDING=$(grep -c "| pending |" "$RAW_INDEX" 2>/dev/null || echo "0")
  echo "=== RAW SOURCES ==="
  echo "Pending ingestion: ${PENDING}"
fi
echo ""

# Recent changelog (session-level)
CHANGELOG="docs/changelog.md"
if [ -f "$CHANGELOG" ]; then
  echo "=== LAST 10 CHANGELOG ROWS ==="
  tail -12 "$CHANGELOG"
fi
echo ""

# Recent checkpoints
TAGS=$(git tag -l 'checkpoint-*' --sort=-creatordate 2>/dev/null | head -3)
if [ -n "$TAGS" ]; then
  echo "=== RECENT CHECKPOINTS ==="
  echo "$TAGS"
fi
