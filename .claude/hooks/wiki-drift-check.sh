#!/usr/bin/env bash
# PostToolUse hook (Write|Edit): warn (non-blocking) if source code was touched
# this session but no docs/wiki/ page was touched in the same change set.
#
# WHY PostToolUse (moved off Stop): a Stop hook can only reach the model by
# returning decision:block, which forces another turn and fights this project's
# "warn, never block" rule. PostToolUse can inject context non-blocking via
# hookSpecificOutput.additionalContext on stdout — reaching the agent right
# after the edit, while it can still act in the same change.
#
# CHANNEL: additionalContext on stdout (model-facing). Dedup: once per
# drift-state — the marker clears the moment a wiki page is touched, so a later
# code-without-wiki edit re-warns. session-start also clears it each session.
set -uo pipefail

# Drain stdin: PostToolUse passes tool JSON we don't need here.
cat >/dev/null 2>&1 || true

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
    # log.md / wiki-todos.md are bookkeeping, not substantive spec edits — and
    # session-end.sh (Stop hook) auto-commits log.md, which would otherwise
    # mask every real "code without wiki" drift. Don't let them count.
    docs/wiki/log.md|docs/wiki/wiki-todos.md) : ;;
    docs/wiki/*) wiki_touched=true ;;
    src/*|app/*|lib/*|tests/*|test/*|cmd/*|internal/*|pkg/*) code_touched=true ;;
    *.py|*.js|*.ts|*.jsx|*.tsx|*.go|*.rs|*.java|*.rb|*.php|*.cs|*.kt|*.swift)
      code_touched=true
      ;;
  esac
done <<< "$files"

session_id=$(cat .claude/tmp/session-start-sha 2>/dev/null | head -c 8 || echo "nosession")
drift_marker=".claude/tmp/drift-warned-${session_id}"

# Wiki was touched this session -> drift resolved. Clear the marker so a later
# code-without-wiki edit re-warns, and stay quiet now.
if $wiki_touched; then
  rm -f "$drift_marker" 2>/dev/null || true
  exit 0
fi

if $code_touched; then
  # Warn once per drift-state.
  if [ ! -f "$drift_marker" ]; then
    mkdir -p .claude/tmp
    touch "$drift_marker"
    msg="Wiki-drift reminder (wiki-drift-check): source code changed this session but no docs/wiki/ page has been touched. Per CLAUDE.md rule 4, update the relevant docs/wiki/entities/<slug>.md in the SAME change before committing (file gotchas/ADRs via the recording skills; see the wiki-update skill). Non-blocking; shown once until you touch the wiki."
    if command -v python3 >/dev/null 2>&1; then
      python3 -c 'import json,sys; print(json.dumps({"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":sys.argv[1]}}))' "$msg"
    elif command -v python >/dev/null 2>&1; then
      python -c 'import json,sys; print(json.dumps({"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":sys.argv[1]}}))' "$msg"
    else
      echo "$msg" >&2
    fi
  fi
fi

exit 0
