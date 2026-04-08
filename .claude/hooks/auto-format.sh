#!/bin/bash
# .claude/hooks/auto-format.sh
# PostToolUse hook: auto-formats files after Write/Edit based on extension
# Exits 0 silently if no formatter is found

INPUT=$(cat)

if ! command -v jq &> /dev/null; then
  exit 0
fi

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

EXT="${FILE_PATH##*.}"

case "$EXT" in
  py)
    if command -v ruff &> /dev/null; then
      ruff format "$FILE_PATH" 2>/dev/null
    elif command -v black &> /dev/null; then
      black --quiet "$FILE_PATH" 2>/dev/null
    fi
    ;;
  js|ts|jsx|tsx|css|html|json)
    if command -v prettier &> /dev/null; then
      prettier --write "$FILE_PATH" 2>/dev/null
    fi
    ;;
  go)
    if command -v gofmt &> /dev/null; then
      gofmt -w "$FILE_PATH" 2>/dev/null
    fi
    ;;
  rs)
    if command -v rustfmt &> /dev/null; then
      rustfmt "$FILE_PATH" 2>/dev/null
    fi
    ;;
esac

exit 0
