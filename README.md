# Agentic Development Template

A template for building software with an LLM agent as the developer, across Claude Code, Codex and Antigravity. Wiki-driven, spec + TDD, progressive disclosure.

## Three ideas

1. **The wiki is the spec.** `docs/wiki/` is the source of truth for what the project does and how it's built. Code that disagrees with the wiki is the bug.
2. **Progressive disclosure beats specialized agents.** A single `developer` agent runs the whole TDD cycle, loading task-specific skills on demand. Skills are short, procedural, project-specific — never abstract explanations.
3. **One canonical source, no copies.** The workflow lives in `.agents/` and every CLI reads it there. Workers get one composed prompt and no ambient project context, so the same workflow behaves the same whichever CLI runs it.

## Quick start

**New project** — no code or git history yet:

```bash
git clone <this-template> my-project
cd my-project
rm -rf .git    # drop the template's history — /project:init re-inits git for your project
claude
```

**Existing project** — your own codebase, docs and git history are already in
place. Never touch `.git`. From a checkout of this template, run:

```bash
bash scripts/adopt.sh /path/to/my-existing-project
```

That copies `.agents/` and `tools/workflow-mcp/` in (leaving out
`node_modules/` and the template's own `test/` suite, and stripping the
now-meaningless `test` script from the copied `package.json` — that suite
only verifies this template repo's workflow-mcp source, never the adopting
project's own code, so it has no business shipping there), installs the MCP
server's dependencies, drops `.mcp.json`, and registers the server with
`codex`/`agy` if either is on your `PATH`. It prints one thing for you to
finish by hand: merging
`.claude/settings.json` if the target already has one (it creates it fresh
otherwise). Because `tools/workflow-mcp/engine-setup.md` and
`tools/workflow-mcp/conductor-e2e.md` travel with the copy, the adopted project
also gets its own copy of the conformance test — run it once after adopting to
confirm the mechanism actually works on this machine before trusting it. Then,
in the target project:

```bash
cd /path/to/my-existing-project
claude
```

No script handy, or want to see exactly what it does? The manual equivalent:

```bash
cd my-existing-project
cp -r <template>/.agents .
cp -r <template>/tools/workflow-mcp tools/workflow-mcp   # skip node_modules
rm -rf tools/workflow-mcp/test                            # template-only test suite
# also delete the "scripts" block in tools/workflow-mcp/package.json —
# its "test" script only made sense for the excluded test/ directory
cp <template>/.mcp.json .
# the plugin marketplace: copy the manifest, then give it THIS project's name —
# "workflow-<your-project-dir-name>" (lowercase, runs of non-alphanumerics → "-").
# Claude Code keeps one marketplace per name per machine, so a shared name makes
# one project serve another's skills (docs/wiki/gotchas.md):
mkdir -p .claude-plugin && cp <template>/.claude-plugin/marketplace.json .claude-plugin/
#   edit .claude-plugin/marketplace.json: "name": "workflow-<your-project-dir-name>"
# merge into .claude/settings.json — don't overwrite it — with that same name:
#   "extraKnownMarketplaces": {"workflow-<your-project-dir-name>": {"source": {"source": "directory", "path": "."}}}
#   "enabledPlugins": {"project@workflow-<your-project-dir-name>": true}
cd tools/workflow-mcp && npm install && cd ../..
claude
```

Either way, inside Claude Code:

```
/project:init        # detect state, scaffold docs/wiki, base docs
/project:interview   # grill yourself on requirements; populate the wiki
/project:work        # pick the top todo, branch, run TDD (Red → Green → Refactor → wiki)
/project:adversary   # point a read-only second model at the diff; findings only
/project:review      # periodic audit in a fresh session context
/project:wiki        # ingest a source (with an argument) or run the health pass (without)
```

On an existing project, `/project:init` detects the stack that's already there
instead of assuming a blank slate. Prior documentation is not migrated
automatically — fold it in afterward, one source at a time, with
`/project:wiki <path>`.

Six commands, and that is the whole surface. What each one does in detail is in
the generated [`AGENTS.md`](AGENTS.md) catalog — the single place they are
described, so this list stays a menu rather than a second spec to keep in sync.
For a worked walkthrough, see [`tools/workflow-mcp/getting-started.md`](tools/workflow-mcp/getting-started.md).

Open `docs/wiki/` in Obsidian on the side. That's your view of the agent's knowledge.

## What the agent decides alone

It reads the wiki before any code change, writes the failing test first, commits
one Behavior case at a time (test + implementation + wiki tick together, so
`git bisect` works and any case can be reverted alone), updates the wiki in the
same commit as the code, and opens the PR once every Behavior case on the entity
page is `[x]`.

It stops and asks you before: merging a PR, pushing to `develop` or `main`
directly, force-pushing or rewriting published history, choosing between two
reasonable design alternatives, resetting after a two-strike failure, or fixing
a `critical`/`major` adversary finding. Findings become todos by default —
nothing is fixed on a reviewer's say-so alone. Neither reviewing role may edit
code: both raise findings only, and the periodic `/project:review` never runs
inside `/project:work`. The wiki-maintainer is never auto-invoked; health passes
are yours to trigger.

## What is enforced, not just asked for

| Practice | Mechanism |
| --- | --- |
| Tests fail before implementation | Every developer dispatch declares `test_paths`; `red-check.mjs` reverts every other changed file to the base commit and the tests must fail. Until it runs, `inspect_dispatch` is `incomplete`; if the tests pass, the case is rejected. |
| Workers stay in scope | Worktrees, `owned_paths`, read-only sandboxes, no subagent tools, and a transcript audit on agy and codex. |
| Clean architecture | `docs/wiki/architecture.md § Layers` declares the dependency rule; `/project:init` step 5b installs a stack-specific check (dependency-cruiser, import-linter, ArchUnit, …), proves it fails on a planted violation, grants it to every worker, and marks its rule files protected — no worker can loosen them, and `verify.mjs` fails a branch that changes them without an ADR. `check` reports whether it is enforced. |
| Wiki ships with code, log ships with change | `tools/workflow-mcp/verify.mjs --base <branch>` in CI — plus drift, wikilinks and log order. |
| Review yield is measured | Finding counts recorded with each review decision; `dispatch_stats` reports findings raised vs. acted on, and findings against each developer engine. |

What stays discipline: the conductor itself. Nothing stops a conductor from writing code directly or skipping a step between CI runs — CI is the backstop.

## Running work on another CLI

The conductor — usually Claude Code — delegates through the workflow MCP server in `tools/workflow-mcp`. It is a prompt factory, not a process supervisor: it composes the worker's prompt from `.agents/` and hands back a command you run.

```
check                # drift, installed engines, missing agy grants, capability gaps
prepare_worktree     # isolated checkout at committed HEAD on worker/<id>, plus setup_commands to run in it
build_worker_prompt  # role + rules + contract + the skills the command declares
                     # -> { command, cwd, prompt_file, stdin_file, report_file, prompt_bytes, attempt }
inspect_dispatch     # after the run: record, exit code, duration, report path, worktree changes,
                     # agy usage and audit, and a mechanical verdict (pass / reject / incomplete)
record_decision      # accepted or rejected, with the reason
dispatch_stats       # per engine and role: accepted, retries, durations, tokens
list_worktrees / remove_worktree / list_roles / sync
```

Run the returned `command`, `inspect_dispatch` (and, for a developer, the returned `red_check_command`), read the report, `record_decision`, commit the worker's owned paths yourself, then `remove_worktree` — the full procedure is the `worker-dispatch` skill. The server never spawns, commits, merges or pushes — you keep all of that, and a failed worker is debugged by re-running a command line you can read.

**Checking an engine end to end.** `npm --prefix tools/workflow-mcp run e2e -- --engine <antigravity|codex|claude>` runs one small real cycle on that engine — a capability probe, a developer case whose Red the conductor re-proves, and an adversary — in a throwaway fixture, and exits non-zero if any check fails. Run it after upgrading an engine CLI and before changing which engine a role runs on.

**Where the report actually is.** `report_file` is non-null for codex and antigravity — read it instead of `stdout` for the routine "what did the worker report" path; `stdout` is captured to a `raw_file` alongside it, for the rare case of actually debugging a failed run. Claude needs neither: its `--print` stdout already is only the final message, and `command` is never wrapped for it. Codex writes `report_file` itself, via `-o`. Antigravity has no equivalent flag (measured: `--input-format stream-json` refuses to pair with `--output-format text`, so its stdout has to be the full NDJSON event stream), so `dispatch.mjs` wraps its command instead — capture stdout to `raw_file`, run `engines/extract-agy-result.mjs` over it to pull out the stream's one `{"event":"result",...}` line, print only that. Either way, running the returned `command` verbatim now leaves a small, clean report as the only thing that reaches the conductor's own tool-call result, on every engine. Measured on a real dispatch, before this existed: a `wiki-maintainer` health pass on codex produced 6.9MB/43,015 lines of raw stdout — almost entirely large file reads and one rejected multi-file patch echoed back in full, not model reasoning (`reasoning summaries: none` holds by default; zero `thinking:` sections anywhere in that file).

**Which model runs which role.** `.agents/config.json` is the only place model choice lives — a role declares a `profile` (`reasoning` / `balanced` / `fast`), never a model. `engines.<engine>.models.<profile>` sets each CLI's default; `roles.<role>.engine` pins a role to one CLI, and `roles.<role>.models.<engine>` / `.effort.<engine>` pin the exact model and effort for it. As shipped, three roles are pinned across all three CLIs and the rest follow whichever CLI is conducting:

| Role | Engine chain | Pinned model | Effort |
| --- | --- | --- | --- |
| `planner` | claude → codex | `claude-opus-5` on claude | high |
| `developer` | agy → codex → claude | profile default (`gemini-3.8-flash`, medium, on agy) | profile default |
| `plan-adversary` | agy → codex → claude | `gemini-3.8-flash` on agy | high |
| `adversary` | codex → agy → claude | `gpt-6-astra` on codex | medium |

**Changing it without reading JSON.** `node tools/workflow-mcp/config-ui.mjs` (or `npm --prefix tools/workflow-mcp run config`) opens a local page over `.agents/config.json` — guide and full setting reference in [`tools/workflow-mcp/config.md`](tools/workflow-mcp/config.md), which adopting projects receive with the rest of `tools/workflow-mcp/`. Every setting has a one-line explanation, each role shows what it will actually run (engine order, model, effort — the role's own pin, else the engine's default for its profile), and Save stays disabled until the edit passes the same validation the dispatcher loads the file with. A save writes only what you changed, in the file's own line endings, and refuses if the file changed on disk in the meantime. It listens on loopback only, and its API needs the token in the URL it prints. Changes apply to the next dispatch, no restart. Hand-editing still works, and the loader now rejects what used to be silently ignored: an unknown key (top level or inside an `engines.<name>` block), and an effort or model id the engine does not accept. `workerTimeoutSeconds` is only enforced for Antigravity workers today.

Pinning roles to agy is the one trade-off worth naming: its workers need a one-time user-global permission grant before they can run a command at all (`check` lists any that are missing), and a worktree is not a read boundary on agy — nor on codex, whose read-only sandbox bounds writes but not reads (measured) — so `inspect_dispatch` audits both engines' transcripts for reads outside the workspace and skills a worker opened without being sent them. The setup is in [`tools/workflow-mcp/engine-setup.md`](tools/workflow-mcp/engine-setup.md).

**Workers get no ambient context.** Each engine is launched with its own project-file discovery switched off, so the composed prompt is the whole of what the worker sees. Verified by dispatching the same self-test to all three:

| | rule 1 quoted | skills received | AGENTS.md loaded | rule count |
| --- | --- | --- | --- | --- |
| claude (`--safe-mode`) | ✅ | `tdd-loop` only | no | — |
| codex (`project_doc_max_bytes=0`) | ✅ | `tdd-loop` only | no | — |
| agy (reads no repo files) | ✅ | `tdd-loop` only | no | 16 of 22 |

Conductor-only rules — branch, commit, push, open a PR — are withheld from workers, because the worker contract forbids git and handing it both would be a contradiction (the table above was measured when there were 22 rules; there are now 23, of which 17 reach a worker). A test composes every worker prompt the commands can produce and fails if one names a skill that worker was not sent, tells it to run a git command that changes the repository, or points it outside its worktree.

**What each engine can enforce, and what it only promises.** Context suppression is not the only guarantee a worker prompt makes, and the three CLIs do not honour the rest equally:

| | leaf worker | read-only | running commands | clean report |
| --- | --- | --- | --- | --- |
| claude | process (`--disallowedTools Agent,Task`) | process (no approval surface for edits) | allowlisted from `workerCommands` | stdout already is the report |
| codex | process (`agents.enabled=false`) | process (OS sandbox) | free inside the sandbox | `report_file`, via `-o` |
| agy | process (custom agent with no subagent tools) | process (custom agent with no write tools) | allowlisted, needs one-time user-global setup | `report_file`, via command wrapping + `extract-agy-result.mjs`, plus an audit of reads outside the workspace |

agy earns its two process-level boxes by launching every worker as a per-dispatch custom agent (`--agent`), whose tool list is the whole toolset — measured: a read-only worker told to write a file and define a subagent answered NO SUCH TOOL to both. `build_worker_prompt` returns a `warnings` entry for any box an engine cannot back, so a conductor is told per dispatch rather than having to remember this. **A worker cannot run anything that is not in `workerCommands`** (`.agents/config.json`), and on agy that list also has to be mirrored into a user-global settings file or its workers return an empty response with exit code 0. One page, all of it: [`tools/workflow-mcp/engine-setup.md`](tools/workflow-mcp/engine-setup.md).

One caveat worth knowing: a worker's own account of its context is unreliable. agy first claimed it *had* been given AGENTS.md; asked instead to quote a withheld rule and name a command from the catalog, it correctly answered `ABSENT` to both. Test with questions only the real thing could answer — and ask for a rule by what it says, never by number, because workers receive the rules renumbered.

## What's in the box

```
.agents/             # THE canonical source — read by every CLI, never duplicated
├── roles/           # planner (reasoning), developer, adversary (reasoning), reviewer, wiki-maintainer, researcher
│                    #   deliberately NOT agents/ — no plugin loader scans it, so a role
│                    #   can only be dispatched through the MCP, never as a native subagent
├── skills/          # process skills (TDD, branching, plan-writing, adversarial-review, wiki-update, …) + update-toolkit meta skill
├── commands/        # the six /project:* commands
├── rules.md         # behavioral constraints
└── .claude-plugin/  # makes this directory a Claude Code plugin named "project"
tools/workflow-mcp/  # the MCP: composes worker prompts, prepares worktrees, generates the root files
docs/
├── raw/             # immutable source documents (interviews, articles, transcripts)
└── wiki/            # LLM-owned knowledge base (entities, concepts, decisions, summaries, log, …)
AGENTS.md            # generated from .agents/ — the schema and command catalog, read first
CLAUDE.md            # generated from .agents/ — imports AGENTS.md
```

**One directory, three CLIs.** Claude Code loads `.agents/` as a plugin — skills and commands, but *not* roles — via `.claude/settings.json`; Codex reads `.agents/skills/` natively plus the generated `AGENTS.md`. Antigravity reads no repo files at all, so it runs purely on the prompt the MCP composes — which is why nothing here is ever copied per-CLI.

## Philosophy

- **Skills are how-to, not what-is.** No skill explains "what TDD is" — they explain "how this project does TDD."
- **Spec → Test → Code.** Entity Behavior cases → failing tests → minimal implementation.
- **Wiki ships with code.** Code edits and wiki edits happen in the same commit.
- **A second model reads the brief, before any code exists.** Every cycle starts by putting the plan — or the todo itself, on a simple one — through a read-only `plan-adversary`: a Behavior case no step covers, a step that cannot fail Red on its own, an instruction with two live readings. Findings are applied to the brief, escalated to `/project:interview`, or rejected in writing.
- **A second model reads the diff.** Risky cycles get an `adversary` on a second model with none of the author's context, told to find what's wrong. It raises findings; it never fixes them. Every finding gets a written disposition.
- **Human in the loop.** When the agent can't decide from the wiki, it stops and asks — never silently improvises.
- **Dynamic config.** The `update-toolkit` meta skill lets the agent evolve its own agents, skills, and commands as the project grows.

## License

MIT — see [`LICENSE`](LICENSE). Use it. Fork it. Bend it.
