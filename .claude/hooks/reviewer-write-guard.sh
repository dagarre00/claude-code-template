#!/bin/bash
# .claude/hooks/reviewer-write-guard.sh
# PreToolUse hook: reviewer may only write to docs/agent-context/gotchas.md

INPUT=$(cat)

if ! command -v jq &> /dev/null; then
  exit 0
fi

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

if [[ "$FILE_PATH" == *"docs/agent-context/gotchas.md"* ]]; then
  exit 0
fi

echo "Reviewer agent is read-only except for gotchas.md" >&2
exit 2
