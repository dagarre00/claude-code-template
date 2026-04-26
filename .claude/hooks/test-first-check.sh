#!/bin/bash
# .claude/hooks/test-first-check.sh
# PreToolUse hook: enforces TDD by requiring a corresponding test file when
# implementation code is created or modified.
#
# Behavior:
#   - On `feat/*` or `fix/*` branches → BLOCKING (exit 2). No code without a test.
#   - On any other branch (main, review/*, chore/*, etc.) → WARN ONLY (exit 0).
#   - Test files, fixtures, and non-source files are always allowed.
#   - The reviewer agent's `review/*` branches are exempt — they fix tests.
#
# A "test exists" if any of the following match the source file's slug or directory:
#   - foo.test.ts, foo.spec.ts, foo.test.tsx, foo.spec.tsx
#   - test_foo.py, foo_test.go, foo_test.rs
#   - tests/<...>/foo.* or __tests__/<...>/foo.*
#
# This hook implements CLAUDE.md Golden Rule #2 ("tests before code") at the
# harness level — agent honor-system is no longer the only line of defense.

INPUT=$(cat)

if ! command -v jq &> /dev/null; then
  exit 0
fi

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Resolve to repo-relative path.
if git rev-parse --git-dir &> /dev/null 2>&1; then
  REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
  REL_PATH="${FILE_PATH#${REPO_ROOT}/}"
else
  exit 0
fi

# Only act on source code files.
CODE_REGEX='^(src/|app/|lib/|pkg/|cmd/|internal/|server/|client/|web/|api/|packages/|apps/)'
if ! echo "$REL_PATH" | grep -qE "$CODE_REGEX"; then
  exit 0
fi

# Allow test files, fixtures, type-only files, and config.
BASENAME=$(basename "$REL_PATH")
case "$BASENAME" in
  *.test.*|*.spec.*|test_*|*_test.*) exit 0 ;;
  *.d.ts|*.types.ts|index.ts|index.js) exit 0 ;;
  __init__.py|conftest.py) exit 0 ;;
esac
case "$REL_PATH" in
  */tests/*|*/__tests__/*|*/fixtures/*|*/mocks/*|*/__mocks__/*) exit 0 ;;
esac

# Determine slug (filename without extension) and search for any matching test.
SLUG="${BASENAME%.*}"
DIR=$(dirname "$REL_PATH")

# Look for a test file anywhere in the repo whose name references this slug.
TEST_FOUND=$(find "$REPO_ROOT" \
  \( -name '*.test.*' -o -name '*.spec.*' -o -name 'test_*' -o -name '*_test.*' \) \
  -type f 2>/dev/null \
  | grep -E "(/|^)(${SLUG}\.(test|spec)\.|test_${SLUG}\.|${SLUG}_test\.)" \
  | head -1)

if [ -n "$TEST_FOUND" ]; then
  exit 0
fi

# Also accept a test file in a sibling tests/ directory matching the slug.
for candidate in \
  "${DIR}/tests/${SLUG}.test."* \
  "${DIR}/__tests__/${SLUG}."* \
  "tests/${SLUG}_test."* \
  "tests/test_${SLUG}."*; do
  if compgen -G "$candidate" > /dev/null 2>&1; then
    exit 0
  fi
done

# No matching test file. Decide severity by branch.
BRANCH=$(git branch --show-current 2>/dev/null || echo "")

case "$BRANCH" in
  feat/*|fix/*)
    {
      echo ""
      echo "✗ TDD VIOLATION — no test file found for: $REL_PATH"
      echo ""
      echo "  Branch: $BRANCH (TDD-enforced)"
      echo "  Rule:   no production code without a failing test first."
      echo ""
      echo "  Expected one of:"
      echo "    • ${DIR}/${SLUG}.test.<ext>"
      echo "    • ${DIR}/${SLUG}.spec.<ext>"
      echo "    • tests/test_${SLUG}.<ext>"
      echo "    • tests/${SLUG}_test.<ext>"
      echo ""
      echo "  Write the failing test first, run it (confirm RED), then implement."
      echo "  See: docs/wiki/entities/<slug>.md \`## Behavior\` for the test contract."
      echo ""
    } >&2
    exit 2
    ;;
  review/*|main|master|"")
    exit 0
    ;;
  *)
    {
      echo ""
      echo "⚠ TDD WARNING — no test file found for: $REL_PATH"
      echo "  Consider writing the test before continuing."
      echo "  (Blocking is enabled on feat/* and fix/* branches.)"
      echo ""
    } >&2
    exit 0
    ;;
esac
