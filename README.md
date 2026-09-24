# Agentic Development Template

A template for building software with an LLM agent as the developer, across Claude Code, Codex and Antigravity: wiki-driven, spec + TDD, progressive disclosure.

## Three ideas

1. **The wiki is the spec.** `docs/wiki/` is the source of truth for what the project does and how it is built. Code that disagrees with the wiki is the bug.
2. **Progressive disclosure beats specialized agents.** One `developer` runs the whole TDD cycle, loading short, procedural, project-specific skills on demand.
3. **One canonical source, no copies.** The workflow lives in `.agents/` and every CLI reads it there. Workers get one composed prompt and no ambient project context, so the workflow behaves the same whichever CLI runs it.

## Quick start

**New project** — no code or history yet:

```bash
git clone <this-template> my-project
cd my-project
rm -rf .git    # drop the template's history — /project:init starts your own
claude
```

**Existing project** — never touch its `.git`. From a checkout of this template:

```bash
bash scripts/adopt.sh /path/to/my-existing-project
```

It copies `.agents/` and `tools/workflow-mcp/` (without `node_modules/` or the template-only `test/` suite), installs the server's dependencies, writes `.mcp.json` and a per-project plugin marketplace, registers the server with `codex`/`agy` if installed, and creates `.claude/settings.json` — or, if one exists, prints the two keys to merge by hand. Then start your CLI in the project. By hand, without the script:

```bash
cd my-existing-project
cp -r <template>/.agents .
cp -r <template>/tools/workflow-mcp tools/workflow-mcp   # skip node_modules
rm -rf tools/workflow-mcp/test                            # template-only; also drop the "test" script from its package.json
cp <template>/.mcp.json .
mkdir -p .claude-plugin && cp <template>/.claude-plugin/marketplace.json .claude-plugin/
#   set "name": "workflow-<your-dir-name>" (lowercase, non-alphanumerics → "-") — one marketplace per name per machine
# merge into .claude/settings.json, with the same name:
#   "extraKnownMarketplaces": {"workflow-<your-dir-name>": {"source": {"source": "directory", "path": "."}}}
#   "enabledPlugins": {"project@workflow-<your-dir-name>": true}
cd tools/workflow-mcp && npm install && cd ../..
claude
```

Then, inside Claude Code:

```
/project:init            # verify wiring, pick models, interview, scaffold docs/wiki, runnable tests, CI
/project:interview       # grill yourself on a feature; populate the spec
/project:work            # top todo → branch → TDD one Behavior case at a time → PR
/project:adversary       # a read-only second model on the diff; findings only
/project:review          # periodic whole-repo audit in a fresh context
/project:wiki [source]   # ingest a source, or (no argument) the wiki health pass
/project:sync-template   # adopted projects: pull template fixes
```

The generated [`AGENTS.md`](AGENTS.md) catalog is where they are described; [`tools/workflow-mcp/getting-started.md`](tools/workflow-mcp/getting-started.md) walks through a cycle and has the troubleshooting table. On an existing codebase `/project:init` detects the stack rather than assuming a blank slate; old docs are folded in one source at a time with `/project:wiki <path>`. Open `docs/wiki/` in Obsidian to watch the agent's knowledge.

## What the agent decides alone

It reads the wiki before changing code, writes the failing test first, commits one Behavior case at a time (test, implementation and wiki tick together, so `git bisect` works and any case reverts alone), and opens a PR once every case on the entity page is `[x]`.

It stops and asks before: merging a PR, pushing to `develop` or `main` directly, force-pushing or rewriting published history, choosing between two reasonable designs, resetting after a two-strike failure, or fixing a `critical`/`major` review finding. Review findings become todos by default — nothing is fixed on a reviewer's say-so. Review roles never edit code, `/project:review` never runs inside `/project:work`, and the wiki health pass runs only when you ask.

## What is enforced, not just asked for

| Practice | Mechanism |
| --- | --- |
| Tests fail before implementation, pass after | Every developer dispatch declares `test_paths`; `red-check.mjs` runs the tests with the developer's changes (they must pass), the architecture check, then reverts every other changed file to the base commit (the tests must now fail). Until it runs, `inspect_dispatch` is `incomplete`; if any phase fails, the case is rejected. A time limit stops the whole process tree on every OS. |
| Workers stay in scope | Worktrees, `owned_paths`, read-only sandboxes, no subagent tools, and a transcript audit on agy and codex. |
| Clean architecture | `docs/wiki/architecture.md § Layers` declares the dependency rule; `/project:init` installs a stack-specific check (dependency-cruiser, import-linter, ArchUnit, …), proves it fails on a planted violation, grants it to every worker and protects its rule files — no worker can loosen them, and `verify.mjs` fails a branch that changes them without an ADR. |
| Wiki ships with code, log ships with change | `tools/workflow-mcp/verify.mjs --base <branch>` in CI — plus generated-file drift, wikilinks and log order. |
| Review yield is measured | Finding counts are recorded with each review decision; `dispatch_stats` reports findings raised vs. acted on, and findings against each developer engine. |

What stays discipline is the conductor itself: nothing stops it writing code directly or skipping a step between CI runs. CI is the backstop.

## Running work on another CLI

The conductor — usually Claude Code — delegates through the workflow MCP server in `tools/workflow-mcp`. It is a prompt factory, not a supervisor: it composes the worker's prompt from `.agents/` and hands back a command you run.

```
check                # drift, installed engines, missing agy grants, capability gaps, architecture enforcement
prepare_worktree     # isolated checkout at committed HEAD on worker/<id>, plus setup_commands to run in it
build_worker_prompt  # role + rules + contract + the role's skills -> { command, prompt_file, report_file, … }
inspect_dispatch     # after the run: exit code, report, worktree changes, audit, and a verdict (pass / reject / incomplete)
record_decision      # accepted or rejected, with the reason (and finding counts for a review)
dispatch_stats       # per engine and role: acceptance, retries, durations, tokens, review yield
list_worktrees / remove_worktree / list_roles / sync / grant_antigravity_setup
```

The server never spawns, commits, merges or pushes — the conductor keeps all of that. The command it hands back is one line, `node tools/workflow-mcp/run-worker.mjs <dispatch dir>`, the same in bash, zsh, PowerShell or cmd on Linux, macOS or Windows: the runner launches the engine from the argv recorded in `run.json` (no shell in between), stops it and everything it started at `workerTimeoutSeconds`, records the outcome and prints the report. The full procedure is the `worker-dispatch` skill. Whatever the engine, the run leaves only the worker's final report in `report_file`; the raw codex/agy transcript, which reached 6.9 MB on one real health pass, goes to a separate `raw_file`. `npm --prefix tools/workflow-mcp run e2e -- --engine <antigravity|codex|claude>` runs one small real cycle on an engine — run it after upgrading an engine CLI or before moving a role onto one.

**Which model runs which role.** `.agents/config.json` is the only place: a role declares a `profile` (`reasoning` / `balanced` / `fast`), `engines.<engine>.models.<profile>` sets each CLI's default, and `roles.<role>` can pin an engine chain, model and effort. As shipped, four roles have their own engine chain and the rest (`researcher`, `reviewer`, `triage`, `wiki-maintainer`) run on `defaultEngine`, which ships as `antigravity` — set it to `inherit` to have them follow the conducting CLI instead:

| Role | Engine chain | Pinned model | Effort |
| --- | --- | --- | --- |
| `planner` | claude → codex | `claude-opus-5` on claude | high |
| `developer` | agy → codex → claude | profile default (`gemini-3.8-flash` on agy) | profile default |
| `plan-adversary` | agy → codex → claude | `gemini-3.8-flash` on agy | high |
| `adversary` | codex → agy → claude | `gpt-6-astra` on codex | medium |

These are the maintainer's working defaults; `/project:init` asks you per role. To change them without reading JSON, `node tools/workflow-mcp/config-ui.mjs` opens a local page that explains every setting, shows what each role will actually run, and saves only a config the loader accepts ([`tools/workflow-mcp/config.md`](tools/workflow-mcp/config.md) is the guide). Changes apply to the next dispatch. Pinning roles to agy needs a one-time user-global permission grant ([`tools/workflow-mcp/engine-setup.md`](tools/workflow-mcp/engine-setup.md)).

**Workers get no ambient context.** Each engine runs with project-file discovery off, so the composed prompt is everything a worker sees. Verified by the same self-test on all three:

| | rule 1 quoted | skills received | AGENTS.md loaded |
| --- | --- | --- | --- |
| claude (`--safe-mode`) | ✅ | `tdd-loop` only | no |
| codex (`project_doc_max_bytes=0`) | ✅ | `tdd-loop` only | no |
| agy (reads no repo files) | ✅ | `tdd-loop` only | no |

Conductor-only rules (branch, commit, push, open a PR) are withheld from workers, since the worker contract forbids git; 17 of the 23 rules reach a worker, renumbered — so ask a worker for a rule by what it says, never by number. A test composes every worker prompt the commands can produce and fails if one names a skill that worker is not sent, tells it to run a repo-changing git command, or points it outside its worktree. A worker's own account of its context is unreliable: test with questions only the real thing could answer.

**What each engine enforces, and what it only promises:**

| | leaf worker | read-only | running commands | clean report |
| --- | --- | --- | --- | --- |
| claude | process (`--disallowedTools Agent,Task`) | process (no approval surface for edits) | allowlisted from `workerCommands` | stdout already is the report |
| codex | process (`agents.enabled=false`) | process (OS sandbox) | free inside the sandbox | `report_file`, via `-o` |
| agy | process (custom agent with no subagent tools) | process (custom agent with no write tools) | allowlisted; needs a one-time user-global grant | `report_file`, extracted by the runner, plus an audit of reads outside the workspace |

`build_worker_prompt` warns per dispatch about any box an engine cannot back. A worktree is not a read boundary on agy or codex (measured), which is why `inspect_dispatch` audits their transcripts for outside reads and for skills a worker opened without being sent them. Details: [`tools/workflow-mcp/engine-setup.md`](tools/workflow-mcp/engine-setup.md).

## What's in the box

```
.agents/             # THE canonical source — read by every CLI, never duplicated
├── roles/           # planner, plan-adversary, developer, adversary, triage, reviewer, wiki-maintainer, researcher
│                    #   deliberately NOT agents/ — no plugin loader scans it, so roles are dispatched only through the MCP
├── skills/          # procedures (TDD, branching, plan-writing, reviews, wiki-update, …) + the update-toolkit meta skill
├── commands/        # the seven /project:* commands
├── rules.md         # behavioral constraints
├── worker-contract.md, config.json, project.md
└── .claude-plugin/  # makes this directory a Claude Code plugin named "project"
tools/workflow-mcp/  # the MCP: composes worker prompts, prepares worktrees, verifies, generates the root files
docs/
├── raw/             # immutable sources (interviews, research, documents)
└── wiki/            # the agent-maintained knowledge base (requirements, architecture, entities, decisions, log, …)
AGENTS.md            # generated from .agents/ — the schema and command catalog, read first
CLAUDE.md            # generated from .agents/ — imports AGENTS.md
```

Claude Code loads `.agents/` as a plugin (skills and commands, not roles) via `.claude/settings.json`; Codex reads `.agents/skills/` natively plus `AGENTS.md`; Antigravity reads no repository files and runs purely on the composed prompt.

## Philosophy

- **Skills are how-to, not what-is** — not "what TDD is", but how this project does it.
- **Spec → test → code**: entity Behavior cases → failing tests → minimal implementation, with the wiki updated in the same commit.
- **A second model reads the brief before any code exists**, and on risky cycles the diff after it lands — with none of the author's context. Reviewers raise findings; they never fix them, and every finding gets a written disposition.
- **Human in the loop** — when the wiki can't decide, the agent stops and asks.
- **The toolkit evolves** — `update-toolkit` lets the agent add roles, skills and commands as the project grows.

## License

MIT — see [`LICENSE`](LICENSE).
