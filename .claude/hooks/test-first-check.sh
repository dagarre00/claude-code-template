#!/usr/bin/env bash
# PreToolUse hook for Write/Edit: on feat/* or fix/* branches, block code edits
# unless a red_confirmed handoff exists for the branch's slug.
# Exits 0 = allow; exits 2 = block with stderr message shown to the assistant.
set -uo pipefail

root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$root"

branch=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")
case "$branch" in
  feat/*|fix/*) ;;
  *) exit 0 ;;
esac

# Extract file_path from stdin JSON. Try python, fall back to grep+sed.
input=$(cat 2>/dev/null || echo "{}")
file=""
if command -v python >/dev/null 2>&1; then
  file=$(printf '%s' "$input" | python -c "import sys,json;d=json.load(sys.stdin);print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null || echo "")
else
  # Pure-bash fallback: extract "file_path":"<value>" from JSON.
  file=$(printf '%s' "$input" | grep -o '"file_path"\s*:\s*"[^"]*"' 2>/dev/null | head -1 | sed 's/.*"file_path"\s*:\s*"//;s/"$//' || echo "")
fi
[ -z "$file" ] && exit 0

# Allow non-code files, docs, configs, tests
case "$file" in
  */test*|*test_*|*_test*|*spec*|*tests/*|*__tests__/*) exit 0 ;;
  */docs/*|*.md|*.json|*.yml|*.yaml|*.txt|*.toml|*.ini|*.cfg|*.lock|*.gitignore|*.env|*.example) exit 0 ;;
  *.claude/*|*.github/*|*Dockerfile*|*Makefile*) exit 0 ;;
esac

# Derive slug from branch name
slug="${branch#feat/}"
slug="${slug#fix/}"

handoff=".claude/handoff/${slug}.json"
if [ -f "$handoff" ]; then
  confirmed="no"
  if command -v python >/dev/null 2>&1; then
    confirmed=$(python -c "import json,sys;
try:
  d=json.load(open('$handoff'))
  print('yes' if d.get('red_confirmed') is True else 'no')
except Exception:
  print('no')
" 2>/dev/null || echo "no")
  else
    # Pure-bash fallback: grep for red_confirmed in the JSON file.
    if grep -q '"red_confirmed"\s*:\s*true' "$handoff" 2>/dev/null; then
      confirmed="yes"
    fi
  fi
  if [ "$confirmed" = "yes" ]; then
    exit 0
  fi
fi

cat >&2 <<EOF
[test-first-check] BLOCKED: editing code file '$file' on branch '$branch' without a confirmed RED phase.

Expected: .claude/handoff/${slug}.json with red_confirmed=true.

How to proceed:
  1. Run /work — it dispatches the tester to write failing tests first.
  2. Once the tester emits the handoff with red_confirmed=true, this edit will be allowed.

If you genuinely need to edit non-test code without tests (rare — e.g. config-only fix),
switch to a non-feat/fix branch (e.g. chore/<slug>) where this hook does not enforce.
EOF
exit 2
