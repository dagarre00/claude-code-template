#!/bin/bash
# .claude/hooks/code-ref-check.sh
# PostToolUse hook: when a source code file is written/edited, check whether any
# wiki entity page references it and whether that page has a ## Code References section.
#
# This enforces CLAUDE.md Golden Rule #2 at the symbol level — not just "wiki touched"
# but "the entity has a Code References table". Non-blocking: emits a reminder to stderr.

INPUT=$(cat)

if ! command -v jq &> /dev/null; then
  exit 0
fi

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

# Resolve path relative to repo root (handles both absolute and relative paths)
if git rev-parse --git-dir &> /dev/null 2>&1; then
  REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
  REL_PATH="${FILE_PATH#${REPO_ROOT}/}"
else
  REL_PATH="$FILE_PATH"
fi

# Only act on source code files — skip docs, .claude, and top-level config files
CODE_REGEX='^(src/|app/|lib/|pkg/|cmd/|internal/|server/|client/|web/|api/|packages/|apps/)'
if ! echo "$REL_PATH" | grep -qE "$CODE_REGEX"; then
  exit 0
fi

ENTITIES_DIR="docs/wiki/entities"
if [ ! -d "$ENTITIES_DIR" ]; then
  exit 0
fi

BASENAME=$(basename "$FILE_PATH")

# Find entity pages that mention this file (by basename or relative path)
MATCHING_ENTITIES=$(grep -rlE "$BASENAME|$REL_PATH" "$ENTITIES_DIR"/*.md 2>/dev/null | grep -v README.md || true)

if [ -z "$MATCHING_ENTITIES" ]; then
  # No entity references this file at all — remind agent to add one
  {
    echo ""
    echo "📌 CODE REFERENCE REMINDER"
    echo "  Modified: $REL_PATH"
    echo "  No wiki entity page references this file."
    echo ""
    echo "  Update the relevant docs/wiki/entities/<slug>.md and add:"
    echo ""
    echo "  ## Code References"
    echo "  <!-- Last verified: $(date +%Y-%m-%d) -->"
    echo "  | Symbol | Location | Description |"
    echo "  |--------|----------|-------------|"
    echo "  | \`functionName()\` | \`${REL_PATH}:LINE\` | What it does |"
    echo ""
    echo "  Run /wiki:query to find the right entity slug."
    echo ""
  } >&2
  exit 0
fi

# Entity pages exist — check each one has a ## Code References section
MISSING_REFS=""
while IFS= read -r entity_file; do
  if ! grep -q "^## Code References" "$entity_file" 2>/dev/null; then
    MISSING_REFS="${MISSING_REFS}  • ${entity_file}"$'\n'
  fi
done <<< "$MATCHING_ENTITIES"

if [ -n "$MISSING_REFS" ]; then
  {
    echo ""
    echo "📌 CODE REFERENCE REMINDER"
    echo "  Modified: $REL_PATH"
    echo "  The following entity pages reference this file but lack a '## Code References' section:"
    echo ""
    echo "$MISSING_REFS"
    echo "  Add a ## Code References table listing functions, classes, and constants with"
    echo "  their file:line locations. See docs/wiki/entities/README.md for the format."
    echo ""
  } >&2
fi

exit 0
