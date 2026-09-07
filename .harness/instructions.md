# Project Schema — Wiki-Driven Development

This is a reusable development template for Claude Code, Codex, and Antigravity
CLI. The wiki is the application spec; `.harness/` is the canonical source for
the agent workflow. Generated harness files are delivery artifacts.

## Start every session

1. Read the behavioral rules included below.
2. Before implementation, read `docs/wiki/gotchas.md`, `docs/wiki/todos.md`, the
   matching entity Behavior cases, and relevant requirements and architecture.
3. Search `docs/wiki/` for related concepts and decisions before changing behavior.
4. Load only relevant skills. If a harness does not expose a skill loader, read
   `.harness/skills/<name>/SKILL.md` and its required supporting files directly.
5. Follow the current user's scope. When maintaining this uninitialized template,
   keep `docs/wiki/` and `docs/raw/` scaffolds blank: do not add migration todos,
   requirements, entities, ADRs, transcripts, or log entries. Put maintenance
   evidence in tests and commit messages. Project initialization fills these pages
   only from the adopting project's facts and the human's answers.

<!-- conductor-only:start -->
## Canonical authoring

Edit `.harness/project.md` for project identity and `.harness/instructions.md` for
shared operating instructions, plus `.harness/rules/`, `.harness/commands/project/`,
`.harness/skills/`, `.harness/agents/`, `.harness/templates/`, and
`.harness/worker-contract.md`. Engine, model, reasoning, and role overrides live
once in `.harness/settings.json`, which the coordination server reads at dispatch.
After any edit, run
`node scripts/sync-harness.mjs`, then `node scripts/sync-harness.mjs --check` and
`node --test tests/harness.test.mjs`. Commit source and generated outputs together.
Never edit `AGENTS.md`, `CLAUDE.md`, `.claude/skills/`, or `.agents/skills/`
directly. Commands and agents generate no files at all: the server serves
commands as MCP prompts, and a worker's role is prepended to its prompt.
Do not replace user-owned settings files. See `docs/harnesses.md` for the mapping.

## Workflow and delegation

The interactive conductor uses the coordination MCP server for every worker
dispatch, status check, cancellation, and local integration. Read and follow
`.harness/skills/mcp-coordination/SKILL.md`. There is no native delegation path:
no agent files are generated, so MCP dispatch is the only way to run a worker.
All project commands are conductor-only. If MCP is unavailable, report the blocker.

One developer owns Spec → Red → Green → Refactor → wiki update. The conductor
dispatches a read-only planner before complex/batched work and an independent
read-only adversary afterwards. This explicitly authorizes those worker roles.
Each worker receives an isolated worktree at committed HEAD, bounded context,
explicit owned paths, and the canonical worker contract. It never recursively
orchestrates, changes branches, pushes, opens PRs, or cleans up worktrees.

Use `get_settings()` to inspect the actual role configuration. Default engine
selection inherits the conductor CLI; per-role engine/model/reasoning overrides
are configured in `.harness/settings.json`. Prefer a different model for
adversarial review when available. If the resolved models are the same, preserve
fresh context and disclose reduced model independence. No profile authorizes
silently switching providers, installing a CLI, or bypassing CLI permissions.

The planner and reviewers return complete reports; the conductor persists scratch
mailboxes and passes plans inline to dependent workers. Ignored scratch is not
shared across worktrees. `wiki-maintainer` is manual only through
`{{cmd:wiki-lint}}` or an explicit human request; never auto-dispatch it.
Noninteractive workers return blockers at human checkpoints. The conductor asks
through the available question mechanism or plain conversation.

Local worker merges are controlled by MCP after verification, with expected
target and worker SHAs. The conductor owns pushing the integration branch and
opening feature PRs; the human owns remote PR merges. Worktrees prevent ordinary
file collisions but are **not security sandboxes**: permissions still apply and
the Git store and credentials may be shared.

<!-- conductor-only:end -->

## Files and shell commands

Paths written in backticks are repository-root paths unless explicitly relative.
Markdown links are navigation, not file inclusion. Read linked instructions when
directed. Only `CLAUDE.md` uses a native `@` import; other prompt content is expanded
by the generator. Do not assume `@path` or shell interpolation works in arbitrary
agent or skill bodies. Shared skills take the user's trailing context as their
argument, including spaces, quotes, Unicode, and newlines. Forward it verbatim
when delegating; never interpolate it into shell command text.

Shell examples labeled `bash` require Bash (Git Bash on Windows), not PowerShell.
Use the active shell's equivalents where necessary, preserving error checks and
quoting. The template's Node.js checks run directly in either shell. Do not confuse
template checks with the adopting application's test command.

## Wiki map

- `docs/raw/`: immutable input; append new project sources, never edit old sources.
- `docs/wiki/requirements.md`: what the application must do.
- `docs/wiki/architecture.md`: stack, layout, patterns, testing strategy.
- `docs/wiki/entities/`: feature/module specs and Behavior cases.
- `docs/wiki/concepts/`, `decisions/`, `summaries/`: patterns, ADRs, source summaries.
- `docs/wiki/design-system.md`: UI-only design contract, created when needed.
- `docs/wiki/commands.md`: verified application commands.
- `docs/wiki/todos.md`, `gotchas.md`, `log.md`, `wiki-todos.md`: work, traps, history,
  deferred wiki maintenance. Closed todos are removed; git records shipped work.

The wiki follows the Obsidian LLM-wiki standard in
`.harness/skills/wiki-update/SKILL.md`. Navigation uses the directory tree and graph;
there is no hand-maintained wiki index or glossary. Stack knowledge belongs in
skills, not additional domain agents. Evolve the toolkit through `update-toolkit`.
