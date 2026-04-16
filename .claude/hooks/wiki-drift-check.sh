#!/bin/bash
# .claude/hooks/wiki-drift-check.sh
# Stop hook: warns if code files under src/ (or equivalent) were touched this session
# but no wiki entity/decision/requirements/completed page was updated.
#
# This is the enforcement layer for CLAUDE.md Golden Rule #2 ("Always update the
# wiki in the same change"). It does not block — it emits a visible reminder so
# the main agent sees it and can follow up before the session ends.

INPUT=$(cat)

if ! command -v jq &> /dev/null; then
  exit 0
fi

STOP_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')
if [ "$STOP_ACTIVE" = "true" ]; then
  exit 0
fi

if ! git rev-parse --git-dir &> /dev/null; then
  exit 0
fi

# Look at uncommitted + committed-this-session changes.
# "This session" = since the last auto-checkpoint tag, if any; else last 20 commits.
LAST_CHECKPOINT=$(git tag -l 'checkpoint-*' --sort=-creatordate 2>/dev/null | head -1)
if [ -n "$LAST_CHECKPOINT" ]; then
  RANGE="${LAST_CHECKPOINT}..HEAD"
else
  RANGE="HEAD~20..HEAD"
fi

# All changed paths (committed + working tree)
COMMITTED=$(git diff --name-only "$RANGE" 2>/dev/null || true)
UNCOMMITTED=$(git status --porcelain 2>/dev/null | awk '{print $2}' || true)
ALL_CHANGED=$(printf "%s\n%s\n" "$COMMITTED" "$UNCOMMITTED" | sort -u | grep -v '^$' || true)

if [ -z "$ALL_CHANGED" ]; then
  exit 0
fi

# Heuristic: code files live outside docs/, .claude/, and common top-level config.
# Adjust CODE_REGEX for your project if needed.
CODE_REGEX='^(src/|app/|lib/|pkg/|cmd/|internal/|server/|client/|web/|api/|packages/|apps/)'
CODE_TOUCHED=$(echo "$ALL_CHANGED" | grep -E "$CODE_REGEX" || true)

if [ -z "$CODE_TOUCHED" ]; then
  # No code changes this session — nothing to drift from.
  exit 0
fi

WIKI_TOUCHED=$(echo "$ALL_CHANGED" | grep -E '^docs/wiki/(entities/|decisions/|requirements\.md|completed\.md|todos\.md)' || true)

if [ -n "$WIKI_TOUCHED" ]; then
  # Code + wiki both touched — healthy.
  exit 0
fi

# Code changed, wiki did not. Remind the agent (non-blocking).
{
  echo ""
  echo "⚠ WIKI DRIFT WARNING"
  echo "Code files were modified this session without a corresponding wiki update:"
  echo "$CODE_TOUCHED" | head -10 | sed 's/^/  • /'
  echo ""
  echo "Before ending the session, dispatch the wiki-maintainer agent to update:"
  echo "  • docs/wiki/entities/<slug>.md   (behavior/interface/design + Code References)"
  echo "  • docs/wiki/requirements.md      (if the spec changed)"
  echo "  • docs/wiki/decisions/<slug>.md  (if a non-trivial choice was made)"
  echo "  • docs/wiki/completed.md         (if a TODO finished)"
  echo "  • docs/wiki/log.md               (append a work entry)"
  echo ""
} >&2

# Also check entity pages that are missing a ## Code References section.
# Only warn if there are shipped/approved entities (stubs and drafts are fine without refs yet).
if [ -d "docs/wiki/entities" ]; then
  ENTITIES_WITHOUT_REFS=$(
    for f in docs/wiki/entities/*.md; do
      [ "$f" = "docs/wiki/entities/README.md" ] && continue
      [ -f "$f" ] || continue
      # Only flag non-draft entities
      STATUS=$(grep -m1 '^status:' "$f" 2>/dev/null | sed 's/status: *//')
      case "$STATUS" in
        draft|"") continue ;;  # stubs/drafts don't need refs yet
      esac
      grep -q "^## Code References" "$f" 2>/dev/null || echo "$f"
    done
  )
  if [ -n "$ENTITIES_WITHOUT_REFS" ]; then
    {
      echo "📌 ENTITY PAGES MISSING '## Code References' SECTION:"
      echo "$ENTITIES_WITHOUT_REFS" | head -5 | sed 's/^/  • /'
      echo "  Add a Code References table to link wiki spec to implementation."
      echo "  See docs/wiki/entities/README.md for the format."
      echo ""
    } >&2
  fi
fi

# exit 2 would block; we only want to remind.
exit 0
