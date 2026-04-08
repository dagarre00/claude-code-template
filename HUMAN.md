# Multi-Agent Development Workflow — Human Guide

## What Is This?

A reusable multi-agent workflow for Claude Code. It provides 8 specialized AI agents, a knowledge base (browsable in Obsidian), hooks for automated logging and formatting, and slash commands for common workflows.

## Quick Start

```bash
# 1. Set up local permissions (required — unlocks Write/Edit/Bash)
cp .claude/settings.local.json.template .claude/settings.local.json

# 2. Open this project in Claude Code
claude

# 3. Define your requirements (guided interview)
/project:interview

# 4. Detect stack and set up environment
/project:init

# 5. Generate a task plan from requirements
/project:plan

# 6. Start working — research → implement → review pipeline
/project:work
```

## Available Commands

| Command | What it does |
|---------|-------------|
| `/project:interview` | Guided Q&A to define project requirements |
| `/project:init` | Detect stack, create venv, populate docs |
| `/project:plan` | Generate prioritized TODOs from requirements |
| `/project:work` | Full pipeline: research → plan → confirm → implement → review |
| `/project:research` | Investigate a task, output a plan file (no code) |
| `/project:review` | Review all uncommitted changes |
| `/project:status` | Show project state, TODOs, recent changelog |
| `/project:sync-docs` | Update file map, sync TODOs, verify links |
| `/project:checkpoint` | Tag current HEAD + save session state |
| `/project:rollback` | Revert to a previous checkpoint |
| `/project:fresh` | Start new session from saved checkpoint state |

## Browse the Knowledge Base

Open `docs/` in [Obsidian](https://obsidian.md/) to see the knowledge graph. Key files:

- `docs/INDEX.md` — entry point with links to everything
- `docs/project-requirements.md` — what we're building
- `docs/project-state.md` — current TODOs and completed work
- `docs/architecture.md` — stack, conventions, patterns
- `docs/agent-context/gotchas.md` — known failure points (highest-signal doc)

## Daily Workflow

**Morning:**
1. `/project:status` — where are we?
2. `/project:plan` — anything new to add?
3. `/project:work` — start the top TODO

**During work:**
- `/project:checkpoint` before anything risky
- `/project:review` after each feature
- If context feels heavy → `/project:fresh`

**End of day:**
- `/project:checkpoint` — save state
- `/project:sync-docs` — keep knowledge base current

## Team Usage

Multiple developers can work simultaneously:

1. Each developer runs their own Claude Code session
2. Use git worktrees for isolation: `git worktree add ../feature-x feature-x`
3. The implementer agent uses worktree isolation by default
4. Merge branches back to main sequentially to avoid conflicts

### Enable Agent Teams (experimental)

For parallel agent work across multiple Claude Code instances:

```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
claude
```

## Troubleshooting

**Write/Edit/Bash being blocked?**
- Copy the local permissions template: `cp .claude/settings.local.json.template .claude/settings.local.json`
- The base `settings.json` is read-only by default for safety — `settings.local.json` unlocks write tools

**Hooks not running?**
- Check that all scripts in `.claude/hooks/` are executable: `chmod +x .claude/hooks/*.sh`
- Hooks require `jq` — install it: `brew install jq` / `apt install jq`

**Agent not found?**
- Agents load at session start. Restart Claude Code after adding new agent files.
- Run `/agents` to see all available agents.

**Context getting heavy?**
- Run `/project:checkpoint` to save state, then `/project:fresh` in a new session
- Do NOT rely on `/compact` — it's lossy and you don't control what survives

**Want to reset docs?**
- Delete `docs/` and re-run the scaffold, or
- Run `/project:init` to re-detect and repopulate

**Behavioral rules not being followed?**
- CLAUDE.md instructions are followed ~70% of the time
- For anything that MUST happen 100%, use hooks (not CLAUDE.md or rules)
- Add new behavioral rules to `.claude/rules/behavioral.md` as failures occur
