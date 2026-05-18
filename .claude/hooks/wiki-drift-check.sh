#!/usr/bin/env bash
# Stop hook: warn (non-blocking) if code was touched this session but no
# docs/wiki/ page was touched in the same change set.
set -uo pipefail

root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$root"

# Scope the diff to the CURRENT session via the marker written by session-start.sh.
# Long-lived branches would otherwise false-positive forever when comparing to main.
# If the marker is missing (hook ran out of order, or first run after this change),
# fall back to uncommitted + staged only — never diff against the default branch.
marker=".claude/tmp/session-start-sha"
session_sha=""
[ -f "$marker" ] && session_sha=$(cat "$marker" 2>/dev/null || echo "")

if [ -n "$session_sha" ]; then
  files=$(
    {
      git diff --name-only "$session_sha"..HEAD 2>/dev/null
      git diff --name-only HEAD 2>/dev/null
      git diff --name-only --cached 2>/dev/null
    } | sort -u | grep -v '^$' || true
  )
else
  # No session marker — include the last commit as a proxy for session work,
  # since committed-but-not-pushed changes would be invisible otherwise.
  files=$(
    {
      git diff --name-only HEAD~1..HEAD 2>/dev/null
      git diff --name-only HEAD 2>/dev/null
      git diff --name-only --cached 2>/dev/null
    } | sort -u | grep -v '^$' || true
  )
fi

[ -z "$files" ] && exit 0

code_touched=false
wiki_touched=false
while IFS= read -r f; do
  case "$f" in
    docs/wiki/*) wiki_touched=true ;;
    src/*|app/*|lib/*|tests/*|test/*|cmd/*|internal/*|pkg/*) code_touched=true ;;
    *.py|*.js|*.ts|*.jsx|*.tsx|*.go|*.rs|*.java|*.rb|*.php|*.cs|*.kt|*.swift)
      code_touched=true
      ;;
  esac
done <<< "$files"

if $code_touched && ! $wiki_touched; then
  cat >&2 <<EOF
[wiki-drift-check] WARNING: code modified this session, but no docs/wiki/ page touched.

The wiki must travel with the code. Before ending the session:
  - Update the relevant docs/wiki/entities/<slug>.md (Behavior + Implementation).
  - If a pattern emerged, file via the gotcha-recording or decision-recording skill.
  - See the wiki-update skill for link format and frontmatter.
EOF
fi

exit 0
