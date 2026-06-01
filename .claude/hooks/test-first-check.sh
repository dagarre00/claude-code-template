#!/usr/bin/env bash
# PreToolUse hook for Write/Edit: on feat/* or fix/* branches, REMIND (never
# block) when production code is edited but no test file appears in this
# session's changes yet. A soft nudge toward test-first — it always exits 0.
#
# CHANNEL: emits hookSpecificOutput.additionalContext on stdout so the nudge
# reaches the MODEL mid-flow (when it can still act), not a transcript the
# agent never reads. It NEVER blocks — no permissionDecision is set, so the
# normal permission flow is untouched. Fires once per session (dedup marker
# cleared by session-start), so it informs without spamming the context.
#
# This used to hard-block on a `red_confirmed` handoff JSON. That was invasive
# (it blocked refactors, spikes, debugging, config fixes) and honor-system
# anyway, so it was downgraded to a warning. Test-first is a discipline the
# author chooses; the tool reminds rather than enforces.
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
  file=$(printf '%s' "$input" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' 2>/dev/null | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//;s/"$//' || echo "")
fi
[ -z "$file" ] && exit 0

# Normalize to a repo-relative path so prefix checks anchor correctly.
rel="$file"
case "$rel" in
  "$root"/*) rel="${rel#"$root"/}" ;;
esac

# Files that never warrant a test-first nudge: tests themselves, docs, config,
# and anything under .claude/ or .github/. Test-file patterns are ANCHORED to
# real naming conventions, not loose substrings (so src/respec.py and
# src/latest_cache.py are treated as production code, not tests).
case "$rel" in
  test_*|*/test_*|*_test.*|*.test.*|*.spec.*|*_spec.*) exit 0 ;;
  tests/*|*/tests/*|test/*|*/test/*|spec/*|*/spec/*|__tests__/*|*/__tests__/*) exit 0 ;;
  docs/*|*/docs/*|*.md|*.json|*.yml|*.yaml|*.txt|*.toml|*.ini|*.cfg|*.lock|*.gitignore) exit 0 ;;
  .claude/*|.github/*|Dockerfile*|Makefile*) exit 0 ;;
esac

# This is a production-code edit. Has any test file been touched this session?
# Scope to the session via the session-start SHA marker (same approach as
# wiki-drift-check); fall back to working tree + index if the marker is missing.
marker=".claude/tmp/session-start-sha"
session_sha=""
[ -f "$marker" ] && session_sha=$(cat "$marker" 2>/dev/null || echo "")
if [ -n "$session_sha" ]; then
  changed=$({ git diff --name-only "$session_sha"..HEAD; git diff --name-only HEAD; git diff --name-only --cached; } 2>/dev/null | sort -u)
else
  changed=$({ git diff --name-only HEAD; git diff --name-only --cached; } 2>/dev/null | sort -u)
fi

has_test=""
while IFS= read -r f; do
  [ -z "$f" ] && continue
  case "$f" in
    test_*|*/test_*|*_test.*|*.test.*|*.spec.*|*_spec.*|tests/*|*/tests/*|test/*|*/test/*|spec/*|*/spec/*|__tests__/*|*/__tests__/*)
      has_test="yes"; break ;;
  esac
done <<< "$changed"

if [ -z "$has_test" ]; then
  # Fire once per session — session-start clears this marker each session.
  warned=".claude/tmp/test-first-warned"
  if [ ! -f "$warned" ]; then
    mkdir -p .claude/tmp
    : > "$warned"
    msg="TDD reminder (test-first-check): editing production code ('$file') on '$branch' with no test in this session's changes yet. Write the failing test first if you haven't — see the tdd-loop skill. Non-blocking; shown once per session."
    # Emit JSON via python if available (robust escaping), else hand-rolled.
    if command -v python3 >/dev/null 2>&1; then
      python3 -c 'import json,sys; print(json.dumps({"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":sys.argv[1]}}))' "$msg"
    elif command -v python >/dev/null 2>&1; then
      python -c 'import json,sys; print(json.dumps({"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":sys.argv[1]}}))' "$msg"
    else
      printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"%s"}}\n' "$msg"
    fi
  fi
fi
exit 0
