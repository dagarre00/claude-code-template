# Project Schema — Wiki-Driven, Spec + TDD, Progressive Disclosure

This repository is a **template for agentic software development**. Two ideas govern everything:

1. **The wiki is the spec.** `docs/wiki/` is the source of truth for what the project is and how it works. Code that disagrees with the wiki is the bug.
2. **Progressive disclosure beats specialized agents.** A single `developer` agent runs the whole TDD cycle, loading task-specific skills on demand. The one deliberate split is the `planner` (on Opus), which decomposes `[complex]` or batched work into a plan before the developer executes it. Skills are short, procedural, and tell the agent _how_ to do something _in this project_ — never _what something is_ in the abstract.

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
- **Spec → Test → Code.** Write the entity Behavior cases first, derive failing tests, then implement. The `test-first-check` hook _reminds_ (never blocks) when code is edited with no test in the session's changes on `feat/*` and `fix/*` branches — the discipline is yours to keep.
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
    ├── log.md              # chronological ops log
    ├── requirements.md     # living spec — code must match
    ├── architecture.md     # stack, patterns, testing strategy
    ├── git-conventions.md  # branch/commit conventions
    ├── todos.md            # priority-ordered work queue (completed items removed; git history is the record)
    ├── wiki-todos.md       # deferred wiki-cleanup queue — agents append, /project:wiki-lint processes
    ├── gotchas.md          # known failure points
    ├── commands.md         # working shell commands (incl. test command)
    ├── entities/           # one page per feature/module/component
    ├── concepts/           # patterns, conventions, domain ideas
    ├── decisions/          # ADRs
    └── summaries/          # one page per ingested raw source
```

Navigation is via the directory tree and Obsidian's own graph — there is no hand-maintained `index.md`. Domain vocabulary lives inline on the page that needs it, not a separate `glossary.md`.

## Slash commands

| Command                | Purpose                                                                                                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/project:init`        | Detect project state, scaffold `docs/wiki/`, fill base docs (requirements, architecture, git-conventions, commands), initialize git if needed                                                                            |
| `/project:interview`   | Grill-me-relentlessly Q&A. Used both for initial requirements and for adding features. Writes a transcript to `docs/raw/interviews/`, then updates affected wiki pages                                                   |
| `/project:work`        | Pick the top todo (or batch consecutive todos sharing context), branch off `develop`, dispatch the `planner` (Opus) for complex/batched work, then the `developer` through red→green→refactor→wiki-update, commit, and merge into `develop` (human-approved)                |
| `/project:release`     | Merge `develop → main` as a tagged `vX.Y.Z` release (human-approved). The only path by which `main` advances                                                                                                              |
| `/project:review`      | Throughout review of code vs wiki. Runs the `reviewer` in a fresh worktree with isolated context                                                                                                                         |
| `/project:wiki-lint`   | Health-check the wiki: contradictions, orphans, broken links, drift; compacts `gotchas.md`; archives `log.md` when it overflows                                                                                          |
| `/project:wiki-ingest` | Ingest a file or research topic directly into the wiki. `/project:wiki-ingest spec.pdf` for documents, `/project:wiki-ingest search for ...` for research                                                                |
| `/project:agent-scout` | Post-init survey: reads the wiki and recommends specific agents and skills tailored to this project's stack, domain, and external services. Re-run after major feature additions.                                        |

Routine git operations — snapshotting before a risky change (`git tag checkpoint-<stamp>`), reverting (`git reset --hard <tag>`), and status (`git status` / `git log`) — are done with plain git, not bespoke commands.

## Agent routing

| Task                                                         | Agent                                                                                  |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Decompose a `[complex]` or batched todo into a stepwise plan | `planner` (Opus) — dispatched by `/project:work` before the `developer`                |
| TDD cycle — red → green → refactor → wiki                    | `developer` — dispatched by `/project:work`; loads skills based on task content        |
| Periodic full audit (≈every 5 todos via `/project:review`)   | `reviewer` (worktree-isolated for clean context)                                       |
| Periodic wiki health, ingest, cross-link                     | `wiki-maintainer` — **manual only** via `/project:wiki-lint` or explicit human request |
| Web research — search, fetch, synthesize                     | `researcher` — dispatched by `/project:wiki-ingest` or directly by the human           |

There is intentionally no domain-specialized agent (no "backend agent", no "database agent"). Domain knowledge lives in skills the `developer` loads on demand. The `planner` runs on **Opus** (decomposition is reasoning-heavy); all other agents run on Sonnet.

**Wiki edits — inline only.** The `developer` and `reviewer` make wiki edits **inline** in the same commit as the code (entity-page Behavior tick, single ADR, single gotcha line, log entry). Larger or cross-page work (orphan cleanup, contradictions, mass cross-linking) is left for the human to run `/project:wiki-lint`, which dispatches the `wiki-maintainer`. **No agent auto-invokes the wiki-maintainer.** Raw-source ingest goes through the human via `/project:wiki-ingest`.

## Skill catalog (initial)

**Meta skills** — evolve the agent's own toolkit:

- `update-agent`, `update-skill`, `update-command`, `update-hook`

**Core process skills** — used during work:

- `tdd-loop` — red/green/refactor procedure for this project
- `plan-writing` — how the `planner` decomposes a `[complex]` or batched todo into a stepwise plan before testing
- `wiki-update` — how agents touch wiki pages while working
- `feature-branching` — how to start/finish a short-lived branch (cut from `develop`)
- `branch-merge` — how to integrate a finished branch: `feat/* → develop` (`--no-ff`, human-approved), the `develop → main` release, and the hotfix dual-merge
- `conflict-resolution` — how to resolve merge/rebase conflicts safely
- `git-recovery` — stash, cherry-pick, bisect, reflog recovery, and other advanced git operations
- `pr-create` — how to draft a PR body (base `develop`) when the human asks to open one instead of the local merge
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

| Hook                  | Phase                  | Purpose                                                                                                                                                                              |
| --------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `session-start.sh`    | SessionStart           | Warn on upstream divergence (no auto-pull), detect Python venv if markers present, warn on uncommitted, record HEAD SHA to `.claude/tmp/session-start-sha` for later hooks           |
| `session-end.sh`      | Stop                   | Prompt to commit if dirty, append a session entry to `docs/wiki/log.md` (only when new commits landed since the last entry — never empty stamps or per-turn duplicates)              |
| `test-first-check.sh` | PreToolUse Write/Edit  | **Reminder, not a block:** on `feat/*` / `fix/*`, nudges (always allows) when production code is edited with no test file in the session's changes yet                               |
| `auto-format.sh`      | PostToolUse Write/Edit | Run formatter by file extension                                                                                                                                                      |
| `wiki-drift-check.sh` | Stop                   | Warn if code was edited but no `docs/wiki/` page was touched in the same session (scoped via the session-start SHA marker; runs before `session-end` and ignores its auto-log entry) |

## Golden rules

1. **Wiki is truth.** Code that disagrees with the wiki is the bug.
2. **No code without a failing test.** Test-first is the default; the `test-first-check` hook _reminds_ (no longer blocks) on `feat/*`/`fix/*`.
3. **Never modify a test to make it pass.** Update the spec → regenerate the test → implement.
4. **Always update wiki in the same change.** Touching `src/` requires touching the entity page.
5. **Never modify `docs/raw/` content.** Append only.
6. **Agents own `docs/wiki/` and git state.** Humans browse and approve merges/releases; agents write code, write the wiki, and run every git operation. The human does not hand-manage branches.
7. **Always branch before coding.** Cut short-lived branches from `develop`; never commit directly to `main` or `develop` (both protected).
8. **Conventional commits.** `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:` (merge and release commits keep git's default merge message).
9. **Two-strike rule.** Two failed implementations on the same mechanism → tag a checkpoint (`git tag`), `git reset --hard` to a known-good commit, and retry from spec.
10. **Reviewer is periodic.** `/project:review` every ~5 todos — not in `/project:work`. Reviewer runs in a fresh worktree.
11. **Human-in-the-loop.** When you need a decision the wiki doesn't answer, stop and ask. Don't guess.
12. **Skills are how-to.** When the project gains a new domain or pattern, add a skill via `update-skill` — don't bury knowledge in agent prompts.
13. **Finalize with commit + push.** Every command or agent that mutates tracked files ends by committing and pushing to the working branch (`git push -u origin <branch>`) — an unpushed commit is lost when the container recycles. Only read-only commands are exempt.
14. **LLM-owned, human-approved integration.** The agent runs the whole git lifecycle. It merges `feat/* → develop` (`--no-ff`) at the end of each cycle via the `branch-merge` skill, and `develop → main` via `/project:release` — each only after explicit human go-ahead in the conversation. Never force-push `main`/`develop`; never push a red protected branch.

## Where things live

| Concern                       | Location                                             |
| ----------------------------- | ---------------------------------------------------- |
| What the project should do    | `docs/wiki/requirements.md`                          |
| How it's built                | `docs/wiki/architecture.md` + `docs/wiki/entities/*` |
| Why we chose X                | `docs/wiki/decisions/*`                              |
| What can go wrong             | `docs/wiki/gotchas.md`                               |
| What's next                   | `docs/wiki/todos.md`                                 |
| What's shipped                | git history (closed todos are removed from todos.md) |
| Working shell + test commands | `docs/wiki/commands.md`                              |
| Branch / commit rules         | `docs/wiki/git-conventions.md`                       |
| Timeline                      | `docs/wiki/log.md`                                   |
| Raw sources (immutable)       | `docs/raw/`                                          |
| Hard behavioral constraints   | `.claude/rules/behavioral.md`                        |
