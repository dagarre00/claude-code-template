#!/bin/bash
# .claude/hooks/interviewer-write-guard.sh
# PreToolUse hook: interviewer may only write to docs/project-requirements.md

INPUT=$(cat)

if ! command -v jq &> /dev/null; then
  exit 0
fi

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

if [[ "$FILE_PATH" == *"docs/project-requirements.md"* ]]; then
  exit 0
fi

echo "Interviewer agent may only write to docs/project-requirements.md" >&2
exit 2
