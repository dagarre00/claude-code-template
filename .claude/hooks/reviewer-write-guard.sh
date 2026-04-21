#!/bin/bash
# .claude/hooks/reviewer-write-guard.sh
# PreToolUse hook: reviewer may only write to docs/wiki/gotchas.md or test files

INPUT=$(cat)

if ! command -v jq &> /dev/null; then
  exit 0
fi

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Allow gotchas
if [[ "$FILE_PATH" == *"docs/wiki/gotchas.md"* ]]; then
  exit 0
fi

# Allow test files (*.test.*, *.spec.*, test_*.*, *_test.*)
if [[ "$FILE_PATH" =~ \.(test|spec)\. ]] || \
   [[ "$(basename "$FILE_PATH")" =~ ^test_ ]] || \
   [[ "$FILE_PATH" =~ _test\.[a-z]+$ ]]; then
  exit 0
fi

echo "Reviewer may only write to docs/wiki/gotchas.md or test files. All other changes go through the work loop." >&2
exit 2
