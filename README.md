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
# merge into .claude/settings.json — don't overwrite it:
#   "extraKnownMarketplaces": {"workflow": {"source": {"source": "directory", "path": "."}}}
#   "enabledPlugins": {"project@workflow": true}
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

## Running work on another CLI

The conductor — usually Claude Code — delegates through the workflow MCP server in `tools/workflow-mcp`. It is a prompt factory, not a process supervisor: it composes the worker's prompt from `.agents/` and hands back a command you run.

```
prepare_worktree     # isolated checkout at committed HEAD, on its own worker/<id> branch
build_worker_prompt  # role + rules + contract + the skills the command declares
                     # -> { command, cwd, prompt_file, stdin_file, prompt_bytes }
```

Run the returned `command`, read the report, commit the worker's owned paths yourself, then `remove_worktree`. The server never spawns, commits, merges or pushes — you keep all of that, and a failed worker is debugged by re-running a command line you can read.

**Which model runs which role.** `.agents/config.json` is the only place model choice lives — a role declares a `profile` (`reasoning` / `balanced` / `fast`), never a model. `engines.<engine>.models.<profile>` sets each CLI's default; `roles.<role>.engine` pins a role to one CLI, and `roles.<role>.models.<engine>` / `.effort.<engine>` pin the exact model and effort for it. As shipped, three roles are pinned across all three CLIs and the rest follow whichever CLI is conducting:

| Role | Engine | Model | Effort |
| --- | --- | --- | --- |
| `planner` | claude | `claude-opus-5` | high |
| `developer` | agy | `gemini-3.8-flash` | medium |
| `plan-adversary` | agy | `gemini-3.8-flash` | high |
| `adversary` | codex | `gpt-6-astra` | medium |

Pinning roles to agy is the one trade-off worth naming: agy enforces neither the leaf-worker rule nor read-only below the prompt, and its workers need a one-time user-global permission grant before they can run a command at all. Every dispatch says so in its `warnings`; the setup is in [`tools/workflow-mcp/engine-setup.md`](tools/workflow-mcp/engine-setup.md).

**Workers get no ambient context.** Each engine is launched with its own project-file discovery switched off, so the composed prompt is the whole of what the worker sees. Verified by dispatching the same self-test to all three:

| | rule 1 quoted | skills received | AGENTS.md loaded | rule count |
| --- | --- | --- | --- | --- |
| claude (`--safe-mode`) | ✅ | `tdd-loop` only | no | — |
| codex (`project_doc_max_bytes=0`) | ✅ | `tdd-loop` only | no | — |
| agy (reads no repo files) | ✅ | `tdd-loop` only | no | 16 of 22 |

Conductor-only rules — branch, commit, push, open a PR — are withheld from workers, because the worker contract forbids git and handing it both would be a contradiction. 22 rules become 16.

**What each engine can enforce, and what it only promises.** Context suppression is not the only guarantee a worker prompt makes, and the three CLIs do not honour the rest equally:

| | leaf worker | read-only | running commands |
| --- | --- | --- | --- |
| claude | process (`--disallowedTools Agent,Task`) | process (no approval surface for edits) | allowlisted from `workerCommands` |
| codex | process (`agents.enabled=false`) | process (OS sandbox) | free inside the sandbox |
| agy | **prompt only** | **prompt only** | allowlisted, needs one-time user-global setup |

`build_worker_prompt` returns a `warnings` entry for every box in that table it cannot back, so a conductor is told per dispatch rather than having to remember this. **A worker cannot run anything that is not in `workerCommands`** (`.agents/config.json`), and on agy that list also has to be mirrored into a user-global settings file or its workers return an empty response with exit code 0. One page, all of it: [`tools/workflow-mcp/engine-setup.md`](tools/workflow-mcp/engine-setup.md).

One caveat worth knowing: a worker's own account of its context is unreliable. agy first claimed it *had* been given AGENTS.md; asked instead to quote a withheld rule and name a command from the catalog, it correctly answered `ABSENT` to both. Test with questions only the real thing could answer.

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
