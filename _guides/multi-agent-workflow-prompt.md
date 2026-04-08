# Multi-Agent Development Workflow — Claude Code Setup Prompt

> **Usage:** Paste this entire prompt into a fresh Claude Code session (Opus recommended) inside an empty repository. Claude will scaffold the full project structure.

---

## Prompt

```
You are setting up a reusable multi-agent development workflow for Claude Code. This system must work for any project (Python, JS, full-stack, etc.) and support both solo developers and small teams. Read this entire prompt before doing anything.

## 1. Project Knowledge Base (Obsidian-compatible)

Create a `docs/` directory structured as an Obsidian vault. All files are markdown with `[[wiki-links]]` between them. Include a `.obsidian/` folder with a minimal `app.json` and `graph.json` so it opens cleanly in Obsidian. The vault must contain:

### Core Documents

- `docs/INDEX.md` — Entry point. Links to every other doc. Serves as the "map of content" for both humans and agents.
- `docs/project-requirements.md` — Project requirements. Starts with a `## Status: Not Initialized` section and a template with sections: Vision, User Stories, Functional Requirements, Non-Functional Requirements, Constraints, Out of Scope. Keep it lean — bullet points, no prose.
- `docs/project-state.md` — Current state of the project. Sections: Current Phase, Completed Tasks (table: ID | Description | Date | Agent), Active TODOs (table: ID | Priority | Description | Assigned Agent | Status), Blocked Items, Next Milestone. This is the single source of truth for what's done and what's next.
- `docs/architecture.md` — Coding architecture and conventions. Starts with a template that covers: Project Structure (directory tree), Design Patterns (clean architecture layers), Naming Conventions, Error Handling Strategy, Testing Strategy, Git Workflow (branch naming, commit message format, PR process), Virtual Environment setup (Python venv/uv, Node node_modules), Comments Guidelines (when to comment, docstring format, no obvious comments). Include a `## Stack` section that gets filled during project initialization.
- `docs/commands-registry.md` — Working shell commands. Table format: Command | Purpose | Context/Notes | Date Added. Agents append here when they discover or create commands that work. Includes sections for: Setup Commands, Build Commands, Test Commands, Deploy Commands, Utility Commands.
- `docs/changelog.md` — Every change made by agents. Table format: Timestamp | Agent | Task ID | Files Changed | Summary | Commit Hash. This is append-only — never edited, only appended. The PostToolUse hook auto-populates this.

### Agent-Facing Documents (lean, token-optimized)

- `docs/agent-context/quick-ref.md` — Ultra-compressed project summary (<500 tokens). Stack, key paths, critical conventions. Agents load this by default instead of full docs.
- `docs/agent-context/file-map.md` — Auto-generated flat list of all project files with one-line descriptions. Updated by a maintenance agent.
- `docs/agent-context/active-todos.md` — Extracted from project-state.md, contains ONLY the current TODOs. This is what task-executing agents actually read. Symlinked or auto-synced.
- `docs/agent-context/gotchas.md` — Known failure points, edge cases, and recurring mistakes. Agents and humans append here when something goes wrong. This is the highest-signal document in the vault — it captures what pushes Claude off track. Format: `- **[area]**: description of gotcha and how to avoid it`. Start with an empty template; it grows organically.

All docs must start with YAML frontmatter:
```yaml
---
title: Document Title
updated: 2025-01-01
tokens_estimate: 350
agents: [all | agent-name-list]
---
```

The `tokens_estimate` field helps agents decide whether to load the full doc or just the quick-ref. The `agents` field specifies which agents need this document.

## 2. Rules (loaded every session, not optional)

Create `.claude/rules/` directory with three rule files. Rules load automatically every session — unlike skills which are on-demand. Use rules for anything that must apply consistently. Keep each file under 40 lines.

### a) `.claude/rules/identity.md`
- **Path scope:** `**` (all files)
- Tells the agent who it is, what its role is, how it relates to other agents. Prevents the "blank slate" problem.
- References `docs/agent-context/quick-ref.md` for project context.
- States: "You are working on [project]. The knowledge base is at docs/INDEX.md. Check docs/agent-context/gotchas.md before starting any task."

### b) `.claude/rules/behavioral.md`
- **Path scope:** `**` (all files)
- Hard constraints from real failures. Each rule traces to a specific failure. Start with these seed rules:
  - "Two-strike pivot: if an approach fails twice on the same mechanism, try a fundamentally different one. Do not retry the same thing a third time."
  - "Verify before asserting: run it, don't assume it works. Never tell the human a feature works unless you've tested it."
  - "Never present uncertain information as fact. If you're not sure, say so."
  - "If context exceeds 50%, dump your current state to `docs/agent-context/session-checkpoint.md` and recommend starting a fresh session."
- Leave a `## Add your own` section. The human and agents append new rules as failures occur. These compound over time — 6 months of failures encoded into 40 lines of markdown.

### c) `.claude/rules/operational.md`
- **Path scope:** `**` (all files)
- How the agent works: memory protocol (what to load, when to persist), workflow rules (use existing workflows before improvising), sub-agent dispatch rules (scoped context, not full memory).
- States: "Load quick-ref.md and active-todos.md at the start of every task. Load full docs only when quick-ref doesn't have what you need."
- States: "Move style rules and git rules into skills, not here. This file is for universal operational behavior only."

## 3. Skills (on-demand knowledge, loaded only when needed)

Create `.claude/skills/` directory with skill subdirectories. Each skill is a folder containing a `SKILL.md` file with YAML frontmatter and markdown instructions. Skills are discovered automatically and loaded on-demand based on their description — they do NOT consume context every turn like CLAUDE.md or rules. Use skills for knowledge that's only relevant at specific moments (commit time, review time, etc.).

**Design principle:** Skills encode decisions, not tasks. Decision skills compound over time; task skills get stale. If a skill fires less than once a week, delete it or fold it into a rule.

### a) `.claude/skills/gotchas/SKILL.md`
- **Description (trigger):** "Known failure points, edge cases, and recurring mistakes for this project. ALWAYS use this skill before writing or modifying code, before debugging, before implementing any feature."
- **Content:** Instructions to load `docs/agent-context/gotchas.md`, check for relevant gotchas, and report new ones
- **Preloaded by:** implementer agent (via `skills:` frontmatter — injected at startup, not on-demand)

### b) `.claude/skills/git-conventions/SKILL.md`
- **Description (trigger):** "Git workflow conventions. Use whenever creating branches, writing commit messages, preparing PRs, or doing any git operation. Trigger on commit, branch, merge, PR, push, git."
- **Content:** Branch naming (`feat/<task-id>-<desc>`, `fix/<task-id>-<desc>`), conventional commit format with types and examples, commit discipline (one change per commit, never commit broken code), PR guidelines, forbidden operations (no force push, no direct main commits)
- **Why a skill:** Git rules are only needed at git time. Putting them in CLAUDE.md wastes context on every non-git turn.

### c) `.claude/skills/code-style/SKILL.md`
- **Description (trigger):** "Coding style and conventions. Use whenever writing new code, reviewing code, refactoring. Trigger on style, convention, naming, format, lint."
- **Content:** Naming conventions (files, classes, functions, constants, booleans), comment guidelines (why not what, docstrings, no obvious comments, TODO format), error handling strategy, file organization, architecture compliance notes
- **Why a skill:** Style rules are ~1500 tokens. Loading them only during code writing/review saves significant context.

### d) `.claude/skills/commit/SKILL.md`
- **Description (trigger):** "Smart commit workflow. Use when user says commit, save my work, checkpoint my changes, or after completing a logical unit of work."
- **Content:** Step-by-step workflow: git status → git diff --stat → determine commit type → identify scope → write message → selective staging → run tests → commit. Includes example output format. Rules: never commit failing tests, never stage unrelated changes, show message to user before committing.

### e) `.claude/skills/pr-create/SKILL.md`
- **Description (trigger):** "Create a pull request. Use when user says create PR, open PR, pull request, submit for review."
- **allowed-tools:** `Bash(git *), Bash(gh *)`
- **Content:** Step-by-step: verify on feature branch → git log → git diff --stat → generate title and description from PR template → push → create via `gh pr create`. Includes a PR description template with What/Why/How/Changes/Testing/Checklist sections.

## 4. Agent Definitions

Create agents as `.claude/agents/*.md` files with YAML frontmatter. Each agent gets ONLY the tools and docs it needs. **Critical insight: sub-agents get scoped context, not your full setup. Dumping entire memory into every sub-agent burns tokens and confuses the model.** Define these agents:

### a) `researcher` (separate research from build — the #1 quality improvement)
Frontmatter:
```yaml
name: researcher
description: Research-only agent for investigating problems and writing implementation plans. Use BEFORE any implementation task. Trigger when user says "research", "investigate", "plan", or when the orchestrator needs to understand a problem before building.
tools: Read, Grep, Glob, Bash, Write
disallowedTools: Edit
model: sonnet
permissionMode: plan
effort: high
background: false
color: blue
memory: project
maxTurns: 30
hooks:
  PreToolUse:
    - matcher: "Write"
      hooks:
        - type: command
          command: ".claude/hooks/researcher-write-guard.sh"
```
System prompt must include:
- "You are a research agent. Your job is to understand a problem thoroughly and output a structured plan as a markdown file at `docs/plans/YYYY-MM-DD-{task-id}-{slug}.md`."
- "Include: problem analysis, proposed approach, files to modify, edge cases, risks, and existing code patterns to use as reference."
- "NEVER write code. NEVER modify source files. Your ONLY writable output is the plan file."
- "Before starting, check docs/agent-context/gotchas.md for known failure points."
- "Update your agent memory with codebase patterns, library locations, and architectural decisions you discover."

### b) `orchestrator`
Frontmatter:
```yaml
name: orchestrator
description: Task decomposition and agent coordination. Use when user has a feature request, bug report, or multi-step task that needs to be broken into subtasks and delegated.
tools: Read, Write, Edit, Bash, Grep, Glob, Agent(interviewer, researcher, implementer, reviewer, tester, docs-maintainer, initializer)
model: opus
effort: medium
background: false
color: purple
memory: project
maxTurns: 50
```
System prompt must include:
- **Research-first rule:** For any non-trivial task, ALWAYS dispatch the researcher agent first. Only dispatch the implementer after the plan is written and confirmed.
- If tasks ≤ 2 OR tasks have dependencies → use subagents sequentially
- If tasks ≥ 3 AND independent → suggest agent teams (with a note that this requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`)
- **Rollback-first rule:** Before starting any implementation task, commit a checkpoint. If the implementer's result fails review or tests, rollback to the checkpoint instead of trying to fix forward.
- **Plan-review loop:** For any task with 3+ subtasks, draft a plan first and present it to the human before executing. Use the guard phrase "don't implement yet" when requesting a plan from subagents.
- After each task completes, trigger changelog update
- "Suggest `/rename <task-description>` at the start of each session."
- "Consult your agent memory for orchestration patterns that worked on previous tasks."

### c) `implementer`
Frontmatter:
```yaml
name: implementer
description: Code implementation agent. Use after a research plan exists in docs/plans/. Writes code following architecture.md conventions. Trigger when user says "implement", "build", "code", or orchestrator dispatches after plan confirmation.
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
effort: high
isolation: worktree
background: false
color: green
memory: project
skills:
  - gotchas
hooks:
  PostToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: command
          command: ".claude/hooks/auto-format.sh"
```
System prompt must include:
- "Always read the plan file from `docs/plans/` before starting. Never implement from scratch without a research plan."
- "Always create a git branch before making changes: `feat/<task-id>-<short-desc>` or `fix/<task-id>-<short-desc>`"
- "Commit after each logical unit of work with conventional commit messages."
- "Add any new working commands to `commands-registry.md`."
- "Never modify docs other than commands-registry.md."
- "Before writing new code, search the codebase for similar patterns and use them as reference — Claude works better from a real reference than an abstract description."
- "Two-strike rule: if a direct attempt produces messy results after 2 tries, stop and report back to the orchestrator rather than continuing to patch."
- "Update your agent memory with patterns, workarounds, and library quirks you discover."

### d) `reviewer`
Frontmatter:
```yaml
name: reviewer
description: Code review agent. Use proactively after code changes, before merging, or when user says "review". Checks conventions, security, and quality.
tools: Read, Grep, Glob, Bash, Write
model: sonnet
effort: high
permissionMode: default
background: false
color: yellow
memory: project
hooks:
  PreToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: command
          command: ".claude/hooks/reviewer-write-guard.sh"
```
System prompt must include:
- Review checklist: correctness, security, conventions compliance (from architecture.md), test coverage, error handling, naming.
- "Output structured as Critical/Warning/Suggestion."
- "Before reviewing, check docs/agent-context/gotchas.md for known patterns."
- "If you discover a new gotcha or recurring mistake, append it to `docs/agent-context/gotchas.md` (the only file you may write to)."
- "Consult your agent memory for patterns seen in previous reviews."
- "Update your agent memory with new patterns, recurring issues, and codebase-specific conventions you notice."

### e) `tester`
Frontmatter:
```yaml
name: tester
description: Test writing and validation agent. Use after implementation to write and run tests, or when user says "test", "TDD", or "validate".
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
effort: high
background: false
color: orange
memory: project
```
System prompt must include:
- "Write tests BEFORE checking implementation details (TDD validation approach)."
- "Run tests and report results with clear pass/fail summary."
- "Add test commands to commands-registry.md."
- "Update your agent memory with testing patterns, fixture setups, and test utilities discovered in this project."

### f) `docs-maintainer`
Frontmatter:
```yaml
name: docs-maintainer
description: Knowledge base maintenance agent. Use to sync docs, update file maps, verify wiki-links, and keep documentation lean. Trigger on "/project:sync-docs" or after task completion.
tools: Read, Write, Edit, Grep, Glob
model: haiku
effort: low
background: true
color: cyan
```
System prompt must include:
- "Regenerate `file-map.md` by scanning the project tree (3 levels max)."
- "Sync `active-todos.md` from `project-state.md` — extract ONLY current TODOs."
- "Update `tokens_estimate` in all doc frontmatter."
- "Verify all `[[wiki-links]]` resolve to existing files."
- "Update `INDEX.md` if new docs were added."
- "Keep all docs as lean as possible — remove redundancy, compress prose to bullets."

### g) `initializer`
Frontmatter:
```yaml
name: initializer
description: Project initialization agent. Use once at project start to detect tech stack, set up environment, and populate the knowledge base. Trigger on "/project:init".
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
effort: high
background: false
color: pink
maxTurns: 40
```
System prompt must include:
- "Scan for package.json, requirements.txt, pyproject.toml, Cargo.toml, go.mod, etc."
- "Auto-detect stack and fill `architecture.md` → `## Stack`."
- "Create appropriate virtual environment (venv/uv for Python, npm/pnpm for Node, etc.)."
- "Initialize git if not already initialized, create .gitignore."
- "Set up `quick-ref.md` with compressed project summary (<500 tokens)."
- "Add all setup commands to `commands-registry.md`."
- "Set project-state.md status to 'Initialized'."

### h) `interviewer`
Frontmatter:
```yaml
name: interviewer
description: Requirements gathering agent. Use when the user wants to define or refine project requirements, or when project-requirements.md is empty or has "Status: Not Initialized". Trigger on "/project:interview" or when user says "help me define requirements", "what should I build", or "interview me".
tools: Read, Write, Edit, Grep, Glob
disallowedTools: Bash
model: sonnet
effort: high
background: false
color: red
maxTurns: 60
hooks:
  PreToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: command
          command: ".claude/hooks/interviewer-write-guard.sh"
```
System prompt must include:
- "You are a product requirements interviewer. Your job is to have a structured conversation with the human to extract a complete project requirements document."
- "Start by reading `docs/project-requirements.md`. If it already has content, summarize what exists and ask what needs to change. If it's empty or has 'Status: Not Initialized', start from scratch."
- "Run the interview in phases. Ask ONE question at a time. Wait for the answer before asking the next. Never dump a list of 10 questions."
- Phase 1 — Vision: "What does this project do, in one sentence? Who is it for? What problem does it solve?"
- Phase 2 — User Stories: "Walk me through what a user does from start to finish. What's the first thing they see? What actions can they take?" Generate `As a [user], I can [action]` bullets from their answers. Read them back for confirmation.
- Phase 3 — Functional Requirements: "For each user story, what does the system need to do behind the scenes? What integrations, data flows, or business logic are needed?" Group by feature area.
- Phase 4 — Non-Functional Requirements: "What tech stack? Any performance requirements? Testing expectations? CI/CD? Deployment target?"
- Phase 5 — Constraints: "What are you NOT willing to spend money on? Any timeline? Infrastructure limits? Team size?"
- Phase 6 — Out of Scope: "What are you explicitly NOT building in this version? What features are tempting but should wait?"
- "After each phase, write the results to `docs/project-requirements.md` immediately — do not wait until the end. This way, if the session is interrupted, progress is saved."
- "After all phases, read back the complete document and ask: 'Is this accurate? Anything to add, remove, or change?' Make edits based on feedback."
- "Set the Status field to 'Draft' when writing, and only to 'Approved' if the human explicitly confirms the final version."
- "Keep everything as bullet points. No prose paragraphs. Match the exact section structure: Vision, User Stories, Functional Requirements, Non-Functional Requirements, Constraints, Out of Scope."
- "If the human gives vague answers, push back with specific follow-up questions. 'Fast' is not a requirement — 'API response < 200ms' is."
- "You may ONLY write to `docs/project-requirements.md`. The hook enforces this."

## 5. Hooks

Configure in `.claude/settings.json` under the `hooks` key:

### a) PostToolUse hook — Changelog logger
- **Matcher:** `Write|Edit`
- **Type:** command
- **Script:** `.claude/hooks/log-change.sh`
- The script reads the JSON from stdin, extracts `tool_input.file_path`, the session ID, and a timestamp. It appends a row to `docs/changelog.md`. Format: `| {ISO timestamp} | {agent_type or "manual"} | {task_id from env or "N/A"} | {file_path} | {tool_name} operation | {git hash or "uncommitted"} |`
- Write this shell script. It must read stdin with `cat`, parse with `jq`, and append to the changelog. Make it fail gracefully (exit 0) if jq is missing or the file doesn't exist yet.

### b) PostToolUse hook — Auto-format (NOTE: also defined in implementer agent frontmatter for scoped execution)
- **Matcher:** `Write|Edit`  
- **Type:** command
- **Script:** `.claude/hooks/auto-format.sh`
- Detects file extension and runs the appropriate formatter if available (black/ruff for .py, prettier for .js/.ts/.jsx/.tsx/.css/.html, gofmt for .go). Exits 0 silently if no formatter is found.
- This hook runs globally AND is also defined in the implementer's frontmatter so it fires even when the implementer runs in an isolated worktree.

### c) Stop hook — Task completion sync
- **Matcher:** (none — fires for all agents)
- **Type:** command
- **Script:** `.claude/hooks/on-task-complete.sh`
- When any agent stops, this hook:
  - Checks if `stop_hook_active` is true (to avoid infinite loops) and exits 0 if so
  - Otherwise, appends a summary line to `docs/changelog.md` marking task completion
  - Exits 0 (does not block)

### d) SessionStart hook — Context loader
- **Type:** command  
- **Script:** `.claude/hooks/load-context.sh`
- On session start, reads `docs/agent-context/quick-ref.md` and outputs it to stdout as `additionalContext` so the agent gets project context automatically.

### e) PreToolUse hook — Git safety checkpoint
- **Matcher:** `Bash`
- **Type:** command
- **Script:** `.claude/hooks/git-checkpoint.sh`
- Before any Bash command that contains `git merge`, `git rebase`, or destructive operations (`rm -rf`, `drop`, `truncate`), create an automatic checkpoint: `git stash push -m "auto-checkpoint-$(date +%s)"` or tag the current HEAD. Exit 0 to allow the command to proceed. This gives a rollback point for every risky operation.
- For non-destructive commands, exit 0 immediately (fast path).

### f) PreToolUse hook — Reviewer write constraint (defined in reviewer agent frontmatter)
- **Matcher:** `Write|Edit`
- **Type:** command
- **Script:** `.claude/hooks/reviewer-write-guard.sh`
- Reads stdin JSON, extracts `tool_input.file_path`. If the path is `docs/agent-context/gotchas.md`, exit 0 (allow). Otherwise, exit 2 with stderr message "Reviewer agent is read-only except for gotchas.md". This hook is defined in the reviewer agent's frontmatter `hooks:` block, not globally.

### g) PreToolUse hook — Researcher write constraint (defined in researcher agent frontmatter)
- **Matcher:** `Write`
- **Type:** command
- **Script:** `.claude/hooks/researcher-write-guard.sh`
- Reads stdin JSON, extracts `tool_input.file_path`. If the path starts with `docs/plans/`, exit 0 (allow). Otherwise, exit 2 with stderr message "Researcher agent may only write to docs/plans/". Defined in the researcher agent's frontmatter `hooks:` block.

### h) PreToolUse hook — Interviewer write constraint (defined in interviewer agent frontmatter)
- **Matcher:** `Write|Edit`
- **Type:** command
- **Script:** `.claude/hooks/interviewer-write-guard.sh`
- Reads stdin JSON, extracts `tool_input.file_path`. If the path is `docs/project-requirements.md`, exit 0 (allow). Otherwise, exit 2 with stderr message "Interviewer agent may only write to docs/project-requirements.md". Defined in the interviewer agent's frontmatter `hooks:` block.

## 6. Slash Commands

Create `.claude/commands/`:

- `init.md` — Runs the initializer agent to set up a new project. Content: "Use the initializer agent to detect the project stack, set up the development environment, and populate the knowledge base. Then use the docs-maintainer agent to generate the initial file map."

- `interview.md` — Guided requirements gathering. Content: "Use the interviewer agent. It will walk me through a structured interview to define project requirements and write them to docs/project-requirements.md. Ask one question at a time. Save progress after each phase."

- `plan.md` — Enters plan mode. Content: "Read docs/project-requirements.md and docs/project-state.md. Based on the requirements and current state, create a prioritized list of tasks. Write them to docs/project-state.md as TODOs. Do NOT implement anything."

- `work.md` — Starts the orchestrator on the next priority task. Content: "Use the orchestrator agent. Read docs/agent-context/active-todos.md and pick the highest-priority unfinished TODO. First dispatch the researcher agent to investigate and write a plan to `docs/plans/`. Present the plan to me for confirmation. Only after I confirm, dispatch the implementer to execute the plan. After completion, dispatch the reviewer, then update project-state.md and run the docs-maintainer agent."

- `research.md` — Research-only session. Content: "Use the researcher agent. Read the task description I provide. Investigate the codebase, explore relevant files, and output a structured plan to `docs/plans/YYYY-MM-DD-{task-id}-{slug}.md`. Do NOT implement anything. End by summarizing the plan and asking if I want to proceed to implementation."

- `review.md` — Reviews recent changes. Content: "Use the reviewer agent to review all uncommitted changes or changes since the last review tag. Output a structured report."

- `sync-docs.md` — Manually triggers docs maintenance. Content: "Use the docs-maintainer agent to update file-map.md, sync active-todos.md, verify wiki-links, and update token estimates."

- `status.md` — Shows project status. Content: "Read and display docs/project-state.md. Show: current phase, completed task count, active TODOs, and blocked items. Also show the last 5 entries from docs/changelog.md."

- `checkpoint.md` — Creates a named rollback point. Content: "Create a git tag `checkpoint-$(date +%Y%m%d-%H%M%S)` at current HEAD. Also dump a summary of the current session's work to `docs/agent-context/session-checkpoint.md` including: what was done, what's in progress, what's next. This file can be used to resume in a fresh session if context degrades."

- `rollback.md` — Rolls back to the last checkpoint. Content: "List all git tags matching `checkpoint-*`, show the most recent 5. Ask the human which one to roll back to. Then `git reset --hard <tag>` and update project-state.md to reflect the rollback. Mark any TODOs that were 'In Progress' back to 'Pending'."

- `fresh.md` — Starts a fresh session from a checkpoint file. Content: "Read docs/agent-context/session-checkpoint.md if it exists. This contains the state from a previous session. Use it as context to continue where the previous session left off. Read active-todos.md for the current task list."

**Session naming convention:** Add a note in CLAUDE.md instructing agents to suggest `/rename <task-description>` at the start of each work session so sessions are findable later via `/resume`.

## 7. Settings

Create `.claude/settings.json` with:
- The hooks defined above
- `permissions.allow` for the tools each agent needs
- A comment block at the top explaining how to enable agent teams: set `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in environment

Create `.claude/settings.local.json.template` (for per-developer overrides) with placeholder values.

## 8. CLAUDE.md

Create a root `CLAUDE.md` that is strictly agent-facing (no human instructions here). **Keep it under 200 lines** — community consensus is that CLAUDE.md instructions are followed ~70% of the time, and compliance drops as the file grows. Use hooks (not CLAUDE.md) for anything that must happen 100% of the time. **Critical:** CLAUDE.md is injected on EVERY turn, consuming context every time. So it must be small and universally relevant. Move git style rules, coding conventions, and formatting rules into skills that load only when needed (e.g., a `git-conventions` skill that loads at commit time, a `style` skill that loads during code review). It must contain:
- Knowledge base entry point: `docs/INDEX.md`
- Available slash commands: `/project:init`, `/project:plan`, `/project:work`, `/project:review`, `/project:sync-docs`, `/project:status`
- Golden rules (enforced behavior):
  1. Never modify docs without going through the docs-maintainer agent (except commands-registry.md)
  2. Always branch before implementing
  3. Always run tests before marking a task complete
  4. Keep context lean — load quick-ref.md, not full docs, unless you need specifics
  5. Log every file change to changelog.md (enforced by hooks)
  6. Use conventional commits
  7. **Context window discipline:** Do NOT let context exceed 60% capacity. If working on a long task, dump progress to a markdown file and start a fresh session reading that file rather than using /compact (you control what survives, /compact is lossy)
  8. **Rollback over fix-forward:** If an implementation attempt fails review, git rollback and retry from scratch rather than patching. Fresh attempts succeed more often than corrections in a degraded context.
- Agent routing table: which agent handles what type of task (so the orchestrator and any ad-hoc session know where to delegate)
- **Gotchas section:** Link to `docs/agent-context/gotchas.md` and instruct all agents to check it before starting work. This is the highest-signal content in the project.
- Do NOT include any human-facing instructions, setup guides, or explanations in this file

## 8b. HUMAN.md

Create a `HUMAN.md` in the project root with human-facing instructions:
- What this workflow is and how it works (brief overview)
- How to open `docs/` in Obsidian to browse the knowledge graph
- Available slash commands and when to use each one
- How to define requirements: either `/project:interview` (guided) or edit `docs/project-requirements.md` manually
- Typical workflow: interview/requirements → `/project:init` → `/project:plan` → `/project:work` → `/project:review`
- How to check progress with `/project:status`
- Team usage: how multiple developers can work simultaneously using git worktrees for isolation, each running their own Claude Code session on different tasks
- How to enable agent teams: set `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
- Troubleshooting: what to do if hooks fail, how to reset docs, how to re-run the initializer

## 9. Execution Order

Do everything in this order:
1. Create the directory structure: `docs/`, `docs/agent-context/`, `docs/plans/`, `.claude/`, `.claude/agents/`, `.claude/commands/`, `.claude/hooks/`, `.claude/rules/`, `.claude/skills/gotchas/`, `.claude/skills/git-conventions/`, `.claude/skills/code-style/`, `.claude/skills/commit/`, `.claude/skills/pr-create/`
2. Create all doc templates (with placeholder content and proper frontmatter)
3. Create all rule files in `.claude/rules/`
4. Create all skill SKILL.md files in `.claude/skills/*/`
5. Create all agent definition files in `.claude/agents/`
6. Create all hook scripts in `.claude/hooks/` (make them executable with chmod +x)
7. Create all slash command files in `.claude/commands/`
8. Create settings.json with hooks configured
9. Create CLAUDE.md (agent-only, no human instructions)
10. Create HUMAN.md (human-only setup and usage guide)
11. Run a self-test: verify all hook scripts are executable, all agent files have valid frontmatter, all skill folders contain SKILL.md, all wiki-links in INDEX.md point to existing files
12. Git init and make an initial commit with message "chore: scaffold multi-agent workflow"

Do NOT skip any step. Do NOT combine files. Create each file individually. After creating each hook script, verify it's executable.
```

---

## How to Use This After Scaffolding

1. **Open `docs/` in Obsidian** to browse the knowledge graph visually
2. **Run `/project:interview`** to have Claude walk you through defining requirements (or edit `docs/project-requirements.md` manually)
3. **Run `/project:init`** to auto-detect your stack and set up the environment
4. **Run `/project:plan`** to generate a task list from requirements
5. **Run `/project:work`** to start executing tasks via the agent pipeline
6. **Run `/project:status`** anytime to check progress
7. **Run `/project:review`** before merging branches

## Token Optimization Summary

| Agent | Model | Effort | Memory | Isolation | Background | Color |
|---|---|---|---|---|---|---|
| interviewer | sonnet | high | — | — | no | red |
| researcher | sonnet | high | project | — | no | blue |
| orchestrator | opus | medium | project | — | no | purple |
| implementer | sonnet | high | project | worktree | no | green |
| reviewer | sonnet | high | project | — | no | yellow |
| tester | sonnet | high | project | — | no | orange |
| docs-maintainer | haiku | low | — | — | yes | cyan |
| initializer | sonnet | high | — | — | no | pink |

**Why these choices:**
- **Memory: project** on researcher, orchestrator, implementer, reviewer, tester — accumulated knowledge is shared via version control and compounds across sessions. Docs-maintainer and initializer don't need cross-session memory.
- **Isolation: worktree** on implementer only — prevents merge conflicts when multiple implementations run in parallel. Other agents either don't write files or write to docs only.
- **Background: true** on docs-maintainer only — it can run concurrently without blocking. All other agents need human interaction or produce results the next agent depends on.
- **Effort: high** on agents doing substantive work. Medium on orchestrator (it delegates, not executes). Low on docs-maintainer (simple file operations).
- **Colors** chosen for visual distinction in the Claude Code UI task list.

## Key Design Decisions

- **Obsidian-compatible markdown** — zero dependencies, human-browsable, agent-readable, version-controllable
- **`quick-ref.md` as the default context** — agents load ~500 tokens instead of ~5000, massive savings over long sessions
- **Rules vs Skills vs CLAUDE.md** — three-tier context system: CLAUDE.md (injected every turn, <50 lines, universal), rules (loaded every session, behavioral constraints), skills (on-demand, loaded only when relevant). Git/style rules live in skills to avoid polluting every turn.
- **PostToolUse changelog hook** — every file write is logged automatically, no agent discipline required
- **Subagents by default, teams when parallel** — subagents are stable and give per-agent model control; agent teams are opt-in for ≥3 independent tasks
- **Slash commands as the human interface** — developers don't need to remember agent names, just `/project:work`
- **Agent memory (project scope)** — orchestrator and implementer accumulate project knowledge across sessions via `.claude/agent-memory/`
- **Skills preloaded via frontmatter** — the implementer's `skills: [gotchas]` injects gotchas at startup without the agent needing to discover and load it. Other skills (git-conventions, code-style, commit, pr-create) are auto-triggered by Claude based on task context.

## Community-Sourced Improvements (r/ClaudeCode, April 2026)

**From the "Please share your full Claude setup" thread (206 upvotes, 52 comments):**

- **Rules over skills for consistency** (Livid-Variation-631, 24 upvotes) — `.claude/rules/` loads automatically every session. Skills are on-demand. If you put everything in skills, consistency is opt-in. Three rule files: Identity (who the agent is), Behavioral (hard constraints from real failures), Operational (memory protocol, dispatch rules). Behavioral rules are the most valuable — each traces to a specific failure. They compound over 6 months into ~40 lines of high-signal markdown.
- **Separate research from build sessions** (Livid-Variation-631) — "The single biggest quality improvement." Research session outputs a plan to a markdown file. Build session reads the plan and executes. Added the `researcher` agent for this.
- **KISS at enterprise scale** (puppymaster123, hedge fund, 120+ devs) — "No MCPs, no skills. Just keep CC to code." Good git conduct as a team agreement, then give it to CC as a new team member. Too many integrations create noise.
- **"Slow is smooth, smooth is fast"** (Long_War8748, 20 upvotes) — Pair-programmer style beats orchestration fleets. "The debt you accumulate with fleets of agents can be gigantic." Our workflow supports both: `/project:work` for orchestrated flow, or just talk directly to Claude for pair-programming.
- **Skills should encode decisions, not tasks** (_Stonk) — Decision skills compound, task skills get stale. "If a skill fires less than once a week, delete it." Collapse overlapping skills. Sequence them into a pipeline rather than picking à la carte.
- **Context below 10%** (Specialist_Wishbone5, 30-year veteran) — Even more aggressive than the 60% rule. Uses shift-tab-tab to start new plans. "Success is about context-whispering." CLAUDE.md is injected every turn, so move everything non-universal into skills.
- **Memory to dated markdown files** (Patriark) — `YYYY-MM-DD-{task-id}-{slug}.md` pattern. Our `docs/plans/` and `docs/changelog.md` follow this pattern.
- **Build verification UIs, not more skills** (DisciplineIll2647, large ecommerce) — "Automate checking, not coding. Results first, code second." Build tools that verify requirements are met. Tests should come from YOUR understanding, not the agent's.
- **Session handoff files** (brek001) — Required read at start, required update at end. "Make sure Claude remembers this, it tends to forget." Our `session-checkpoint.md` and `/project:fresh` command support this.

**Patterns we deliberately did NOT adopt:**
- No MCP integrations in the base scaffold (per KISS principle). Teams add their own as needed.
- No custom terminal emulator recommendation (Warp, Zellij, iterm2, tmux all have advocates — it's personal preference).
- No d2/mermaid charting in the base workflow (good addition for specific projects, not universal).
