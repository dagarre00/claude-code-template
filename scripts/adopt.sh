#!/usr/bin/env bash
# Adopt the workflow into an existing project:
#
#   bash scripts/adopt.sh /path/to/existing-project
#
# or, from inside that project (template files are still found relative to
# this script):
#
#   bash /path/to/claude-code-template/scripts/adopt.sh
#
# Steps (README.md § Quick start):
#   1. Copy .agents/.
#   2. Copy tools/workflow-mcp/ without node_modules/ or its template-only test/
#      suite (dropping the "test" script from package.json), then npm install.
#   3. Copy .mcp.json, write the per-project plugin marketplace, and register
#      the server for codex/agy if they are installed.
#   4. Create .claude/settings.json if absent — an existing one is never merged
#      blindly; the keys to add are printed instead.
#
# Everything after that — stack detection, the wiki, a runnable test command,
# the first commit — is /project:init's job (.agents/commands/init.md).

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

# For paths written into a file's *content* (TOML/JSON). Git Bash rewrites a
# POSIX path argument for a native executable, but not text in a heredoc, and
# Node on Windows resolves a leading `/c/...` against the current drive. So
# file content gets the drive-letter form (`C:/...`); outside Git Bash on
# Windows there is only one form.
TARGET_FOR_FILE_CONTENT="$TARGET"
if command -v cygpath >/dev/null 2>&1; then
  TARGET_FOR_FILE_CONTENT="$(cygpath -m "$TARGET")"
fi

if [[ "$TARGET" == "$TEMPLATE_ROOT" ]]; then
  echo "Error: target is the template checkout itself. Pass the path to the" >&2
  echo "project you're adopting the workflow into." >&2
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
# Step 2 — tools/workflow-mcp/. Its test/ suite verifies only the template's
# own source, so an adopting project never receives or runs it.
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
    # Only "test" goes: "config" and "e2e" are documented for adopters too.
    WORKFLOW_MCP_PKG="$TARGET/tools/workflow-mcp/package.json" node -e '
      const fs = require("fs");
      const p = process.env.WORKFLOW_MCP_PKG;
      const pkg = JSON.parse(fs.readFileSync(p, "utf8"));
      if (pkg.scripts) {
        delete pkg.scripts.test;
        if (!Object.keys(pkg.scripts).length) delete pkg.scripts;
      }
      fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + "\n");
    '
    echo "Step 2: removed the template-only \"test\" script from package.json"
  fi
fi

# `npm ci` installs exactly what the copied lockfile pins — the versions the
# template was tested with. `npm install` is the fallback for a lockfile the
# local npm refuses.
if command -v npm >/dev/null 2>&1; then
  (cd "$TARGET/tools/workflow-mcp" && { npm ci --silent || npm install --silent; })
  echo "Step 2: dependencies installed in tools/workflow-mcp/ (from the lockfile)"
else
  echo "Step 2: npm not found on PATH — run 'npm ci' in" >&2
  echo "        '$TARGET/tools/workflow-mcp' yourself before dispatching any worker." >&2
fi

# ---------------------------------------------------------------------------
# Step 3 — .mcp.json, the plugin marketplace, and codex/agy registration
# ---------------------------------------------------------------------------
if [[ -e "$TARGET/.mcp.json" ]]; then
  echo "Step 3: '$TARGET/.mcp.json' already exists — leaving it untouched." >&2
  echo "        Merge this block into it by hand if 'workflow' isn't registered:" >&2
  echo "        $(cat "$TEMPLATE_ROOT/.mcp.json")" >&2
else
  cp "$TEMPLATE_ROOT/.mcp.json" "$TARGET/.mcp.json"
  echo "Step 3: copied .mcp.json (registers the server with --engine claude)"
fi

# Claude Code keeps one marketplace per name per machine, and the plugin loads
# in place from the marketplace's directory — so a name shared with another
# project serves that project's skills here. The name is derived from the
# project directory: stable across clones, distinct on this machine.
MARKETPLACE="workflow-$(basename "$TARGET" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-//; s/-$//')"

if [[ -e "$TARGET/.claude-plugin/marketplace.json" ]]; then
  EXISTING_NAME="$(sed -n 's/^[[:space:]]*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$TARGET/.claude-plugin/marketplace.json" | head -n 1)"
  if [[ "$EXISTING_NAME" == "$MARKETPLACE" ]]; then
    echo "Step 3: '$TARGET/.claude-plugin/marketplace.json' already exists as marketplace '$MARKETPLACE' — leaving it untouched."
  else
    echo "Step 3: '$TARGET/.claude-plugin/marketplace.json' already exists, named '${EXISTING_NAME:-?}' — leaving it untouched." >&2
    echo "        A name shared with another project on this machine makes Claude Code serve this" >&2
    echo "        project's skills from that other checkout. To use the per-project name, set" >&2
    echo "        \"name\": \"$MARKETPLACE\" in that file and use the same name in .claude/settings.json:" >&2
    echo "        the extraKnownMarketplaces key, and enabledPlugins \"project@$MARKETPLACE\"." >&2
  fi
else
  mkdir -p "$TARGET/.claude-plugin"
  cat > "$TARGET/.claude-plugin/marketplace.json" <<EOF
{
  "name": "$MARKETPLACE",
  "owner": { "name": "claude-code-template" },
  "plugins": [
    {
      "name": "project",
      "source": "./.agents",
      "description": "Wiki-driven development workflow: spec, TDD, adversarial review, and wiki maintenance."
    }
  ]
}
EOF
  echo "Step 3: wrote .claude-plugin/marketplace.json as marketplace '$MARKETPLACE'"
  echo "        (per project, because the machine keeps one marketplace per name)"
fi

# Codex reads a project-local .codex/config.toml, which wins over any global
# 'workflow' entry for this directory — so no machine-global collision.
# Absolute paths, because codex spawns the server from another directory.
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
    echo "Step 3: wrote $TARGET/.codex/config.toml (project-local; wins over a global"
    echo "        'workflow' entry here — drop an old one with 'codex mcp remove workflow')"
  fi
fi

# That file holds this machine's absolute paths, so the target must ignore it —
# even without codex here, since a later contributor may write it by hand.
# Idempotent: an existing line (CRLF included) is kept, and a file missing its
# final newline gets one before the append.
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

# agy's registration is machine-global (its project-local config is a known
# upstream no-op: google-antigravity/antigravity-cli#60), so this overwrites
# any other project's 'workflow' entry — including when testing this script
# against a scratch directory.
if command -v agy >/dev/null 2>&1; then
  if agy mcp add workflow node "$TARGET/tools/workflow-mcp/server.mjs" --root "$TARGET" --engine antigravity 2>/dev/null; then
    echo "Step 3: registered workflow with agy (global config — see note below)"
  else
    echo "Step 3: 'agy mcp add' failed or was already registered — check manually if you conduct with agy." >&2
  fi
  echo "Step 3: NOTE — agy's MCP registration is machine-global, not per project." >&2
  echo "        Registering another project under 'workflow' overwrites this one. Re-run" >&2
  echo "        this script (or 'agy mcp add workflow ...') in whichever project you are" >&2
  echo "        about to conduct in with agy." >&2
fi

# ---------------------------------------------------------------------------
# Step 4 — .claude/settings.json: written only when none exists
# ---------------------------------------------------------------------------
# claudeMdExcludes: every worker worktree under .worktrees/ is a full checkout
# with its own CLAUDE.md, which Claude Code would otherwise load into the
# conductor's context the first time it reads a file there — once per worktree.
SETTINGS_SNIPPET="  \"extraKnownMarketplaces\": {\n    \"$MARKETPLACE\": { \"source\": { \"source\": \"directory\", \"path\": \".\" } }\n  },\n  \"enabledPlugins\": { \"project@$MARKETPLACE\": true },\n  \"claudeMdExcludes\": [\"**/.worktrees/**/CLAUDE.md\", \"**/.worktrees/**/AGENTS.md\"]"

echo
echo "-------------------------------------------------------------------"
if [[ ! -e "$TARGET/.claude/settings.json" ]]; then
  mkdir -p "$TARGET/.claude"
  printf '{\n%b\n}\n' "$SETTINGS_SNIPPET" > "$TARGET/.claude/settings.json"
  echo "Step 4: created .claude/settings.json (no prior file to conflict with)."
  echo "        Only needed if Claude Code conducts; skip it for codex/agy."
else
  echo "Step 4 (yours to finish): '$TARGET/.claude/settings.json' already exists."
  echo "Merge these three keys into it by hand — do not overwrite the file:"
  echo
  printf '%b\n' "$SETTINGS_SNIPPET"
  echo
  echo "Only needed if Claude Code conducts; skip it for codex/agy."
fi
echo "-------------------------------------------------------------------"
echo
echo "Mechanics done. Next: start your CLI in '$TARGET' and run /project:init"
echo "(Claude Code: /project:init. Codex/agy: paste .agents/commands/init.md)."
echo "It verifies this wiring, detects your stack, scaffolds docs/wiki and sets"
echo "a real test command."
echo
echo "Recommended first: tools/workflow-mcp/conductor-e2e.md confirms a worker can"
echo "actually dispatch and write files on this machine. Re-run it whenever you"
echo "change .agents/config.json."
echo
echo "To see or change which tool and model runs each role:"
echo "    node tools/workflow-mcp/config-ui.mjs"
echo "(guide: tools/workflow-mcp/config.md) — /project:init also asks about it."
echo "If something doesn't connect: tools/workflow-mcp/getting-started.md § Troubleshooting."
