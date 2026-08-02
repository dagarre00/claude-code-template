# Project Schema — Wiki-Driven, Spec + TDD, Progressive Disclosure

This repository is a **template for agentic software development**. Two ideas govern everything:

1. **The wiki is the spec.** `docs/wiki/` is the source of truth for what the project is and how it works. Code that disagrees with the wiki is the bug.
2. **Progressive disclosure beats specialized agents.** A single `developer` agent runs the whole TDD cycle, loading task-specific skills on demand. The two deliberate splits are both on Opus and both sit outside the loop: the `planner`, which decomposes `[complex]` or batched work before the developer executes it, and the `adversary`, which reads the resulting diff afterwards with none of the developer's context and raises findings it is not allowed to fix. Skills are short, procedural how-to for _this project_ — never abstract explanations of _what something is_.

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

## Where things live

| Question you have                    | File                                                                         |
| ------------------------------------ | ---------------------------------------------------------------------------- |
| What should this project do?         | `docs/wiki/requirements.md` — living spec; code that disagrees is the bug    |
| How is it built?                     | `docs/wiki/architecture.md` (stack, patterns, testing strategy)              |
| What does this feature do, exactly?  | `docs/wiki/entities/<slug>.md` — one page per feature/module; Behavior cases |
| Why did we choose X?                 | `docs/wiki/decisions/` — ADRs                                                |
| What pattern do we use for X?        | `docs/wiki/concepts/` — patterns, conventions, domain ideas                  |
| What can go wrong?                   | `docs/wiki/gotchas.md` — known failure points                                |
| What's next?                         | `docs/wiki/todos.md` — priority-ordered queue; `[wiki]` lines are lint work  |
| What's shipped?                      | git history — closed todos are **removed** from `todos.md`                   |
| How do I run the tests?              | `docs/wiki/commands.md` — working shell commands                             |
| Branch / commit rules?               | `docs/wiki/git-conventions.md`                                               |
| What happened, and when?             | `docs/wiki/log.md` — chronological ops log                                   |
| What wiki cleanup is deferred?       | `docs/wiki/wiki-todos.md` — `/project:wiki-lint` processes it                |
| What did source X say?               | `docs/wiki/summaries/` — one page per ingested source in `docs/raw/`         |
| Where are the immutable sources?     | `docs/raw/` — `interviews/`, `research/`; append-only                        |
| What are the binding rules?          | `.claude/rules/behavioral.md`                                                |
| How do I structure a wiki page?      | `.claude/skills/wiki-update/SKILL.md` — standard + templates                 |

Navigation is via the directory tree and Obsidian's graph — there is no hand-maintained `index.md`, no separate `glossary.md`. Folders are **surface grouping only**; a page's `domains`/`abstraction` facets live in frontmatter, not in the path.

The wiki follows the **Obsidian LLM-wiki standard**. The full standard — templates, facet vocabulary, link ontology, placement/dedup procedure — lives in the [`wiki-update` skill](.claude/skills/wiki-update/SKILL.md); the non-negotiable invariants are behavioral rule 18. Gap and contradiction detection is computable (run by `/project:wiki-lint`), never intuition.

## Slash commands

**Every command takes free-text context as its argument** — `/project:init review the legacy files`, `/project:work the login endpoint`, `/project:review security only`. The argument scopes or steers that command; it never bypasses preconditions, the Red phase, or a human checkpoint. Omit it to get the default behavior in the Purpose column.

| Command                | Purpose                                                                                                                              | Argument                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| `/project:init`        | Detect project state, scaffold `docs/wiki/`, fill base docs, initialize git if needed                                                | Context to read first, or a stated fact             |
| `/project:interview`   | Grill-me-relentlessly Q&A for requirements or a new feature. Streams a transcript to `docs/raw/interviews/`, then updates the wiki   | The topic to grill on                               |
| `/project:work`        | Pick the top todo (or batch), branch from `develop`, dispatch the `planner` (complex/batched) then the `developer`, commit, push, PR | Which todo/entity to work, or a batch               |
| `/project:adversary`   | Point a read-only second model (Opus, fresh context) at the current diff. Findings only — you triage each one. Per-change            | Base ref to diff against, or a lens                 |
| `/project:review`      | Thorough review of code vs wiki. Runs the `reviewer` in a fresh worktree with isolated context                                       | Area or lens to pin the review to                   |
| `/project:wiki-lint`   | Wiki health check: reconciliation, lint invariants, orphans, broken links, drift; archives `log.md` when it overflows                | Subtree or single check to focus on                 |
| `/project:wiki-ingest` | Ingest a file or research topic into the wiki (`spec.pdf`, or `search for ...`)                                                      | The file path or research query (**required**)      |
| `/project:agent-scout` | Post-init survey: recommends agents and skills tailored to this project's stack, domain, and services                                | Signal category, feature, or output filter          |

Routine git operations (checkpoint tag, reset, status/log) use plain git, not bespoke commands.

## Agent routing

| Task                                            | Agent                                                                  |
| ----------------------------------------------- | ---------------------------------------------------------------------- |
| Decompose a `[complex]` or batched todo         | `planner` (Opus) — dispatched by `/project:work` before the developer  |
| TDD cycle — red → green → refactor → wiki        | `developer` — dispatched by `/project:work`; loads skills on demand    |
| Adversarial diff review before commit           | `adversary` (Opus, fresh context) — `/project:work` step 7a, or `/project:adversary` |
| Periodic full audit (≈every 5 todos)            | `reviewer` (worktree-isolated) — via `/project:review`                 |
| Periodic wiki health, ingest, cross-link        | `wiki-maintainer` — **manual only** via `/project:wiki-lint`           |
| Web research — search, fetch, synthesize        | `researcher` — via `/project:wiki-ingest` or directly by the human     |

There is intentionally no domain-specialized agent (no "backend agent"). Domain knowledge lives in skills the `developer` loads on demand. The `planner` and the `adversary` run on **Opus** — the adversary deliberately on a different tier from the `developer` it reviews, so the second reader is a second *model*, not just a second context. All other agents run on Sonnet (researcher on Haiku).

**Wiki edits — inline only.** The `developer` and `reviewer` make small wiki edits **inline** in the same commit as the code (Behavior tick, single ADR, single gotcha line, log entry). Larger cross-page work is queued in `wiki-todos.md` for the human to run `/project:wiki-lint`. **No agent auto-invokes the wiki-maintainer.**

## Skill catalog

**Meta skill** — evolves the agent's own toolkit: `update-toolkit` (agents, skills, commands).

**Core process skills:** `tdd-loop`, `plan-writing`, `adversarial-review`, `wiki-update`, `feature-branching`, `pr-create`, `human-checkpoint`, `spec-writing`, `decision-recording`, `gotcha-recording`, `git-recovery` (git edge cases + conflict resolution).

Stack-specific skills (`backend-impl`, `database-impl`, …) are not shipped by default. `/project:interview` and `/project:agent-scout` add them once the stack is known.
