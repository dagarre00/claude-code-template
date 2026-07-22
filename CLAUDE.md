# Project Schema — Wiki-Driven, Spec + TDD, Progressive Disclosure

This repository is a **template for agentic software development**. Two ideas govern everything:

1. **The wiki is the spec.** `docs/wiki/` is the source of truth for what the project is and how it works. Code that disagrees with the wiki is the bug.
2. **Progressive disclosure beats specialized agents.** A single `developer` agent runs the whole TDD cycle, loading task-specific skills on demand. The one deliberate split is the `planner` (on Opus), which decomposes `[complex]` or batched work before the developer executes it. Skills are short, procedural how-to for _this project_ — never abstract explanations of _what something is_.

The hard behavioral constraints live in [`.claude/rules/behavioral.md`](.claude/rules/behavioral.md) — read them; they override default inclinations. This file is the map; that file is the law.

## Identity

You are an AI development agent working on this project. At the top of every session, read this file. Then, **before any implementation or code change**, check the wiki — never modify behavior blind:

1. Read `docs/wiki/gotchas.md` for known failure points.
2. Read `docs/wiki/todos.md` to know what's next.
3. If the task touches a feature, read the matching `docs/wiki/entities/<slug>.md` and the relevant section of `docs/wiki/requirements.md`.
4. Grep `docs/wiki/` for terms from the task to find related concepts, decisions, or summaries before you act.
5. Let any matching skill auto-load — skills tell you the procedure for _this project's_ TDD loop, branching, wiki updates, etc.

## Operating principles

- **Progressive disclosure.** Agents start with minimal context. Skills load on demand based on task content. Never preload knowledge an agent doesn't need yet.
- **Skills are how-to, not what-is.** Every skill body is a procedure: read these wiki pages, follow these steps, update these pages. No skill explains what a backend or TDD _is_.
- **Dynamic config.** Agents, skills, and commands are evolved by the `update-toolkit` skill. When the project's needs change, the agent updates its own toolkit.
- **Spec → Test → Code.** Write the entity Behavior cases first, derive failing tests, then implement. The discipline is yours to keep.
- **Wiki always current.** Code edits and wiki edits ship together, in the same commit.
- **Human in the loop.** When you need the human (uncommitted decisions, missing inputs, risky ops), stop and ask via the `human-checkpoint` skill — never silently improvise.

## Three layers

1. **Raw sources** — `docs/raw/` (immutable, append-only inbox). Interviews, notes, articles, PDFs. The human deposits; agents read but never edit.
2. **Wiki** — `docs/wiki/` (LLM-owned). The compiled state: durable, atomic, reconciled pages. Agents compile `raw → wiki` and reconcile continuously; the human browses (e.g. in Obsidian) and answers clarification questions. Never invent knowledge to plug a hole — record it in `open_questions` or ask.
3. **Schema** — this file plus `.claude/rules/behavioral.md`, `.claude/agents/`, `.claude/skills/`, `.claude/commands/`. Tells agents how to operate.

## Wiki layout

```
docs/
├── raw/                    # immutable sources (interviews/, research/)
└── wiki/                   # LLM-owned knowledge base
    ├── log.md              # chronological ops log
    ├── requirements.md     # living spec — code must match
    ├── architecture.md     # stack, patterns, testing strategy
    ├── git-conventions.md  # branch/commit conventions
    ├── todos.md            # priority-ordered work queue (completed items removed; git history is the record)
    ├── wiki-todos.md       # deferred wiki-cleanup queue — /project:wiki-lint processes
    ├── gotchas.md          # known failure points
    ├── commands.md         # working shell commands (incl. test command)
    ├── entities/           # one page per feature/module/component
    ├── concepts/           # patterns, conventions, domain ideas
    ├── decisions/          # ADRs
    └── summaries/          # one page per ingested raw source
```

Navigation is via the directory tree and Obsidian's graph — there is no hand-maintained `index.md`, no separate `glossary.md`. Folders are **surface grouping only**; a page's `domains`/`abstraction` facets live in frontmatter, not in the path.

The wiki follows the **Obsidian LLM-wiki standard**. The full standard — templates, facet vocabulary, link ontology, placement/dedup procedure — lives in the [`wiki-update` skill](.claude/skills/wiki-update/SKILL.md); the non-negotiable invariants are behavioral rule 18. Gap and contradiction detection is computable (run by `/project:wiki-lint`), never intuition.

## Slash commands

| Command                | Purpose                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `/project:init`        | Detect project state, scaffold `docs/wiki/`, fill base docs, initialize git if needed                                                |
| `/project:interview`   | Grill-me-relentlessly Q&A for requirements or a new feature. Streams a transcript to `docs/raw/interviews/`, then updates the wiki   |
| `/project:work`        | Pick the top todo (or batch), branch from `develop`, dispatch the `planner` (complex/batched) then the `developer`, commit, push, PR |
| `/project:review`      | Thorough review of code vs wiki. Runs the `reviewer` in a fresh worktree with isolated context                                       |
| `/project:wiki-lint`   | Wiki health check: reconciliation, lint invariants, orphans, broken links, drift; archives `log.md` when it overflows                |
| `/project:wiki-ingest` | Ingest a file or research topic into the wiki (`spec.pdf`, or `search for ...`)                                                      |
| `/project:agent-scout` | Post-init survey: recommends agents and skills tailored to this project's stack, domain, and services                                |

Routine git operations (checkpoint tag, reset, status/log) use plain git, not bespoke commands.

## Agent routing

| Task                                            | Agent                                                                  |
| ----------------------------------------------- | ---------------------------------------------------------------------- |
| Decompose a `[complex]` or batched todo         | `planner` (Opus) — dispatched by `/project:work` before the developer  |
| TDD cycle — red → green → refactor → wiki        | `developer` — dispatched by `/project:work`; loads skills on demand    |
| Periodic full audit (≈every 5 todos)            | `reviewer` (worktree-isolated) — via `/project:review`                 |
| Periodic wiki health, ingest, cross-link        | `wiki-maintainer` — **manual only** via `/project:wiki-lint`           |
| Web research — search, fetch, synthesize        | `researcher` — via `/project:wiki-ingest` or directly by the human     |

There is intentionally no domain-specialized agent (no "backend agent"). Domain knowledge lives in skills the `developer` loads on demand. The `planner` runs on **Opus**; all other agents on Sonnet (researcher on Haiku).

**Wiki edits — inline only.** The `developer` and `reviewer` make small wiki edits **inline** in the same commit as the code (Behavior tick, single ADR, single gotcha line, log entry). Larger cross-page work is queued in `wiki-todos.md` for the human to run `/project:wiki-lint`. **No agent auto-invokes the wiki-maintainer.**

## Skill catalog

**Meta skill** — evolves the agent's own toolkit: `update-toolkit` (agents, skills, commands).

**Core process skills:** `tdd-loop`, `plan-writing`, `wiki-update`, `feature-branching`, `pr-create`, `human-checkpoint`, `spec-writing`, `decision-recording`, `gotcha-recording`, `git-recovery` (git edge cases + conflict resolution).

Stack-specific skills (`backend-impl`, `database-impl`, …) are not shipped by default. `/project:interview` and `/project:agent-scout` add them once the stack is known.

## Where things live

| Concern                        | Location                                             |
| ------------------------------ | ---------------------------------------------------- |
| What the project should do     | `docs/wiki/requirements.md`                          |
| How it's built                 | `docs/wiki/architecture.md` + `docs/wiki/entities/*` |
| Why we chose X                 | `docs/wiki/decisions/*`                              |
| What can go wrong              | `docs/wiki/gotchas.md`                               |
| What's next                    | `docs/wiki/todos.md`                                 |
| What's shipped                 | git history (closed todos are removed from todos.md) |
| Working shell + test commands  | `docs/wiki/commands.md`                              |
| Branch / commit rules          | `docs/wiki/git-conventions.md`                       |
| Timeline                       | `docs/wiki/log.md`                                   |
| Raw sources (immutable)        | `docs/raw/`                                          |
| Hard behavioral constraints    | `.claude/rules/behavioral.md`                        |
| Wiki page standard + templates | `.claude/skills/wiki-update/SKILL.md`                |
