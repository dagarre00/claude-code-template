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

# Resolve a Python interpreter once — prefer python3, fall back to python.
py=""
if command -v python3 >/dev/null 2>&1; then
  py=python3
elif command -v python >/dev/null 2>&1; then
  py=python
fi

# Extract file_path from stdin JSON. Try python, fall back to grep+sed.
input=$(cat 2>/dev/null || echo "{}")
file=""
if [ -n "$py" ]; then
  file=$(printf '%s' "$input" | "$py" -c "import sys,json;d=json.load(sys.stdin);print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null || echo "")
else
  # Pure-bash fallback: extract "file_path":"<value>" from JSON.
  # Use [[:space:]] instead of \s for BSD-grep portability.
  file=$(printf '%s' "$input" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' 2>/dev/null | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//;s/"$//' || echo "")
fi
[ -z "$file" ] && exit 0

# Normalize $file to a repo-relative path so we can anchor prefix checks below.
# Without this, an absolute path like /repo/.claude/foo or a path like
# my.claude/foo.py would slip through a glob like *.claude/*.
rel="$file"
case "$rel" in
  "$root"/*) rel="${rel#"$root"/}" ;;
esac

# Allow non-code files, docs, configs, tests.
# Note: *.env and *.example are intentionally NOT allowed — secrets risk.
case "$rel" in
  */test*|*test_*|*_test*|*spec*|tests/*|*/tests/*|__tests__/*|*/__tests__/*) exit 0 ;;
  docs/*|*/docs/*|*.md|*.json|*.yml|*.yaml|*.txt|*.toml|*.ini|*.cfg|*.lock|*.gitignore) exit 0 ;;
esac

# Anchored prefix checks — .claude/* must literally start the relative path.
case "$rel" in
  .claude/*|.github/*|Dockerfile*|Makefile*) exit 0 ;;
esac

# Derive slug from branch name
slug="${branch#feat/}"
slug="${slug#fix/}"

handoff=".claude/handoff/${slug}.json"
if [ -f "$handoff" ]; then
  confirmed="no"
  if [ -n "$py" ]; then
    # Pass handoff path via env var to avoid quote-injection in the embedded python.
    confirmed=$(handoff="$handoff" "$py" -c 'import os,json
try:
  d=json.load(open(os.environ["handoff"]))
  print("yes" if d.get("red_confirmed") is True else "no")
except Exception:
  print("no")
' 2>/dev/null || echo "no")
  else
    # Pure-bash fallback: grep for red_confirmed in the JSON file.
    if grep -q '"red_confirmed"[[:space:]]*:[[:space:]]*true' "$handoff" 2>/dev/null; then
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
  1. Run /project:work — it dispatches the tester to write failing tests first.
  2. Once the tester emits the handoff with red_confirmed=true, this edit will be allowed.

If you genuinely need to edit non-test code without tests (rare — e.g. config-only fix),
switch to a non-feat/fix branch (e.g. chore/<slug>) where this hook does not enforce.
EOF
exit 2
