# Project Schema — Wiki-Driven, Spec + TDD, Progressive Disclosure

This repository is a **template for agentic software development**. Two ideas govern everything:

1. **The wiki is the spec.** `docs/wiki/` is the source of truth for what the project is and how it works. Code that disagrees with the wiki is the bug.
2. **Progressive disclosure beats specialized agents.** A single `implementer` agent loads task-specific skills on demand. Skills are short, procedural, and tell the agent _how_ to do something _in this project_ — never _what something is_ in the abstract.

## Identity

You are an AI development agent working on this project. At the top of every session, read this file. Then, **before any implementation or code change**, check the wiki for related context — never modify behavior blind:

1. Read `docs/wiki/gotchas.md` for known failure points.
2. Read `docs/wiki/todos.md` to know what's next.
3. If the task touches a feature, read the matching `docs/wiki/entities/<slug>.md` and the relevant section of `docs/wiki/requirements.md`.
4. Grep `docs/wiki/` for terms from the task to find related concepts, decisions, or summaries before you act.
5. Let any matching skill auto-load — skills tell you the procedure for _this project's_ TDD loop, branching, wiki updates, etc.

## Operating principles

- **Progressive disclosure.** Agents start with minimal context. Skills load on demand based on task content. Never preload knowledge an agent doesn't need yet.
- **Skills are how-to, not what-is.** Every skill body says: "When you're doing X, here's the procedure: read these wiki pages, follow these steps, update these pages." No skill explains what backend or TDD _means_ — assume the LLM knows.
- **Dynamic config.** Agents, skills, commands, and hooks are evolved by the meta skills (`update-agent`, `update-skill`, `update-command`, `update-hook`). When the project's needs change, the agent updates its own toolkit.
- **Spec → Test → Code.** Write the entity Behavior cases first, derive failing tests, then implement. The `test-first-check` hook blocks code edits without a matching test on `feat/*` and `fix/*` branches.
- **Wiki always current.** Code edits and wiki edits ship together. The `wiki-drift-check` hook warns at session end if you only touched code.
- **Human in the loop.** When the agent needs the human (uncommitted decisions, missing inputs, risky ops), it stops and asks via the `human-checkpoint` skill — never silently improvises.

## Three layers

1. **Raw sources** — `docs/raw/` (immutable drop zone). Interview transcripts, meeting notes, articles, PDFs. Agents read but never edit; only append.
2. **Wiki** — `docs/wiki/` (LLM-owned). All documentation: project basics (`requirements.md`, `architecture.md`, `git-conventions.md`), entities, concepts, decisions, summaries, log, todos. The agent writes; the human browses (e.g. with Obsidian).
3. **Schema** — this file plus `.claude/rules/behavioral.md`, `.claude/agents/`, `.claude/skills/`, `.claude/commands/`, `.claude/hooks/`. Tells agents how to operate.

## Wiki layout

```
docs/
├── raw/                    # immutable sources
│   └── interviews/         # /interview transcripts land here
└── wiki/                   # LLM-owned knowledge base
    ├── index.md            # catalog (one line per page)
    ├── log.md              # chronological ops log
    ├── requirements.md     # living spec — code must match
    ├── architecture.md     # stack, patterns, testing strategy
    ├── git-conventions.md  # branch/commit conventions
    ├── todos.md            # priority-ordered work queue
    ├── completed.md        # shipped work with backrefs
    ├── gotchas.md          # known failure points
    ├── commands.md         # working shell commands (incl. test command)
    ├── glossary.md         # project vocabulary (domain terms, aliases)
    ├── wiki-todos.md       # queue of cleanup tasks for wiki-maintainer
    ├── entities/           # one page per feature/module/component
    ├── concepts/           # patterns, conventions, domain ideas
    ├── decisions/          # ADRs
    └── summaries/          # one page per ingested raw source
```

## Slash commands

| Command        | Purpose                                                                                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/init`        | Detect project state, scaffold `docs/wiki/`, fill base docs (requirements, architecture, git-conventions, commands), initialize git if needed                          |
| `/interview`   | Grill-me-relentlessly Q&A. Used both for initial requirements and for adding features. Writes a transcript to `docs/raw/interviews/`, then updates affected wiki pages |
| `/work`        | Pick the top todo (or batch consecutive todos sharing context), open a `feat/*` branch, run spec→red→green→refactor→wiki-update→commit                                 |
| `/review`      | Throughout review of code vs wiki. Runs in a fresh worktree with isolated context                                                                                      |
| `/checkpoint`  | Tag HEAD as `checkpoint-<timestamp>` for risky operations                                                                                                              |
| `/rollback`    | List checkpoints, revert to one                                                                                                                                        |
| `/status`      | Branch, top todos, recent log, uncommitted summary                                                                                                                     |
| `/wiki-lint`   | Health-check the wiki: contradictions, orphans, broken links, drift, unprocessed `wiki-todos.md` items                                                                 |
| `/wiki-ingest` | Ingest a file or research topic directly into the wiki. `/wiki-ingest spec.pdf` for documents, `/wiki-ingest search for ...` for research                              |

## Agent routing

| Task                                               | Agent                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------------ |
| TDD Red — write failing tests                      | `tester`                                                                       |
| TDD Green + Refactor — make tests pass             | `implementer` (loads skills based on task content)                             |
| Periodic full audit (≈every 5 todos via `/review`) | `reviewer` (worktree-isolated for clean context)                               |
| Periodic wiki health, ingest, cross-link           | `wiki-maintainer` — **manual only** via `/wiki-lint` or explicit human request |
| Web research — search, fetch, synthesize           | `researcher` — dispatched by `/wiki-ingest` or directly by the human           |

There is intentionally no domain-specialized agent (no "backend agent", no "database agent"). Domain knowledge lives in skills the implementer loads on demand.

**Wiki edits — inline vs deferred.** Other agents (implementer, tester, reviewer) make **small wiki edits inline** in the same commit as the code (entity-page Behavior tick, single ADR, single gotcha line, log entry). For **larger or cross-page work** (orphan cleanup, contradictions, mass cross-linking), they append a one-line entry to `docs/wiki/wiki-todos.md` for the wiki-maintainer to process on the next `/wiki-lint`. **No agent auto-invokes the wiki-maintainer.** Raw-source ingest goes through the human via `/wiki-ingest`.

## Skill catalog (initial)

**Meta skills** — evolve the agent's own toolkit:

- `update-agent`, `update-skill`, `update-command`, `update-hook`

**Core process skills** — used during work:

- `tdd-loop` — red/green/refactor procedure for this project
- `wiki-update` — how agents touch wiki pages while working
- `feature-branching` — how to start/finish a feature branch
- `human-checkpoint` — when and how to pause for the human
- `spec-writing` — how to write entity Behavior cases that produce good tests
- `decision-recording` — how to file an ADR
- `gotcha-recording` — how to capture a failure mode for future agents

Stack-specific skills (e.g. `backend-impl`, `database-impl`, `frontend-impl`) are not shipped by default. `/interview` adds them after the stack is known.

## Frontmatter convention

Every `.md` in `.claude/` and `docs/wiki/` carries frontmatter so the harness can route correctly:

```yaml
---
name: <kebab-case-short-name>
description: <one line, action-oriented — when/why to use; for skills, this is the trigger>
type: agent | command | skill | rule | wiki-entity | wiki-concept | wiki-decision | wiki-summary | wiki-index | wiki-log | wiki-spec
---
```

Wiki pages may add: `sources:` (list of raw paths), `updated: YYYY-MM-DD`, `status: draft | approved | stale | shipped | deprecated`.

Skills in particular need a precise `description` because Claude Code uses it to decide whether to load the skill. State _exactly_ what triggers the skill — the keywords, the situations, the tool calls.

## Hooks

Wired in `.claude/settings.json`:

| Hook                  | Phase                  | Purpose                                                                                                  |
| --------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------- |
| `session-start.sh`    | SessionStart           | `git pull --ff-only`, activate Python venv if present, warn on uncommitted, run test suite if configured |
| `session-end.sh`      | Stop                   | Prompt to commit if dirty, prompt to push, append session entry to `docs/wiki/log.md`                    |
| `test-first-check.sh` | PreToolUse Write/Edit  | Block code edits on `feat/*` / `fix/*` branches if no matching test was edited recently                  |
| `auto-format.sh`      | PostToolUse Write/Edit | Run formatter by file extension                                                                          |
| `wiki-drift-check.sh` | Stop                   | Warn if code was edited but no wiki page was touched in the same session                                 |

## Golden rules

1. **Wiki is truth.** Code that disagrees with the wiki is the bug.
2. **No code without a failing test.** The `test-first-check` hook enforces this on `feat/*`/`fix/*`.
3. **Never modify a test to make it pass.** Update the spec → regenerate the test → implement.
4. **Always update wiki in the same change.** Touching `src/` requires touching the entity page.
5. **Never modify `docs/raw/` content.** Append only.
6. **Agents own `docs/wiki/`.** Humans browse; agents write.
7. **Always branch before coding.** Never commit to main.
8. **Conventional commits.** `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.
9. **Two-strike rule.** Two failed implementations on the same mechanism → `/rollback` and retry from spec.
10. **Reviewer is periodic.** `/review` every ~5 todos — not in `/work`. Reviewer runs in a fresh worktree.
11. **Human-in-the-loop.** When you need a decision the wiki doesn't answer, stop and ask. Don't guess.
12. **Skills are how-to.** When the project gains a new domain or pattern, add a skill via `update-skill` — don't bury knowledge in agent prompts.

## Where things live

| Concern                           | Location                                             |
| --------------------------------- | ---------------------------------------------------- |
| What the project should do        | `docs/wiki/requirements.md`                          |
| How it's built                    | `docs/wiki/architecture.md` + `docs/wiki/entities/*` |
| Why we chose X                    | `docs/wiki/decisions/*`                              |
| What can go wrong                 | `docs/wiki/gotchas.md`                               |
| What's next                       | `docs/wiki/todos.md`                                 |
| What's shipped                    | `docs/wiki/completed.md`                             |
| Working shell + test commands     | `docs/wiki/commands.md`                              |
| Project vocabulary                | `docs/wiki/glossary.md`                              |
| Branch / commit rules             | `docs/wiki/git-conventions.md`                       |
| Cleanup queue for wiki-maintainer | `docs/wiki/wiki-todos.md`                            |
| Timeline                          | `docs/wiki/log.md`                                   |
| Raw sources (immutable)           | `docs/raw/`                                          |
| Hard behavioral constraints       | `.claude/rules/behavioral.md`                        |
