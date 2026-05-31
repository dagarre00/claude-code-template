#!/bin/bash
# PostToolUse(Write|Edit) -- WIKI DRIFT WARNING (non-blocking).
# If source code has changed this session but no docs/wiki/ page has been
# touched, remind that the wiki may be drifting from the code.
#
# WHY PostToolUse (moved off Stop): a Stop hook can only reach the model by
# returning decision:block, which forces another turn and fights this
# project's "warn, never block" rule. PostToolUse can inject context
# non-blocking via hookSpecificOutput.additionalContext, reaching the agent
# right after the edit -- while it can still act -- instead of a Stop-time
# stderr line nobody reads.
#
# Dedup: warns once per drift-state. The marker is cleared as soon as a wiki
# page is touched, so a later code-without-wiki edit re-warns. Low pollution,
# still honest. Scoped to the session via the session-start SHA marker.
set -u

# Drain stdin (PostToolUse passes tool JSON we don't need here)
cat >/dev/null 2>&1

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
[ -z "$ROOT" ] && exit 0
SHA_FILE="$ROOT/.claude/tmp/session-start-sha"
MARKER="$ROOT/.claude/tmp/wiki-drift-warned"

# Determine changed files since session start (committed + staged + unstaged)
if [ -f "$SHA_FILE" ]; then
  START_SHA="$(cat "$SHA_FILE" 2>/dev/null)"
  CHANGED="$(git diff --name-only "$START_SHA" 2>/dev/null; git diff --cached --name-only 2>/dev/null; git diff --name-only 2>/dev/null)"
else
  CHANGED="$(git diff --cached --name-only 2>/dev/null; git diff --name-only 2>/dev/null)"
fi

[ -z "$CHANGED" ] && exit 0

# Did any source code change?
CODE_CHANGED=""
if printf '%s' "$CHANGED" | grep -Eq '\.(py|js|ts|jsx|tsx|go|rs|java|rb|php|c|cpp|h|hpp)$'; then
  CODE_CHANGED="yes"
fi

# Did any wiki page change?
WIKI_CHANGED=""
if printf '%s' "$CHANGED" | grep -q 'docs/wiki/'; then
  WIKI_CHANGED="yes"
fi

# Wiki touched -> drift resolved; clear the marker so a future drift re-warns
if [ -n "$WIKI_CHANGED" ]; then
  rm -f "$MARKER" 2>/dev/null
  exit 0
fi

if [ -n "$CODE_CHANGED" ]; then
  # Already warned for this drift-state -> stay quiet
  [ -f "$MARKER" ] && exit 0
  mkdir -p "$(dirname "$MARKER")" 2>/dev/null
  : > "$MARKER"
  MSG="Wiki-drift reminder (wiki-drift-check): source code changed this session but no docs/wiki/ page has been touched. Per CLAUDE.md rule 4, update the relevant docs/wiki/entities/<slug>.md in the same change before committing. Non-blocking; shown once until you touch the wiki."
  printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"%s"}}\n' "$MSG"
fi

exit 0
