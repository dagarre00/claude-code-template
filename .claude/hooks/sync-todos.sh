#!/bin/bash
# .claude/hooks/sync-todos.sh
# PostToolUse hook: auto-syncs active-todos.md whenever project-state.md is modified
# Matcher: Write|Edit (with path check inside)

INPUT=$(cat)

if ! command -v jq &> /dev/null; then
  exit 0
fi

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only fire when project-state.md is written
if [[ "$FILE_PATH" != *"project-state.md"* ]]; then
  exit 0
fi

STATE_FILE="docs/project-state.md"
TODOS_FILE="docs/agent-context/active-todos.md"

if [ ! -f "$STATE_FILE" ]; then
  exit 0
fi

mkdir -p "$(dirname "$TODOS_FILE")"

cat > "$TODOS_FILE" << HEADER
---
title: Active TODOs
updated: $(date +%Y-%m-%d)
tokens_estimate: 50
agents: [orchestrator, implementer, researcher]
---
# Active TODOs

> Auto-synced from [[project-state]] by sync-todos hook.

HEADER

# Extract from "## Active TODOs" to next "##" heading
awk '/^## Active TODOs/,/^## [^A]/' "$STATE_FILE" | head -n -1 | tail -n +2 >> "$TODOS_FILE"

exit 0
