#!/usr/bin/env bash
# PostToolUse hook for Write/Edit: format the file in-place by extension if a
# known formatter is on PATH. Best-effort, non-blocking.
set -uo pipefail

root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$root"

input=$(cat 2>/dev/null || echo "{}")
file=$(printf '%s' "$input" | python -c "import sys,json;d=json.load(sys.stdin);print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null || echo "")
[ -z "$file" ] && exit 0
[ ! -f "$file" ] && exit 0

format_with() {
  command -v "$1" >/dev/null 2>&1 || return 1
  shift
  "$@" 2>&1 | sed 's/^/  /' >&2 || true
  return 0
}

case "$file" in
  *.py)
    format_with ruff       ruff format "$file" \
      || format_with black black -q "$file"
    ;;
  *.js|*.jsx|*.ts|*.tsx|*.json|*.md|*.yml|*.yaml|*.css|*.html|*.scss)
    format_with prettier prettier --write --log-level=warn "$file"
    ;;
  *.go)
    format_with gofmt gofmt -w "$file"
    ;;
  *.rs)
    format_with rustfmt rustfmt "$file"
    ;;
  *.sh)
    format_with shfmt shfmt -w "$file"
    ;;
esac

exit 0
