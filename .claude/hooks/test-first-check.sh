#!/bin/bash
# PreToolUse(Write|Edit) -- TEST-FIRST REMINDER (non-blocking).
# On feat/* and fix/* branches, nudge when production code is edited
# but no test file has changed in this session yet.
#
# CHANNEL: emits hookSpecificOutput.additionalContext JSON on stdout so the
# nudge reaches the MODEL mid-flow (when it can still act), not a transcript
# the agent never reads. NEVER blocks: no permissionDecision is set, so the
# normal permission flow is untouched. Fires once per session (dedup marker),
# so it informs without spamming the context window.
set -u

# Read hook input JSON from stdin
INPUT="$(cat)"

# Only care on feat/* and fix/* branches
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
case "$BRANCH" in
  feat/*|fix/*) ;;
  *) exit 0 ;;
esac

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
MARKER="$ROOT/.claude/tmp/test-first-warned"
# Already nudged this session -> stay quiet (session-start clears the marker)
[ -f "$MARKER" ] && exit 0

# Extract the file path being written/edited from the tool input
FILE="$(printf '%s' "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*:[[:space:]]*"//;s/"$//')"
[ -z "$FILE" ] && exit 0

# Only nudge for production source files
case "$FILE" in
  *.test.*|*.spec.*|*_test.*|*test_*|*/tests/*|*/test/*|*/__tests__/*) exit 0 ;;
esac
case "$FILE" in
  *.py|*.js|*.ts|*.jsx|*.tsx|*.go|*.rs|*.java|*.rb|*.php|*.c|*.cpp|*.h|*.hpp) ;;
  *) exit 0 ;;
esac

# Has any test file changed in this session (working tree + staged)?
SHA_FILE="$ROOT/.claude/tmp/session-start-sha"
TEST_CHANGED=""
if [ -f "$SHA_FILE" ]; then
  START_SHA="$(cat "$SHA_FILE" 2>/dev/null)"
  CHANGED="$(git diff --name-only "$START_SHA" 2>/dev/null; git diff --cached --name-only 2>/dev/null; git diff --name-only 2>/dev/null)"
else
  CHANGED="$(git diff --cached --name-only 2>/dev/null; git diff --name-only 2>/dev/null)"
fi

if printf '%s' "$CHANGED" | grep -Eq '(\.test\.|\.spec\.|_test\.|test_|/tests/|/test/|/__tests__/)'; then
  TEST_CHANGED="yes"
fi

if [ -z "$TEST_CHANGED" ]; then
  mkdir -p "$(dirname "$MARKER")" 2>/dev/null
  : > "$MARKER"
  MSG="TDD reminder (test-first-check): you are editing production code on '$BRANCH' with no test file changed this session. Write a failing test first (see .claude/skills/tdd-loop). Non-blocking; shown once per session."
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"%s"}}\n' "$MSG"
fi

exit 0
