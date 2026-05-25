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
│   └── interviews/         # /project:interview transcripts land here
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

| Command                  | Purpose                                                                                                                                                                           |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/project:init`          | Detect project state, scaffold `docs/wiki/`, fill base docs (requirements, architecture, git-conventions, commands), initialize git if needed                                     |
| `/project:interview`     | Grill-me-relentlessly Q&A. Used both for initial requirements and for adding features. Writes a transcript to `docs/raw/interviews/`, then updates affected wiki pages            |
| `/project:plan`          | Dispatch the `planner` agent on a todo (or `top`) and stop at the plan file. Useful for estimation, scoping, or pre-planning before `/project:work`                               |
| `/project:work`          | Pick the top todo (or batch consecutive todos sharing context), open a `feat/*` branch, optionally run the planner, then spec→red→green→refactor→wiki-update→commit               |
| `/project:review`        | Throughout review of code vs wiki. Runs in a fresh worktree with isolated context                                                                                                 |
| `/project:checkpoint`    | Tag HEAD as `checkpoint-<timestamp>` for risky operations                                                                                                                         |
| `/project:rollback`      | List checkpoints, revert to one                                                                                                                                                   |
| `/project:status`        | Branch, top todos, recent log, uncommitted summary                                                                                                                                |
| `/project:wiki-lint`     | Health-check the wiki: contradictions, orphans, broken links, drift, unprocessed `wiki-todos.md` items; archives `log.md` and `completed.md` when they overflow                   |
| `/project:wiki-ingest`   | Ingest a file or research topic directly into the wiki. `/project:wiki-ingest spec.pdf` for documents, `/project:wiki-ingest search for ...` for research                         |
| `/project:gotchas-prune` | Prune and compact `gotchas.md`: enforce format, remove stale entries, promote critical items, archive overflow to `gotchas-archive.md`. Run when file exceeds ~60 content lines.  |
| `/project:agent-scout`   | Post-init survey: reads the wiki and recommends specific agents and skills tailored to this project's stack, domain, and external services. Re-run after major feature additions. |

## Agent routing

| Task                                                       | Agent                                                                                                                                    |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Plan / decompose a complex or batched todo                 | `planner` (Opus) — dispatched by `/project:work` when a todo is tagged `[complex]` or batching 2+ todos, or directly via `/project:plan` |
| TDD Red — write failing tests                              | `tester`                                                                                                                                 |
| TDD Green + Refactor — make tests pass                     | `implementer` (loads skills based on task content)                                                                                       |
| Periodic full audit (≈every 5 todos via `/project:review`) | `reviewer` (worktree-isolated for clean context)                                                                                         |
| Periodic wiki health, ingest, cross-link                   | `wiki-maintainer` — **manual only** via `/project:wiki-lint` or explicit human request                                                   |
| Web research — search, fetch, synthesize                   | `researcher` — dispatched by `/project:wiki-ingest` or directly by the human                                                             |

There is intentionally no domain-specialized agent (no "backend agent", no "database agent"). Domain knowledge lives in skills the implementer loads on demand. The `planner` is the lone Opus agent — planning benefits from stronger reasoning while tester/implementer/reviewer/researcher/wiki-maintainer run on Sonnet.

**Wiki edits — inline vs deferred.** Other agents (implementer, tester, reviewer) make **small wiki edits inline** in the same commit as the code (entity-page Behavior tick, single ADR, single gotcha line, log entry). For **larger or cross-page work** (orphan cleanup, contradictions, mass cross-linking), they append a one-line entry to `docs/wiki/wiki-todos.md` for the wiki-maintainer to process on the next `/project:wiki-lint`. **No agent auto-invokes the wiki-maintainer.** Raw-source ingest goes through the human via `/project:wiki-ingest`.

## Skill catalog (initial)

**Meta skills** — evolve the agent's own toolkit:

- `update-agent`, `update-skill`, `update-command`, `update-hook`

**Core process skills** — used during work:

- `tdd-loop` — red/green/refactor procedure for this project
- `plan-writing` — how the planner agent structures a stepwise plan for `[complex]` or batched todos
- `wiki-update` — how agents touch wiki pages while working
- `feature-branching` — how to start/finish a feature branch
- `pr-create` — how to draft a PR body when the human asks to open one
- `human-checkpoint` — when and how to pause for the human
- `spec-writing` — how to write entity Behavior cases that produce good tests (and the canonical `[ ]`/`[~]`/`[x]` notation)
- `decision-recording` — how to file an ADR
- `gotcha-recording` — how to capture a failure mode for future agents

Stack-specific skills (e.g. `backend-impl`, `database-impl`, `frontend-impl`) are not shipped by default. `/project:interview` adds them after the stack is known.

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

| Hook                  | Phase                  | Purpose                                                                                                                                                                                |
| --------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `session-start.sh`    | SessionStart           | Warn on upstream divergence (no auto-pull), detect Python venv if markers present, warn on uncommitted, record HEAD SHA to `.claude/tmp/session-start-sha` for later hooks             |
| `session-end.sh`      | Stop                   | Prompt to commit if dirty, append a session entry to `docs/wiki/log.md` (only when HEAD moved or tree dirty — never empty stamps)                                                      |
| `test-first-check.sh` | PreToolUse Write/Edit  | Block code edits on `feat/*` / `fix/*` branches unless `.claude/handoff/<slug>.json` exists with `red_confirmed: true` (written by the tester agent). See [[concepts/handoff-format]]. |
| `auto-format.sh`      | PostToolUse Write/Edit | Run formatter by file extension                                                                                                                                                        |
| `wiki-drift-check.sh` | Stop                   | Warn if code was edited but no `docs/wiki/` page was touched in the same session (scoped via the session-start SHA marker)                                                             |

## Golden rules

1. **Wiki is truth.** Code that disagrees with the wiki is the bug.
2. **No code without a failing test.** The `test-first-check` hook enforces this on `feat/*`/`fix/*`.
3. **Never modify a test to make it pass.** Update the spec → regenerate the test → implement.
4. **Always update wiki in the same change.** Touching `src/` requires touching the entity page.
5. **Never modify `docs/raw/` content.** Append only.
6. **Agents own `docs/wiki/`.** Humans browse; agents write.
7. **Always branch before coding.** Never commit to main.
8. **Conventional commits.** `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.
9. **Two-strike rule.** Two failed implementations on the same mechanism → `/project:rollback` and retry from spec.
10. **Reviewer is periodic.** `/project:review` every ~5 todos — not in `/project:work`. Reviewer runs in a fresh worktree.
11. **Human-in-the-loop.** When you need a decision the wiki doesn't answer, stop and ask. Don't guess.
12. **Skills are how-to.** When the project gains a new domain or pattern, add a skill via `update-skill` — don't bury knowledge in agent prompts.
13. **Finalize with commit + push.** Every command or agent that mutates tracked files ends by committing and pushing to the working branch (`git push -u origin <branch>`) — an unpushed commit is lost when the container recycles. Only read-only commands (`/project:status`, `/project:plan`) are exempt.

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
