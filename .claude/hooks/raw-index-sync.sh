#!/bin/bash
# .claude/hooks/raw-index-sync.sh
# PostToolUse hook: when a new file lands in docs/raw/, append a row to docs/raw/index.md
# so wiki-maintainer sees it as `pending` on the next /wiki:ingest run.
#
# Idempotent: if the file is already listed, does nothing.

INPUT=$(cat)

if ! command -v jq &> /dev/null; then
  exit 0
fi

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

# Normalize to repo-relative path
REL_PATH="${FILE_PATH#$(pwd)/}"

# Only care about files under docs/raw/ (but not the index itself)
case "$REL_PATH" in
  docs/raw/index.md) exit 0 ;;
  docs/raw/*) ;;
  *) exit 0 ;;
esac

INDEX="docs/raw/index.md"
if [ ! -f "$INDEX" ]; then
  exit 0
fi

# Already listed? (simple substring check)
if grep -qF "$REL_PATH" "$INDEX" 2>/dev/null; then
  exit 0
fi

TODAY=$(date +%Y-%m-%d)
FILENAME=$(basename "$REL_PATH")

# Decide which section to append to based on subfolder
case "$REL_PATH" in
  docs/raw/feature-requests/*) SECTION_MARKER="### Feature requests" ;;
  docs/raw/interviews/*)       SECTION_MARKER="### Interviews"       ;;
  docs/raw/memory-snapshots/*) SECTION_MARKER="### Memory snapshots" ;;
  *)                           SECTION_MARKER="### User-dropped"     ;;
esac

# Build the row (columns differ by section — use the common shape)
ROW="| [\`$FILENAME\`]($REL_PATH) | $TODAY | pending | — |"

# Insert the new row right after the table header separator (|---|) for the
# matching section, then skip the "*(none yet)*" placeholder if still present.
# This works whether the table is empty (placeholder only) or already has rows.
awk -v section="$SECTION_MARKER" -v row="$ROW" '
  BEGIN { in_target=0; inserted=0; check_placeholder=0 }
  {
    # Activate on the target section header
    if (!inserted && $0 ~ section) { in_target=1; print; next }

    # Find the header separator line (|---|...|) and insert after it
    if (in_target && !inserted && $0 ~ /^\|[-| ]+\|/) {
      print        # print the separator line itself
      print row    # insert new row immediately after
      inserted=1
      check_placeholder=1
      in_target=0
      next
    }

    # Skip the "*(none yet)*" placeholder that immediately follows the separator
    if (check_placeholder) {
      check_placeholder=0
      if ($0 ~ /^\| *\*/) next
    }

    print
  }
' "$INDEX" > "$INDEX.tmp" && mv "$INDEX.tmp" "$INDEX"

exit 0
