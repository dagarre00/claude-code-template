# Agentic Development Template — Claude Code edition

A template for building software with Claude Code as the developer: wiki-driven, spec + TDD, progressive disclosure. This edition runs the whole workflow on Claude Code's own subagents, skills and commands — no MCP server, no other CLI, nothing to install.

## Three ideas

1. **The wiki is the spec.** `docs/wiki/` is the source of truth for what the project does and how it is built. Code that disagrees with the wiki is the bug.
2. **Progressive disclosure beats specialized agents.** One `developer` runs the whole TDD cycle, loading short, procedural, project-specific skills on demand.
3. **A second model reads the brief before any code exists**, and on risky cycles the diff after it lands — with none of the author's context. Reviewers raise findings; they never fix them, and every finding gets a written disposition.

## Quick start

Needs a recent Claude Code (built against v2.1.284): the roles use subagent `effort`, `skills`, `permissionMode` and `maxTurns` frontmatter.

**New project** — no code or history yet:

```bash
git clone --branch develop --single-branch https://github.com/dagarre00/claude-code-template.git my-project
cd my-project
rm -rf .git      # the template's history is not your project's; /project:init starts a fresh one
rm -rf plugins .claude-plugin   # the plugin's source; your settings install it from this repository
claude
```

**Existing project** — copy the workflow in; never touch its `.git`:

```bash
cd my-existing-project
mkdir -p .claude/commands
cp -r <template>/.claude/agents <template>/.claude/skills <template>/.claude/rules .claude/
cp -r <template>/.claude/commands/project .claude/commands/
cp -rn <template>/docs .                  # only the starter pages you don't have
```

Then by hand: merge `"permissions": { "allow": ["Edit(/.handoff/**)", "Edit(/docs/wiki/**)"] }` and the template's `extraKnownMarketplaces` and `enabledPlugins` entries (the conductor-guard plugin, below) into `.claude/settings.json`; add the template's workflow lines to `.gitignore` (`.claude/settings.local.json`, `.claude/tmp/`, `.claude/worktrees/`, `.handoff/*-plan.md`, `.handoff/*-handoff.md`, `.handoff/*-report.md`, `docs/.obsidian/`) and `docs/wiki/log.md merge=union` to `.gitattributes`; and put the template's `# Project` block at the top of your `CLAUDE.md` (or copy its `CLAUDE.md` if you have none). Start Claude Code afterwards — roles load at session start.

Then, inside Claude Code:

```
/project:init            # check the wiring, review role models, interview, scaffold docs/wiki, runnable tests, CI
/project:interview       # grill yourself on a feature; populate the spec
/project:work            # top todo → branch → TDD one Behavior case at a time → PR
/project:adversary       # a read-only second model on the diff; findings only
/project:review          # periodic whole-repo audit in a fresh context
/project:wiki [source]   # ingest a source, or (no argument) the wiki health pass
/project:sync-template   # adopted projects: pull template fixes
```

Each takes free-text context (`/project:work the login endpoint`, `/project:review security only`) that scopes it without bypassing a precondition, the Red phase or a human checkpoint. On an existing codebase `/project:init` detects the stack rather than assuming a blank slate; old docs are folded in one source at a time with `/project:wiki <path>`. Open `docs/wiki/` in Obsidian to watch the agent's knowledge. For complete example sessions of `init`, `interview` and `work` (default, `fast` and `handoff` modes), see [`WORKFLOW-EXAMPLES.md`](WORKFLOW-EXAMPLES.md).

## Roles and models

The main session is the **conductor**: it runs the commands, dispatches the roles and owns every commit. Each role is a subagent in `.claude/agents/` that pins its own model, effort, tools and preloaded skills.

| Role | Model · effort | Access | Dispatched by |
| --- | --- | --- | --- |
| `planner` | opus · xhigh | writes only its plan file | `/project:work`, complex or batched todos |
| `plan-adversary` | sonnet · high | read-only | `/project:work`, every cycle |
| `developer` | sonnet · medium | writes the case's code, tests and wiki page | `/project:work`, one Behavior case per dispatch |
| `adversary` | opus · high | read-only | `/project:work` on complex cycles, `/project:adversary` |
| `triage` | sonnet · high | read-only | the conductor, while disposing of findings |
| `reviewer` | opus · high | read-only | `/project:review` |
| `wiki-maintainer` | sonnet · medium | writes `docs/wiki/` | `/project:wiki` |
| `researcher` | sonnet · medium | writes one `docs/raw/research/` file, web | `/project:wiki search for …` |

**Why these.** Opus goes where a role runs rarely and a miss costs a cycle: decomposing complex work, hunting defects in a diff, the periodic audit. Sonnet runs what happens every cycle. Effort follows the task: `xhigh` for the planner, whose decisions shape every case after it; `high` where edge cases and verification decide the outcome; `medium` for well-specified execution — the developer's one case is the most frequent dispatch, and the conductor's Red check backs it. The two reviews that bracket the developer run on a different model from it, so a second reader is a second model, not just a second context.

**Changing one:** edit `model`/`effort` in `.claude/agents/<role>.md` and restart the session. `/project:init` asks once. On Amazon Bedrock, Google Cloud or Microsoft Foundry the `opus`/`sonnet` aliases can resolve to older models, where `xhigh` may not exist.

## What is enforced, not just asked for

| Practice | Mechanism |
| --- | --- |
| Reviewers never edit | The read-only roles have no edit tools and run in `permissionMode: dontAsk`: a command not allowlisted in `.claude/settings.json` — a git write, an install, a delete — is denied, not prompted. The conductor also checks that `HEAD` and the tree are unchanged after each. |
| Writers stay in scope | The planner and the wiki-maintainer also run in `dontAsk`, and the only writes allowed to them are `Edit(/.handoff/**)` and `Edit(/docs/wiki/**)`. |
| Subagents are leaves | No role has the Agent tool. |
| A reviewer holds none of the author's context | Roles are dispatched by `subagent_type`, never as a fork, so they see none of the conversation — only a brief that the procedure keeps to IDs and paths. |
| Tests fail before the implementation, pass after | The conductor proves each developer case: the full suite passes, the case is committed, then everything but its tests is restored from the parent commit and the tests must fail. Only then is it pushed. |
| Clean architecture | `docs/wiki/architecture.md § Layers` declares the dependency rule; `/project:init` installs a stack-specific check (dependency-cruiser, import-linter, ArchUnit, …), proves it fails on a planted violation, and allowlists it for every role. |
| Raw sources, a shared tree, role dispatch | The `conductor-guard` plugin (below) refuses an edit to an existing `docs/raw/` file (rule 11), `git stash`/`reset --hard`/`checkout --`/`restore`/`clean -f` over a dirty tree, naming the paths (rule 21) — the workflow's own `restore --source=<commit>` (the Red check) and tagged `stash push -m` pass — and an Agent call as a fork or through `general-purpose` (rule 10). A refusal the human overrides, such as rule 5's approved `reset --hard`, they run themselves with `! <command>`. |

What stays discipline: the conductor itself (nothing stops it writing code directly or skipping a step), a reviewer choosing not to open `.handoff/` in the shared checkout, and the wiki-with-code and log checks in the `pr-create` skill, which only CI you write can back — the plugin only raises a toast when a commit carries no `docs/wiki/log.md` entry (rule 19).

## The conductor-guard plugin

`plugins/conductor-guard/` is a Claude Code plugin that turns the rules above into checks on every tool call, and shows a band above the prompt with the cycle's state:

```
feat/auth-login · auth-login 2/5 cases · 1 unpushed · 3 changed · 4 P0 todos · backlog 12/40
```

— the branch, the Behavior cases ticked on the entity the branch builds, commits not yet pushed, changed files, the open todos in the highest priority that has any, and the open `[adversary]` backlog against `FINDINGS_MAX`. The log toast stays quiet until `/project:init` has filled `CLAUDE.md`.

`/wiki-nav` opens a pane that lists the spec — requirements, architecture, todos (with the top priority's count), gotchas, commands, git conventions — then every entity with its cases ticked and every decision by title. Press one to read it, `b` to go back. It reads the wiki each time it draws, so it is never stale; editing and search stay in your editor or Obsidian.

**Installing it.** Nothing to run: `.claude/settings.json` names this repository as a marketplace (`extraKnownMarketplaces`, branch `develop`) and enables the plugin (`enabledPlugins`), so Claude Code offers the install the first time a session trusts the project folder. `/project:init` step 0 checks that it is enabled. Declined, or on a machine that skipped the prompt, install it by hand from a terminal session:

```
/plugin install conductor-guard@claude-code-template
```

It acts only in a project that has `.claude/rules/behavioral.md`, so installing it for every repository is harmless elsewhere. In this repository, load the working copy for one session with `claude --plugin-dir plugins/conductor-guard`; its tests run with `claude plugin test plugins/conductor-guard`.

## What the agent decides alone

It reads the wiki before changing code, writes the failing test first, commits one Behavior case at a time (test, implementation and wiki tick together, so `git bisect` works and any case reverts alone), and opens a PR once every case on the entity page is `[x]`.

It stops and asks before: merging a PR, pushing to `develop` or `main` directly, force-pushing or rewriting published history, choosing between two reasonable designs, resetting after a two-strike failure, or fixing a `critical`/`major` review finding. Review findings become todos by default — nothing is fixed on a reviewer's say-so. `/project:review` never runs inside `/project:work`, and the wiki health pass runs only when you ask.

## What's in the box

```
.claude/
├── agents/            # the eight roles — model, effort, tools, permission mode, preloaded skills
├── commands/project/  # the seven /project:* commands
├── skills/            # procedures (TDD, branching, plan-writing, reviews, wiki-update, …) + update-toolkit
├── rules/             # behavioral.md (the numbered rules) and workflow.md (the map) — loaded every session
└── settings.json      # the allow rules the roles run under
docs/
├── raw/               # immutable sources (interviews, research, documents)
└── wiki/              # the agent-maintained knowledge base (requirements, architecture, entities, decisions, log, …)
CLAUDE.md              # this project's facts only; /project:init fills them
plugins/conductor-guard/  # rule checks on tool calls and the cycle band (.claude-plugin/marketplace.json lists it)
```

## Philosophy

- **Skills are how-to, not what-is** — not "what TDD is", but how this project does it.
- **Spec → test → code**: entity Behavior cases → failing tests → minimal implementation, with the wiki updated in the same commit.
- **Human in the loop** — when the wiki can't decide, the agent stops and asks.
- **The toolkit evolves** — the `update-toolkit` skill lets the agent add roles, skills and commands as the project grows.

## License

MIT — see [`LICENSE`](LICENSE).
