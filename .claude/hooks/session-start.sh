#!/bin/bash
# SessionStart hook -- runs when a new Claude agent session begins.
# Purpose:
#   - Warn on upstream divergence (detect, do not auto-pull)
#   - Detect Python venv if markers present
#   - Warn on uncommitted changes (also absorbs the previous session's
#     dirty-tree nag, which Stop hooks cannot inject into context)
#   - Record HEAD SHA to .claude/tmp/session-start-sha for later hooks
#   - Reset per-session dedup markers so in-flow reminders fire once each
#
# CHANNEL: actionable lines go to STDOUT. SessionStart stdout is injected
# into the model's context, so the agent starts knowing the git state.
# Pure side-effect chatter (none here) would stay on stderr.
set -u

# Only act inside a git repo
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  exit 0
fi

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
TMP="$ROOT/.claude/tmp"
SHA_FILE="$TMP/session-start-sha"
mkdir -p "$TMP" 2>/dev/null

# Record HEAD SHA so later hooks can scope "this session's" changes
git rev-parse HEAD > "$SHA_FILE" 2>/dev/null

# Reset in-flow reminder dedup markers -- each new session re-warns once
rm -f "$TMP"/*-warned 2>/dev/null

# --- Upstream divergence ---
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
if git rev-parse --abbrev-ref --symmetric-full @'{u}' >/dev/null 2>&1; then
  UPSTREAM="$(git rev-parse --abbrev-ref --symmetric-full @'{u}' 2>/dev/null)"
  BEHIND="$(git rev-list --count HEAD..@'{u}' 2>/dev/null)"
  if [ "${BEHIND}" -gt 0 ] 2>/dev/null; then
    echo ">>> [session-start] Branch '$BRANCH' is behind $UPSTREAM by $BEHIND commit(s)."
    echo ">>> Run: git pull --ff-only (or rebase) before starting work."
  fi
fi

# --- Python venv detection ---
if [ -f "$ROOT/requirements.txt" ] || [ -f "$ROOT/pyproject.toml" ]; then
  if [ -z "${VIRTUAL_ENV:-}" ] && [ -d "$ROOT/.venv" ]; then
    echo ">>> [session-start] Python venv exists at .venv but is not activated."
    echo ">>> Run: source .venv/bin/activate"
  fi
fi

# --- Uncommitted changes ---
if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
  echo ">>> [session-start] Uncommitted changes in working tree -- commit or stash before new work."
fi

exit 0
