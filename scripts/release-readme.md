# New project

Started from [claude-code-template](https://github.com/dagarre00/claude-code-template) {{version}}, a wiki-driven, test-first development workflow for Claude Code, Codex and Antigravity CLI. Replace this file once the project has a name.

## First steps

1. **Install the workflow server's dependencies:** `npm ci --prefix tools/workflow-mcp`.
2. **Give the plugin this directory's name** (Claude Code only). Claude Code keeps one plugin marketplace per name per machine, and every project started from this release ships as `workflow-claude-code-template`, so two of them on one machine load each other's skills. Replace that name with `workflow-<this directory's name>` (lowercase, each run of other characters as one `-`) in `.claude-plugin/marketplace.json` and in both keys of `.claude/settings.json`.
3. **Start your CLI here and run `/project:init`.** In Codex or Antigravity, paste `.agents/commands/init.md` instead. It creates the git repository, asks which engine and model runs each role, interviews you for the requirements, scaffolds `docs/wiki/`, sets up a test command, an architecture check and CI, and rewrites `AGENTS.md` and `CLAUDE.md` for this project.

`tools/workflow-mcp/getting-started.md` walks through a first cycle and has the troubleshooting table. To see or change which engine and model runs each role later, run `node tools/workflow-mcp/config-ui.mjs` ([guide](tools/workflow-mcp/config.md)).
