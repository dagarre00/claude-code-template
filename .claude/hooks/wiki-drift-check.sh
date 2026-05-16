#!/usr/bin/env bash
# Stop hook: warn (non-blocking) if code was touched this session but no
# docs/wiki/ page was touched in the same change set.
set -uo pipefail

root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$root"

# Default-branch resolution order:
#  1. WIKI_DEFAULT_BRANCH env var (explicit override).
#  2. Auto-detect from `git symbolic-ref refs/remotes/origin/HEAD`.
#  3. Fall back to `main`.
default_branch="${WIKI_DEFAULT_BRANCH:-}"
if [ -z "$default_branch" ]; then
  default_branch=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')
fi
default_branch="${default_branch:-main}"

# Collect files changed: branch-vs-default + uncommitted + staged.
files=$(
  {
    git diff --name-only "$default_branch"...HEAD 2>/dev/null
    git diff --name-only HEAD 2>/dev/null
    git diff --name-only --cached 2>/dev/null
  } | sort -u | grep -v '^$' || true
)

[ -z "$files" ] && exit 0

code_touched=false
wiki_touched=false
while IFS= read -r f; do
  case "$f" in
    docs/wiki/*) wiki_touched=true ;;
    src/*|app/*|lib/*|tests/*|test/*|cmd/*|internal/*|pkg/*|.claude/*) code_touched=true ;;
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
