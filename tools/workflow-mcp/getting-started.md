# Getting Started

From a fresh template (or an adopted project) to a first shipped feature, plus what to do when something goes wrong. The rules and command catalog the agent itself reads are in [`AGENTS.md`](../../AGENTS.md).

## Setup

**New project** — no code or history yet:

```bash
git clone <this-template> my-project
cd my-project
rm -rf .git        # the template's history is not your project's; /project:init starts a fresh one
claude
```

**Existing project** — never touch its `.git`. From a template checkout, run `bash scripts/adopt.sh /path/to/project`: it copies `.agents/` and `tools/workflow-mcp/`, installs the server's dependencies, writes `.mcp.json` and the per-project plugin marketplace, registers the server with `codex`/`agy` if installed, and prints anything left to merge by hand. Then start your CLI in the project.

Optional: replace `LICENSE`; open `docs/wiki/` in [Obsidian](https://obsidian.md/) as a view of the agent's memory; review which engine and model runs each role with `node tools/workflow-mcp/config-ui.mjs` ([config.md](config.md)) — `/project:init` asks about it too. On a new machine, [conductor-e2e.md](conductor-e2e.md) confirms workers can actually run.

## The commands

| Command | When | What happens |
| --- | --- | --- |
| `/project:init` | Once, at the start | Verifies the wiring, sets engines and models per role, interviews you on whatever the wiki doesn't answer, scaffolds `docs/wiki/` with real content, bootstraps a test command that runs (asking before creating the minimal manifest and empty test directory), installs an architecture check proven to fail, sets up CI, creates `develop`. On an existing codebase it detects the stack instead of assuming a blank slate; old docs are folded in afterwards with `/project:wiki <path>`. |
| `/project:interview` | A new feature, a changed requirement, a plan to stress-test | One question at a time, each with a recommended answer; the transcript is streamed to `docs/raw/interviews/`; then requirements, entity Behavior cases and todos are updated. |
| `/project:work` | Most days | Takes the top todo and runs one cycle — below. |
| `/project:adversary` | Before calling a change done that `/project:work` didn't review | A second model reviews the diff with none of the author's context; every finding is answered in writing. |
| `/project:review` | Every ~5 todos, before a release | A whole-repo audit in a fresh context: drift, missing tests, security, performance. Criticals and warnings become todos; drift goes to `wiki-todos.md`. |
| `/project:wiki <source>` | A new document, or `search for <topic>` | Ingests one source into a `summaries/` page, cross-linked, contradictions flagged on both sides. |
| `/project:wiki` | When `wiki-todos.md` piles up, or after heavy ingest | The health pass: the maintainer queue, orphans, broken links, contradictions, and re-triage of filed review findings. |
| `/project:sync-template` | In an adopted project, when the template has fixes | Pulls the generic workflow from a template checkout, never your config or wiki. |

### One `/project:work` cycle

1. **Pick and branch.** The top todo (or 2–3 sharing an entity, as a confirmed batch) on `feat/<slug>` from `develop`.
2. **Plan** — only for a `[complex]` todo or a batch: a read-only `planner` returns a plan, saved as gitignored scratch in `.handoff/`.
3. **Pre-flight review, every cycle.** A read-only `plan-adversary` attacks the brief — the plan, or the todo line — before any test: a case no step covers, a step that can't fail first, an instruction with two readings. Findings are applied to the brief, escalated to you when the spec itself is wrong, or rejected with a reason, and recorded in the cycle's log entry.
4. **Red → Green → Refactor, one Behavior case at a time.** The `developer` works in an isolated worktree, writes the failing test, confirms it fails for the right reason, writes the minimal code, refactors and ticks the case on its entity page. It runs no git: the conductor proves the case with one command (the suite and the architecture check pass with the implementation; reverting it, the tests must fail), and **commits and pushes each case** itself.
5. **Diff review** — `[complex]` or batched cycles only: a read-only `adversary` on a second model reviews the new commits. Findings are **filed as todos** by default; a `critical`/`major` comes to you to fix now or queue. Every disposition is written into the commit that answers it (`git log --grep="adversary round"`).
6. **Log, and PR when done.** The conductor adds the cycle's log entry; once every case on the entity is `[x]` it runs `verify.mjs`, opens a PR to `develop`, and returns to `develop`. Merging is yours.

Two failures on the same approach trigger the **two-strike rule**: the agent tags a checkpoint, stops, and asks you — reset and re-spec, or try a different approach (a complex todo gets a fundamentally different plan).

## Everyday situations

| You want to… | Do this |
| --- | --- |
| Add a feature | `/project:interview` the feature → confirm the todo landed in `todos.md` → `/project:work`. |
| Ship something too big to attack directly | Tag its todo `[complex]` so `/project:work` plans and reviews it. |
| Run several small related todos | Let `/project:work` propose a batch: one branch, plan and PR, still one commit per case. |
| Fix a bug | Add a Behavior case that reproduces it (the next free `B<N>`; shipped cases are never edited) and a todo, then `/project:work` — Red first, and a gotcha if the cause was surprising. |
| Change the plan before code is written | Tell the conductor before the developer dispatch; it edits the `.handoff/` plan, which is what gets sent. |
| Add a missing procedure | Ask for a skill via `update-toolkit` — a procedure improvised twice is a missing skill. |
| See where things stand | `git status`, `git log --oneline -10`, `git tag -l 'checkpoint-*'`, the top of `todos.md`, the tail of `log.md`. |

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `/project:work` refuses to start | `commands.md § Test` is `<TBD>` or errors. Re-run `/project:init` (step 5a bootstraps a runnable command). |
| The developer won't start | The entity page is missing or has no `## Behavior` cases — `/project:interview` first. |
| A role runs the wrong engine or model | `node tools/workflow-mcp/config-ui.mjs` shows what each role will run, and edits it; [config.md](config.md) is the reference. |
| A role's CLI isn't installed | `check` lists the undispatchable roles. Give the role a fallback chain (`"engine": ["codex", "claude"]`) or pass `cli_engine` for one dispatch. |
| An agy worker exits 0 with an empty report | A command grant is missing: call `grant_antigravity_setup` ([engine-setup.md](engine-setup.md)). |
| A worker is stopped at `workerTimeoutSeconds` (exit 124, `inspect_dispatch` names it) | The runner stops every engine, and every process it started, at the limit. Narrow the brief first; raise the limit only for a task that genuinely needs longer. |
| The conductor's shell tool returns before the worker finishes | The worker is still running: its record says `running` until the runner exits. Run dispatches in the background and wait for completion; never compose into the task meanwhile. |
| The adversary says only "looks good" | An unexplained pass is a failed review: re-dispatch demanding the `Checked:` line. |
| Review rounds keep producing findings | Three rounds is the cap; after it, criticals and majors are filed and the range is split next time. |
| `sync` or `check` reports no drift but the new content is missing — or the server rejects something the files on disk accept | The MCP server caches its own source for the life of the session, so edits to `tools/workflow-mcp/` (or a `/project:sync-template`) don't reach it. Regenerate directly — from `tools/workflow-mcp/`: `node -e "import('./generate.mjs').then(m => m.generate('<repo-root>'))"` (forward slashes), confirm with a grep — and restart the session to reload the server. |
| No `mcp__workflow__*` tools, or `claude plugin list` lacks `project@workflow-<dir>` | `.mcp.json` must register `workflow`, and `.claude-plugin/marketplace.json` must exist at the project root — without it the plugin never registers and no restart helps. Copy it from the template, set its `name`, match `.claude/settings.json`, restart once. |
| Skills load from another project's checkout (their `Base directory` is elsewhere) | Two projects share a marketplace name, and Claude Code keeps one per name per machine. Use `workflow-<dir-name>` in `.claude-plugin/marketplace.json` and both `.claude/settings.json` keys (`extraKnownMarketplaces`, `enabledPlugins`), then restart. |
| The `workflow` server fails to start under codex or agy (`MODULE_NOT_FOUND`) | The registration used relative paths, and the CLI spawns the server from another directory. Codex: use the project-local `.codex/config.toml` `scripts/adopt.sh` writes (absolute paths, gitignored). agy: its registration is machine-global (antigravity-cli#60), so register with absolute paths — `agy mcp add workflow node <abs>/tools/workflow-mcp/server.mjs --root <abs> --engine antigravity` — and again whenever you switch projects; two agy sessions in different projects collide. |
| After testing `scripts/adopt.sh` on a scratch directory, agy dispatches against the wrong project | The script's `agy mcp add` overwrote the global registration. Re-register the real project, or hide `agy` from `PATH` for such runs. |
| `Cannot find module 'C:/…/run-worker.mjs'` when running a dispatch command | It ran under WSL, whose node cannot see Windows paths. Run it from a shell on the machine that holds the checkout — Git Bash, PowerShell or cmd on Windows. |

## Habits that break the loop

- **A feature without `/project:interview`.** Behavior cases are what make tests sharp.
- **Editing `docs/raw/`.** Add a new source instead.
- **Committing on `main` or `develop` directly.** `/project:work` branches for you.
- **Leaving findings unanswered.** Each is filed, fixed with your approval, or rejected with a reason.
- **Treating the plan as the spec.** The plan is one cycle's scratch; the entity page is the contract — change that through `/project:interview`.
