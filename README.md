# Agentic Development Template

A template for building software with an LLM agent as the developer, across Claude Code, Codex and Antigravity. Wiki-driven, spec + TDD, progressive disclosure.

## Three ideas

1. **The wiki is the spec.** `docs/wiki/` is the source of truth for what the project does and how it's built. Code that disagrees with the wiki is the bug.
2. **Progressive disclosure beats specialized agents.** A single `developer` agent runs the whole TDD cycle, loading task-specific skills on demand. Skills are short, procedural, project-specific — never abstract explanations.
3. **One canonical source, no copies.** The workflow lives in `.agents/` and every CLI reads it there. Workers get one composed prompt and no ambient project context, so the same workflow behaves the same whichever CLI runs it.

## Quick start

```bash
git clone <this-template> my-project
cd my-project
rm -rf .git    # drop the template's history — /project:init re-inits git for your project
claude
```

Inside Claude Code:

```
/project:init        # detect state, scaffold docs/wiki, base docs
/project:interview   # grill yourself on requirements; populate the wiki
/project:work        # pick the top todo, branch, run TDD (Red → Green → Refactor → wiki)
/project:adversary   # point a read-only second model at the diff; findings only
/project:review      # periodic audit in a fresh session context
/project:wiki-lint   # periodic wiki health check
/project:wiki-ingest # direct ingest of a file or research query into wiki
/project:agent-scout # survey and recommend stack/domain skills and agents
/project:handoff     # package a todo as a self-contained brief for an external LLM
```

Open `docs/wiki/` in Obsidian on the side. That's your view of the agent's knowledge.

## Running work on another CLI

The conductor — usually Claude Code — delegates through the workflow MCP server in `tools/workflow-mcp`. It is a prompt factory, not a process supervisor: it composes the worker's prompt from `.agents/` and hands back a command you run.

```
prepare_worktree     # isolated checkout at committed HEAD, on its own worker/<id> branch
build_worker_prompt  # role + rules + contract + the skills the command declares
                     # -> { command, cwd, prompt_file, stdin_file, prompt_bytes }
```

Run the returned `command`, read the report, commit the worker's owned paths yourself, then `remove_worktree`. The server never spawns, commits, merges or pushes — you keep all of that, and a failed worker is debugged by re-running a command line you can read.

**Workers get no ambient context.** Each engine is launched with its own project-file discovery switched off, so the composed prompt is the whole of what the worker sees. Verified by dispatching the same self-test to all three:

| | rule 1 quoted | skills received | AGENTS.md loaded | rule count |
| --- | --- | --- | --- | --- |
| claude (`--safe-mode`) | ✅ | `tdd-loop` only | no | — |
| codex (`project_doc_max_bytes=0`) | ✅ | `tdd-loop` only | no | — |
| agy (reads no repo files) | ✅ | `tdd-loop` only | no | 16 of 22 |

Conductor-only rules — branch, commit, push, open a PR — are withheld from workers, because the worker contract forbids git and handing it both would be a contradiction. 22 rules become 16.

One caveat worth knowing: a worker's own account of its context is unreliable. agy first claimed it *had* been given AGENTS.md; asked instead to quote a withheld rule and name a command from the catalog, it correctly answered `ABSENT` to both. Test with questions only the real thing could answer.

For a worked walkthrough — `/project:init` → `/project:interview` → `/project:work` end-to-end with explanations — see [`docs/getting-started.md`](docs/getting-started.md).

## What's in the box

```
.agents/             # THE canonical source — read by every CLI, never duplicated
├── agents/          # planner (reasoning), developer, adversary (reasoning), reviewer, wiki-maintainer, researcher
├── skills/          # process skills (TDD, branching, plan-writing, adversarial-review, wiki-update, …) + update-toolkit meta skill
├── commands/        # /project:init, /project:interview, /project:work, /project:adversary, /project:review, /project:wiki-lint, /project:wiki-ingest, /project:agent-scout, /project:handoff
├── rules.md         # behavioral constraints
└── .claude-plugin/  # makes this directory a Claude Code plugin named "project"
tools/workflow-mcp/  # the MCP: composes worker prompts, prepares worktrees, generates the root files
docs/
├── raw/             # immutable source documents (interviews, articles, transcripts)
└── wiki/            # LLM-owned knowledge base (entities, concepts, decisions, summaries, log, …)
AGENTS.md            # generated from .agents/ — the schema, read first
CLAUDE.md            # generated from .agents/ — imports AGENTS.md
HUMAN.md             # the human's-eye view of how this works
```

**One directory, three CLIs.** Claude Code loads `.agents/` as a plugin (skills, commands **and** agents) via `.claude/settings.json`; Codex reads `.agents/skills/` natively plus the generated `AGENTS.md`. Antigravity reads no repo files at all, so it runs purely on the prompt the MCP composes — which is why nothing here is ever copied per-CLI.

## Philosophy

- **Skills are how-to, not what-is.** No skill explains "what TDD is" — they explain "how this project does TDD."
- **Spec → Test → Code.** Entity Behavior cases → failing tests → minimal implementation.
- **Wiki ships with code.** Code edits and wiki edits happen in the same commit.
- **A second model reads the diff.** Risky cycles get an `adversary` on Opus with none of the author's context, told to find what's wrong. It raises findings; it never fixes them. Every finding gets a written disposition.
- **Human in the loop.** When the agent can't decide from the wiki, it stops and asks — never silently improvises.
- **Dynamic config.** The `update-toolkit` meta skill lets the agent evolve its own agents, skills, and commands as the project grows.

## License

MIT — see [`LICENSE`](LICENSE). Use it. Fork it. Bend it.
