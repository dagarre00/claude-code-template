#!/usr/bin/env bash
# Adopt the workflow-mcp mechanism into an existing project.
#
# Point it at the target project explicitly:
#
#   bash scripts/adopt.sh /path/to/existing-project
#
# ...or, with no argument, run it from inside the project you're adopting
# into (the target defaults to the current directory; the template's own
# files are still found relative to this script's own path, not your cwd):
#
#   cd /path/to/existing-project
#   bash /path/to/claude-code-template/scripts/adopt.sh
#
# What this script does (steps 1-3 of README.md § Quick start → Existing project):
#   1. Copy .agents/ into the target.
#   2. Copy tools/workflow-mcp/ (minus node_modules and its own test/ suite,
#      and with the template-only "test" script stripped from package.json)
#      and `npm install` it.
#   3. Copy .mcp.json, and register the MCP server for codex/agy if installed.
#
# What it does NOT do (step 4, yours to finish):
#   - Wire .claude/settings.json if the target already has one with other
#     content — merging an unknown JSON file blindly is exactly the kind of
#     "measure twice" case this template's own rules warn against. If the
#     target has no settings.json yet, this script creates one; otherwise it
#     prints the block for you to merge by hand.
#   - Run /project:init. That needs an interactive agent session, so this
#     script's last act is telling you to start one.
#
# Everything past that — stack detection, wiki scaffolding, a runnable test
# command, the first commit — is /project:init's job, not this script's. See
# .agents/commands/init.md.

set -euo pipefail

TEMPLATE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ $# -eq 0 ]]; then
  echo "No path given — defaulting to the current directory as the target." >&2
  TARGET="."
else
  TARGET="$1"
fi

if [[ ! -d "$TARGET" ]]; then
  echo "Error: '$TARGET' is not a directory. This script adopts into an" >&2
  echo "existing project — for a brand-new one, use the 'New project' flow" >&2
  echo "in README.md instead (clone + rm -rf .git)." >&2
  exit 1
fi

TARGET="$(cd "$TARGET" && pwd)"

# Only for text we write into a *file's content* (a TOML/JSON value), never for
# a path handed to a subprocess as an argv (Git Bash's MSYS runtime already
# rewrites a POSIX-style argument to Windows form for a native, non-MSYS
# executable like codex.exe or agy.exe — measured: `codex mcp add --root
# "$TARGET"` with `$TARGET` still POSIX-style produced a correct
# `C:/Users/...` entry). A path inside a heredoc is plain text the runtime
# never touches, so `/c/Users/...` would be written verbatim — and Node on
# Windows resolves a leading `/` against the current drive, not `C:\`, so the
# server would fail to start with that path silently wrong. `cygpath -m` gives
# the same drive-letter-plus-forward-slashes form the argv path ends up in, so
# both are visibly the same path if you print them side by side. Absent
# outside Git Bash on Windows, where TARGET is already the only form there is.
TARGET_FOR_FILE_CONTENT="$TARGET"
if command -v cygpath >/dev/null 2>&1; then
  TARGET_FOR_FILE_CONTENT="$(cygpath -m "$TARGET")"
fi

if [[ "$TARGET" == "$TEMPLATE_ROOT" ]]; then
  echo "Error: target is the template checkout itself. Pass the path to the" >&2
  echo "project you're adopting the mechanism into." >&2
  exit 1
fi

echo "Template:  $TEMPLATE_ROOT"
echo "Target:    $TARGET"
echo

# ---------------------------------------------------------------------------
# Step 1 — .agents/
# ---------------------------------------------------------------------------
if [[ -e "$TARGET/.agents" ]]; then
  echo "Step 1: '$TARGET/.agents' already exists — leaving it untouched." >&2
  echo "        (remove or rename it first if you want a clean copy from the template)" >&2
else
  cp -r "$TEMPLATE_ROOT/.agents" "$TARGET/.agents"
  echo "Step 1: copied .agents/"
fi

# ---------------------------------------------------------------------------
# Step 2 — tools/workflow-mcp/ (skip node_modules and the template's own
# test/ suite — a consuming project should never see, let alone run, tests
# that only verify the template repo's own workflow-mcp source), then
# npm install
# ---------------------------------------------------------------------------
mkdir -p "$TARGET/tools"
if [[ -e "$TARGET/tools/workflow-mcp" ]]; then
  echo "Step 2: '$TARGET/tools/workflow-mcp' already exists — leaving it untouched." >&2
else
  tar -C "$TEMPLATE_ROOT" -cf - \
    --exclude='tools/workflow-mcp/node_modules' \
    --exclude='tools/workflow-mcp/test' \
    tools/workflow-mcp \
    | tar -C "$TARGET" -xf -
  echo "Step 2: copied tools/workflow-mcp/ (node_modules and test/ excluded)"

  if command -v node >/dev/null 2>&1; then
    WORKFLOW_MCP_PKG="$TARGET/tools/workflow-mcp/package.json" node -e '
      const fs = require("fs");
      const p = process.env.WORKFLOW_MCP_PKG;
      const pkg = JSON.parse(fs.readFileSync(p, "utf8"));
      delete pkg.scripts;
      fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + "\n");
    '
    echo "Step 2: stripped the template-only \"test\" script from package.json"
  fi
fi

if command -v npm >/dev/null 2>&1; then
  (cd "$TARGET/tools/workflow-mcp" && npm install --silent)
  echo "Step 2: npm install done in tools/workflow-mcp/"
else
  echo "Step 2: npm not found on PATH — run 'npm install' in" >&2
  echo "        '$TARGET/tools/workflow-mcp' yourself before dispatching any worker." >&2
fi

# ---------------------------------------------------------------------------
# Step 3 — .mcp.json, plus best-effort conductor registration
# ---------------------------------------------------------------------------
if [[ -e "$TARGET/.mcp.json" ]]; then
  echo "Step 3: '$TARGET/.mcp.json' already exists — leaving it untouched." >&2
  echo "        Merge this block into it by hand if 'workflow' isn't registered:" >&2
  echo "        $(cat "$TEMPLATE_ROOT/.mcp.json")" >&2
else
  cp "$TEMPLATE_ROOT/.mcp.json" "$TARGET/.mcp.json"
  echo "Step 3: copied .mcp.json (registers the server with --engine claude)"
fi

if [[ -e "$TARGET/.claude-plugin/marketplace.json" ]]; then
  echo "Step 3: '$TARGET/.claude-plugin/marketplace.json' already exists — leaving it untouched." >&2
else
  mkdir -p "$TARGET/.claude-plugin"
  cp "$TEMPLATE_ROOT/.claude-plugin/marketplace.json" "$TARGET/.claude-plugin/marketplace.json"
  echo "Step 3: copied .claude-plugin/marketplace.json (needed for Claude Code's" \
       "extraKnownMarketplaces path \".\" in settings.json to resolve project@workflow" \
       "— without this file the plugin never registers, no matter how many times the" \
       "session restarts)"
fi

if command -v codex >/dev/null 2>&1; then
  if [[ -e "$TARGET/.codex/config.toml" ]]; then
    echo "Step 3: '$TARGET/.codex/config.toml' already exists — leaving it untouched." >&2
    echo "        Merge this table into it by hand if [mcp_servers.workflow] isn't there:" >&2
    echo "        [mcp_servers.workflow]" >&2
    echo "        command = \"node\"" >&2
    echo "        args = [\"$TARGET_FOR_FILE_CONTENT/tools/workflow-mcp/server.mjs\", \"--root\", \"$TARGET_FOR_FILE_CONTENT\", \"--engine\", \"codex\"]" >&2
  else
    mkdir -p "$TARGET/.codex"
    cat > "$TARGET/.codex/config.toml" <<EOF
[mcp_servers.workflow]
command = "node"
args = ["$TARGET_FOR_FILE_CONTENT/tools/workflow-mcp/server.mjs", "--root", "$TARGET_FOR_FILE_CONTENT", "--engine", "codex"]
EOF
    echo "Step 3: wrote $TARGET/.codex/config.toml (project-local; wins over any"
    echo "        machine-global 'workflow' entry for this directory — see"
    echo "        docs/wiki/gotchas.md § 'codex mcp add / agy mcp add with relative"
    echo "        paths break at spawn time' for why this beats 'codex mcp add')."
    echo "        If an earlier global registration exists, it's now redundant here"
    echo "        but harmless; drop it elsewhere with 'codex mcp remove workflow'"
    echo "        if you want one canonical entry."
  fi
fi

# The file above holds this machine's absolute paths, so it must never be
# committed — and it is the target's .gitignore, not the template's, that
# decides that (adversary round 1 on fix/workflow-mcp-hardening, F1). Done
# whether or not codex is on PATH here: a later contributor who has codex
# writes the same file by hand (docs/wiki/gotchas.md), and the ignore line
# has to be there before they do. Idempotent — an exact existing line is left
# alone (a trailing CR, as in a CRLF .gitignore, counts as the same line),
# and a file with no trailing newline gets one before the append.
if grep -qE '^\.codex/config\.toml[[:space:]]*$' "$TARGET/.gitignore" 2>/dev/null; then
  echo "Step 3: $TARGET/.gitignore already ignores .codex/config.toml"
else
  if [[ -s "$TARGET/.gitignore" && -n "$(tail -c1 "$TARGET/.gitignore")" ]]; then
    echo >> "$TARGET/.gitignore"
  fi
  printf '%s\n' \
    '# Codex project-local MCP registration: machine-specific absolute paths (written by scripts/adopt.sh)' \
    '.codex/config.toml' >> "$TARGET/.gitignore"
  echo "Step 3: appended .codex/config.toml to $TARGET/.gitignore (machine-specific paths, never committed)"
fi

if command -v agy >/dev/null 2>&1; then
  if agy mcp add workflow node "$TARGET/tools/workflow-mcp/server.mjs" --root "$TARGET" --engine antigravity 2>/dev/null; then
    echo "Step 3: registered workflow with agy (global config — see note below)"
  else
    echo "Step 3: 'agy mcp add' failed or was already registered — check manually if you conduct with agy." >&2
  fi
fi

if command -v agy >/dev/null 2>&1; then
  echo "Step 3: NOTE — agy's MCP registration is machine-global, not" >&2
  echo "        per-project (its own project-local config is a known upstream" >&2
  echo "        no-op: google-antigravity/antigravity-cli#60). Adopting into a" >&2
  echo "        second project under the same name 'workflow' overwrites this" >&2
  echo "        one's entry. Re-run this script (or 'agy mcp add workflow ...')" >&2
  echo "        from inside whichever project you're about to conduct in with agy." >&2
fi

# ---------------------------------------------------------------------------
# Step 4 — .claude/settings.json: safe to do only when nothing exists yet
# ---------------------------------------------------------------------------
SETTINGS_SNIPPET='  "extraKnownMarketplaces": {\n    "workflow": { "source": { "source": "directory", "path": "." } }\n  },\n  "enabledPlugins": { "project@workflow": true }'

echo
echo "-------------------------------------------------------------------"
if [[ ! -e "$TARGET/.claude/settings.json" ]]; then
  mkdir -p "$TARGET/.claude"
  printf '{\n%b\n}\n' "$SETTINGS_SNIPPET" > "$TARGET/.claude/settings.json"
  echo "Step 4: created .claude/settings.json (no prior file to conflict with)."
  echo "        Only needed if Claude Code conducts; skip it for codex/agy."
else
  echo "Step 4 (yours to finish): '$TARGET/.claude/settings.json' already exists."
  echo "Merge these two keys into it by hand — do not overwrite the file:"
  echo
  printf '%b\n' "$SETTINGS_SNIPPET"
  echo
  echo "Only needed if Claude Code conducts; skip it for codex/agy."
fi
echo "-------------------------------------------------------------------"
echo
echo "Mechanics done. Next: start your CLI in '$TARGET' and run /project:init"
echo "(Claude Code: type /project:init. Codex/agy: paste .agents/commands/init.md)."
echo "It verifies this wiring, detects your existing stack, scaffolds docs/wiki"
echo "around it, and sets a real test command — everything past step 4 is its job."
echo
echo "Optional but recommended first: tools/workflow-mcp/conductor-e2e.md came"
echo "along with the copy in step 2. Paste it into your conducting CLI to confirm"
echo "a worker can actually dispatch and write files on this machine before you"
echo "trust it — see tools/workflow-mcp/conductor-e2e.md for how to run it."
echo "It's meant to be re-run whenever you change .agents/config.json, not just"
echo "once, so keep it rather than deleting it after the first pass."
