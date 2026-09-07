# Agentic Development Template

A shared development workflow for **Claude Code, Codex, and Antigravity CLI**,
coordinated over MCP. The wiki defines the application; one developer owns the
test-first cycle; skills load as needed; independent agents plan and review
complex changes.

One canonical source in `.harness/` drives every engine. An interactive
**conductor** dispatches headless **workers** through a local MCP server, each in
its own Git worktree, and integrates their commits only after review.

## Start a project

Use GitHub's **Use this template** or extract a source archive into a new project.
Open that directory with `claude`, `codex`, or `agy`, then install and register
the coordination server once:

```text
npm ci --prefix tools/coordination-mcp
node scripts/configure-mcp.mjs
```

That registers the server for all three CLIs without overwriting your own config,
and prints what it changed. Approve project trust / MCP access in each client
afterwards. Node.js 22 or newer is required for the toolkit itself, independently
of your application's stack.

Commands are MCP prompts, so **one name works in every CLI** — there are no
per-harness command files to keep in step:

| Ask the conductor for | Prompt name |
| --- | --- |
| "run project-init" | `project-init` |
| "run project-interview for the login feature" | `project-interview` |
| "run project-work" | `project-work` |

Plain conversation works everywhere: the conductor calls `get_workflow("work")`
and follows what it returns. Where a CLI lists MCP prompts as slash commands they
can be picked directly — Claude Code spells that `/mcp__coordination__project-work`.
Because commands live in the server, they require it to be running.

Initialization detects the adopting project's stack, asks for missing facts,
fills the blank wiki scaffolds, verifies an application test command, and
personalizes `.harness/project.md`. The template ships no project requirements,
todos, decisions, or operational history.

All nine workflows appear in the generated [command catalog](AGENTS.md#command-catalog).
Read [getting started](docs/getting-started.md) for the full workflow or
[HUMAN.md](HUMAN.md) for the day-to-day guide.

## How work is dispatched

The conductor never edits your checkout on a worker's behalf. Each dispatched
task gets an isolated worktree at `.worktrees/<task-id>` (gitignored), created
from committed `HEAD`:

| Tool | Purpose |
| --- | --- |
| `list_roles` | Discover roles, their access level, and the model/effort each resolves to |
| `spawn_worker` | Launch one bounded task in a fresh worktree; returns immediately |
| `check_worker_status` / `read_worker_log` | Poll outcome, commits, and full logs |
| `kill_worker` | Cancel a task, preserving its branch, worktree, and logs |
| `merge_and_cleanup_worker` | SHA-pinned integration after review, then cleanup |
| `get_settings` / `get_workflow` | Read configuration and canonical command bodies |

Guarantees are enforced at the Git layer, not by trusting a CLI's flags: a
read-only worker that produced commits is rejected, so is a worker that wrote
outside its declared `owned_paths` or a merge whose target moved. Workers cannot
dispatch other workers — the mutating tools are not registered in a worker
process. Worktrees isolate files, **not** credentials or the Git object store;
they are not a security sandbox.

## Change the workflow once

The editable source is **`.harness/`**. Skills are generated and committed, so a
fresh checkout has them without running anything.

```text
node scripts/sync-harness.mjs
node scripts/sync-harness.mjs --check
node --test tests/harness.test.mjs tests/mcp-setup.test.mjs
npm test --prefix tools/coordination-mcp
```

CI runs all of these on Windows and Linux.

| Edit | Purpose |
| --- | --- |
| `.harness/project.md` | Project identity and confirmed context |
| `.harness/instructions.md`, `.harness/rules/` | Shared instructions and constraints |
| `.harness/commands/project/` | Human-invoked workflows, served as MCP prompts |
| `.harness/skills/` | Procedures and supporting files |
| `.harness/agents/` | Portable roles, model profiles, access intent |
| `.harness/settings.json` | Engine/model/effort defaults, per-role overrides, worker limits |

Generated outputs are just `AGENTS.md`, the importing `CLAUDE.md`, and skills for
both discovery roots (`.claude/skills` for Claude Code, `.agents/skills` for Codex
and Antigravity) — 36 files in total. Commands and agents generate nothing: the
coordination server serves commands as MCP prompts, and every worker receives its
role because `manager.spawn` prepends the canonical role body to the prompt.
Do not edit generated copies: the generator detects manual edits, updates
registered files, and removes retired outputs — pruning empty directories —
while preserving unrelated settings and files.

Per-role models are edited in `.harness/settings.json`, where all six roles ship
with explicit slots. `null` means inherit. A malformed override fails loudly
rather than silently falling back, and `list_roles` reads back what each role
actually resolves to.

## Add another CLI

Everything engine-specific lives in one module per engine under
`tools/coordination-mcp/engines/`. The control plane carries no engine names.

1. Write `engines/<name>.mjs` exporting `{ name, efforts, buildArgs }` — and
   nothing else, since commands and agents generate no files to emit.
2. Register it in `engines/index.mjs` — one import, one array entry.
3. Add an `engines.<name>` block to `.harness/settings.json`.

The conformance suite then holds the new adapter to the same contract as the
others: shell-free argv, hostile paths passed as single arguments, read-only
distinguished from write, a declared effort vocabulary, and no permission-bypass
flags. See [harness details](docs/harnesses.md) for the full map, per-engine
permission behaviour, and what remains unverified.

## Development principles

- The wiki is the spec; code and wiki changes ship together in adopting projects.
- Behavior cases lead to failing tests, minimal implementation, and refactoring.
- Complex work gets a planner and an adversary in independent contexts.
- Reviewers return findings; the caller records them and the human directs fixes.
- Skills contain project procedures; domain knowledge does not require new agents.
- Maintaining this template preserves blank wiki and raw-source scaffolds.

MIT — see [LICENSE](LICENSE).
