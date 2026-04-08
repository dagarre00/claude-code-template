#!/bin/bash
# .claude/hooks/researcher-write-guard.sh
# PreToolUse hook: researcher may only write to docs/plans/

INPUT=$(cat)

if ! command -v jq &> /dev/null; then
  exit 0
fi

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

if [[ "$FILE_PATH" == *"docs/plans/"* ]]; then
  exit 0
fi

echo "Researcher agent may only write to docs/plans/" >&2
exit 2
