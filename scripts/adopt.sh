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

if command -v codex >/dev/null 2>&1; then
  if (cd "$TARGET" && codex mcp add workflow -- node tools/workflow-mcp/server.mjs --root . --engine codex) 2>/dev/null; then
    echo "Step 3: registered workflow with codex (global config — see note below)"
  else
    echo "Step 3: 'codex mcp add' failed or was already registered — check manually if you conduct with codex." >&2
  fi
fi

if command -v agy >/dev/null 2>&1; then
  if (cd "$TARGET" && agy mcp add workflow node tools/workflow-mcp/server.mjs --root . --engine antigravity) 2>/dev/null; then
    echo "Step 3: registered workflow with agy (global config — see note below)"
  else
    echo "Step 3: 'agy mcp add' failed or was already registered — check manually if you conduct with agy." >&2
  fi
fi

if command -v codex >/dev/null 2>&1 || command -v agy >/dev/null 2>&1; then
  echo "Step 3: NOTE — codex/agy MCP registration is machine-global, not" >&2
  echo "        per-project. Adopting into a second project under the same" >&2
  echo "        name 'workflow' overwrites this one's entry. Re-run this" >&2
  echo "        script (or 'codex/agy mcp add workflow ...') from inside" >&2
  echo "        whichever project you're about to conduct in." >&2
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
