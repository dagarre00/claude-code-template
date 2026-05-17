# Agentic Development Template

A Claude Code template for building software with an LLM agent as the developer. Wiki-driven, spec + TDD, progressive disclosure.

## Two ideas

1. **The wiki is the spec.** `docs/wiki/` is the source of truth for what the project does and how it's built. Code that disagrees with the wiki is the bug.
2. **Progressive disclosure beats specialized agents.** One implementer agent loads task-specific skills on demand. Skills are short, procedural, project-specific — never abstract explanations.

## Quick start

```bash
git clone <this-template> my-project
cd my-project
claude
```

Inside Claude Code:

```
/init        # detect state, scaffold docs/wiki, base docs
/interview   # grill yourself on requirements; populate the wiki
/work        # pick the top todo, branch, run TDD (Red → Green → Refactor → wiki)
/plan        # decompose a complex todo into a stepwise plan (Opus)
/review      # periodic audit in a fresh worktree
```

Open `docs/wiki/` in Obsidian on the side. That's your view of the agent's knowledge.

For a worked walkthrough — `/init` → `/interview` → `/work` end-to-end with explanations — see [`docs/getting-started.md`](docs/getting-started.md).

## What's in the box

```
.claude/
├── agents/          # planner (opus), tester, implementer, reviewer, wiki-maintainer, researcher
├── skills/          # process skills (TDD, branching, plan-writing, wiki-update, …) + meta skills
├── commands/        # /init, /interview, /work, /plan, /review, /checkpoint, /rollback, /status, /wiki-lint, /wiki-ingest
├── hooks/           # session-start, session-end, test-first-check, auto-format, wiki-drift-check
├── settings.json    # hook wiring
└── rules/           # behavioral constraints
docs/
├── raw/             # immutable source documents (interviews, articles, transcripts)
└── wiki/            # LLM-owned knowledge base (entities, concepts, decisions, summaries, log, …)
CLAUDE.md            # the schema — read first
HUMAN.md             # the human's-eye view of how this works
```

## Philosophy

- **Skills are how-to, not what-is.** No skill explains "what TDD is" — they explain "how this project does TDD."
- **Spec → Test → Code.** Entity Behavior cases → failing tests → minimal implementation. Hook-enforced on `feat/*`/`fix/*` branches.
- **Wiki ships with code.** Code edits and wiki edits happen in the same commit. Wiki-drift hook warns otherwise.
- **Human in the loop.** When the agent can't decide from the wiki, it stops and asks — never silently improvises.
- **Dynamic config.** Meta skills (`update-skill`, `update-agent`, `update-command`, `update-hook`) let the agent evolve its own toolkit as the project grows.

## License

MIT — see [`LICENSE`](LICENSE). Use it. Fork it. Bend it.
