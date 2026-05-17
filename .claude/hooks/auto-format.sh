#!/usr/bin/env bash
# PostToolUse hook for Write/Edit: format the file in-place by extension if a
# known formatter is on PATH. Best-effort, non-blocking.
set -uo pipefail

root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$root"

# Resolve a Python interpreter once — prefer python3, fall back to python.
py=""
if command -v python3 >/dev/null 2>&1; then
  py=python3
elif command -v python >/dev/null 2>&1; then
  py=python
fi

input=$(cat 2>/dev/null || echo "{}")
file=""
if [ -n "$py" ]; then
  file=$(printf '%s' "$input" | "$py" -c "import sys,json;d=json.load(sys.stdin);print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null || echo "")
else
  # Pure-bash fallback: extract "file_path":"<value>" from JSON.
  file=$(printf '%s' "$input" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' 2>/dev/null | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//;s/"$//' || echo "")
fi
[ -z "$file" ] && exit 0
[ ! -f "$file" ] && exit 0

# Each formatter is wrapped in `timeout 25` so a wedged formatter exits cleanly
# inside the 30s hook timeout configured in .claude/settings.json — this inner
# timeout backstops the outer one and lets the hook still exit 0 below.
format_with() {
  command -v "$1" >/dev/null 2>&1 || return 1
  shift
  timeout 25 "$@" 2>&1 | sed 's/^/  /' >&2 || true
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
