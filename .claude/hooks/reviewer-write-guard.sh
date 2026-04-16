#!/bin/bash
# .claude/hooks/reviewer-write-guard.sh
# PreToolUse hook: reviewer may only write to docs/wiki/gotchas.md

INPUT=$(cat)

if ! command -v jq &> /dev/null; then
  exit 0
fi

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

if [[ "$FILE_PATH" == *"docs/wiki/gotchas.md"* ]]; then
  exit 0
fi

echo "Reviewer agent is read-only except for docs/wiki/gotchas.md" >&2
exit 2
