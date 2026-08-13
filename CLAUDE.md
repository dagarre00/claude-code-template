# Project Schema — Wiki-Driven Rapid Prototyping

This repository is a **template for agentic prototyping**. It is the fast-loop sibling of the same template's rigorous track: same wiki, same interview, same knowledge discipline — but no TDD, no planner, no adversary, no periodic audit. Three ideas govern everything:

1. **The wiki is the spec.** `docs/wiki/` is the source of truth for what the prototype is and how it works. Code that disagrees with the wiki is the bug. Speed here comes from skipping *tests*, never from skipping the spec.
2. **Running it is the proof.** There is no test suite. A slice is done when the agent has actually launched the thing, exercised the path, and pasted the real output. Rule 2 and rule 3 in [`.claude/rules/behavioral.md`](.claude/rules/behavioral.md) are what make this template trustworthy rather than merely fast.
3. **The technical layer is assumed, not discussed.** Stack, storage, config, process model, deployment — the agent picks them itself under a fixed hardware envelope (one modest always-on consumer box) and records the choice. The human is interviewed about **product logic and gaps only**.

The hard behavioral constraints live in [`.claude/rules/behavioral.md`](.claude/rules/behavioral.md) — read them; they override default inclinations. This file is the map; that file is the law.

## Identity

You are an AI prototyping agent working on this project. At the top of every session, read this file. Then, **before any implementation or code change**, check the wiki — never modify behavior blind:

1. Read `docs/wiki/gotchas.md` for known failure points.
2. Read `docs/wiki/todos.md` to know what's next.
3. If the task touches a feature, read the matching `docs/wiki/entities/<slug>.md` — its `## Slices` and `## Shortcuts` sections — and the relevant part of `docs/wiki/requirements.md`.
4. Read `docs/wiki/architecture.md § Stack` and `§ Prototype constraints` before adding any dependency.
5. Grep `docs/wiki/` for terms from the task to find related concepts, decisions, or summaries before you act.
6. Let any matching skill auto-load — skills tell you the procedure for _this project's_ build loop, branching, wiki updates, etc.

## Operating principles

- **Slice → build → run → record.** The unit of work is a slice: the smallest thing you can demonstrate running. One slice, one run, one commit.
- **Assume the technical layer.** Never ask the human which framework, database, or deploy target. Pick it under the envelope, record it in `architecture.md`, file an ADR if it was a real fork, and move on.
- **Shortcuts are declared.** Hardcode and stub freely — then write the line in `## Shortcuts` saying what you faked. That section is the prototype's most valuable output.
- **Progressive disclosure.** Agents start with minimal context. Skills load on demand based on task content. Never preload knowledge an agent doesn't need yet.
- **Skills are how-to, not what-is.** Every skill body is a procedure for _this project_. No skill explains what a backend or a REPL _is_.
- **Wiki always current.** Code edits and wiki edits ship together, in the same commit.
- **Human in the loop for product, not for plumbing.** Ambiguous logic, a missing decision, a risky operation → stop and ask via `human-checkpoint`. Which JSON library → decide it yourself.

## Three layers

1. **Raw sources** — `docs/raw/` (immutable, append-only inbox). Interviews, notes, articles, PDFs. The human deposits; agents read but never edit.
2. **Wiki** — `docs/wiki/` (LLM-owned). The compiled state: durable, atomic, reconciled pages. Agents compile `raw → wiki` and reconcile continuously; the human browses (e.g. in Obsidian) and answers clarification questions. Never invent knowledge to plug a hole — record it in `open_questions` or ask.
3. **Schema** — this file plus `.claude/rules/behavioral.md`, `.claude/agents/`, `.claude/skills/`, `.claude/commands/`. Tells agents how to operate.

## Where things live

| Question you have                    | File                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| What should this prototype do?       | `docs/wiki/requirements.md` — living spec; code that disagrees is the bug      |
| What stack, and why that one?        | `docs/wiki/architecture.md` — Stack, Prototype constraints, assumed defaults   |
| What does this feature do, exactly?  | `docs/wiki/entities/<slug>.md` — one page per feature; Slices + Shortcuts      |
| Has this been shown working?         | `docs/wiki/entities/<slug>.md § Demonstrations` — command + observed output    |
| What's faked or hardcoded?           | `docs/wiki/entities/<slug>.md § Shortcuts` — the honesty ledger                |
| Why did we choose X?                 | `docs/wiki/decisions/` — ADRs (short; prototypes file few)                     |
| What pattern do we use for X?        | `docs/wiki/concepts/` — patterns, conventions, domain ideas                    |
| What can go wrong?                   | `docs/wiki/gotchas.md` — known failure points                                  |
| What's next?                         | `docs/wiki/todos.md` — priority-ordered queue; `[wiki]` lines are lint work    |
| What's shipped?                      | git history — one commit per demonstrated slice; closed todos **removed**      |
| How do I run it?                     | `docs/wiki/commands.md` — working shell commands; `## Run` is the important one |
| Branch / commit rules?               | `docs/wiki/git-conventions.md`                                                 |
| What happened, and when?             | `docs/wiki/log.md` — chronological ops log                                     |
| What wiki cleanup is deferred?       | `docs/wiki/wiki-todos.md` — `/project:wiki-lint` processes it                  |
| What did source X say?               | `docs/wiki/summaries/` — one page per ingested source in `docs/raw/`           |
| Where are the immutable sources?     | `docs/raw/` — `interviews/`, `research/`; append-only                          |
| What are the binding rules?          | `.claude/rules/behavioral.md`                                                  |
| How do I structure a wiki page?      | `.claude/skills/wiki-update/SKILL.md` — standard + templates                   |

Navigation is via the directory tree and Obsidian's graph — there is no hand-maintained `index.md`, no separate `glossary.md`. Folders are **surface grouping only**; a page's `domains`/`abstraction` facets live in frontmatter, not in the path.

The wiki follows the **Obsidian LLM-wiki standard**. The full standard — templates, facet vocabulary, link ontology, placement/dedup procedure — lives in the [`wiki-update` skill](.claude/skills/wiki-update/SKILL.md); the non-negotiable invariants are behavioral rule 18. Gap and contradiction detection is computable (run by `/project:wiki-lint`), never intuition.

## Slash commands

**Every command takes free-text context as its argument** — `/project:init read my notes.md`, `/project:work the upload page`, `/project:interview the sync logic`. The argument scopes or steers that command; it never bypasses preconditions, the demonstration, or a human checkpoint. Omit it to get the default behavior in the Purpose column.

| Command                | Purpose                                                                                                                  | Argument                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| `/project:init`        | Detect state, pick the stack silently, scaffold `docs/wiki/`, bootstrap a **runnable** skeleton, initialize git if needed | Context to read first, or a stated fact        |
| `/project:interview`   | Grill-me-relentlessly Q&A over **product logic and gaps** — never over the stack. Streams a transcript, then updates the wiki | The topic to grill on                       |
| `/project:work`        | Pick the top todo, branch, build the slice, **run it**, record the evidence, commit, push. The core loop                  | Which todo/entity/slice to work                |
| `/project:demo`        | Run the whole prototype end-to-end as it stands and report what actually works, slice by slice                            | Which entity or path to demo                   |
| `/project:graduate`    | Export a single self-contained handoff `.md` — feed it to `/project:init` in a full-workflow repo to restart with rigor   | What to emphasize, or the output path          |
| `/project:wiki-lint`   | Wiki health check: reconciliation, lint invariants, orphans, broken links, drift; archives `log.md` when it overflows     | Subtree or single check to focus on            |
| `/project:wiki-ingest` | Ingest a file or research topic into the wiki (`spec.pdf`, or `search for ...`)                                           | The file path or research query (**required**) |
| `/project:agent-scout` | Post-init survey: recommends skills tailored to this prototype's stack and domain                                         | Signal category, feature, or output filter     |

Routine git operations (checkpoint tag, reset, status/log) use plain git, not bespoke commands.

**Deliberately absent** (they live in the rigorous track, not here): `/project:review`, `/project:adversary`. If the prototype has reached the point where you want a second model auditing it, that is the signal to run `/project:graduate` and move to the full workflow.

## Agent routing

| Task                                     | Agent                                                             |
| ---------------------------------------- | ----------------------------------------------------------------- |
| Build a slice — code → run → record → wiki | `builder` — dispatched by `/project:work`; loads skills on demand |
| Periodic wiki health, ingest, cross-link | `wiki-maintainer` — **manual only** via `/project:wiki-lint`      |
| Web research — search, fetch, synthesize | `researcher` — via `/project:wiki-ingest` or directly by the human |

There is intentionally no domain-specialized agent (no "backend agent"), no planner, and no reviewing agent of any kind. Domain knowledge lives in skills the `builder` loads on demand; planning a prototype in advance is usually slower than building the first slice; and the review role is filled by the human watching the thing run.

**Wiki edits — inline only.** The `builder` makes small wiki edits **inline** in the same commit as the code (slice tick, shortcut line, single ADR, single gotcha, log entry). Larger cross-page work is queued in `wiki-todos.md` for the human to run `/project:wiki-lint`. **No agent auto-invokes the wiki-maintainer.**

## Skill catalog

**Meta skill** — evolves the agent's own toolkit: `update-toolkit` (agents, skills, commands).

**Core process skills:** `build-loop`, `slice-writing`, `stack-assumption`, `graduation-export`, `wiki-update`, `feature-branching`, `human-checkpoint`, `decision-recording`, `gotcha-recording`, `git-recovery` (git edge cases + conflict resolution).

Stack-specific skills (`backend-impl`, `database-impl`, …) are not shipped by default. `/project:agent-scout` adds them once the stack has settled.

## Graduating out of this template

This template is for finding out whether an idea works. When it does — when you want tests, review, and a spec you can defend — run `/project:graduate`. It writes one self-contained markdown handoff (requirements, slices as draft behavior cases, stack + why, every declared shortcut, open questions) that you hand to `/project:init` in a repo running the full workflow. Don't try to bolt TDD onto this branch; the two tracks are deliberately separate.
