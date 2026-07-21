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
- **Wiki always current.** Code edits and wiki edits ship together. The `wiki-drift-check` hook warns right after an edit (PostToolUse) if you touched code but no wiki page.
- **Human in the loop.** When the agent needs the human (uncommitted decisions, missing inputs, risky ops), it stops and asks via the `human-checkpoint` skill — never silently improvises.

## Three layers

1. **Raw sources** — `docs/raw/` (immutable drop zone, append-only inbox). Interview transcripts, meeting notes, articles, PDFs. The human deposits; agents read but never edit; only append.
2. **Wiki** — `docs/wiki/` (LLM-owned). The **compiled state**: durable, atomic, reconciled pages. Project basics (`requirements.md`, `architecture.md`, `git-conventions.md`), entities, concepts, decisions, summaries, log, todos. Agents compile `raw → wiki` and reconcile continuously; the human browses (e.g. with Obsidian) and **answers clarification questions**. The question flow is bidirectional: the human queries the wiki, the agent asks the human when it hits a gap it can't fill from `docs/raw/`. Never invent knowledge to plug a hole — record it in `open_questions` or ask.
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

Folders are **surface grouping only** — never encode semantics in the path. A page can belong to several `domains` and one `abstraction` at once; that lives in frontmatter facets, not in the directory it happens to sit in.

## Slash commands

| Command                | Purpose                                                                                                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/project:init`        | Detect project state, scaffold `docs/wiki/`, fill base docs (requirements, architecture, git-conventions, commands), initialize git if needed                                                                            |
| `/project:interview`   | Grill-me-relentlessly Q&A. Used both for initial requirements and for adding features. Writes a transcript to `docs/raw/interviews/`, then updates affected wiki pages                                                   |
| `/project:work`        | Pick the top todo (or batch consecutive todos sharing context), open a `feat/*` branch from `develop`, dispatch the `planner` (Opus) for complex/batched work, then the `developer` through red→green→refactor→wiki-update, then commit, push, and — if the entity's Behavior cases are all done — open a PR to `develop` and return to `develop` |
| `/project:review`      | Throughout review of code vs wiki. Runs the `reviewer` in a fresh worktree with isolated context                                                                                                                         |
| `/project:wiki-lint`   | Health-check the wiki: computable reconciliation pass (schema gaps, asymmetric relations, unresolved `contradicts`), lint invariants, orphans, broken links, drift; compacts `gotchas.md`; archives `log.md` when it overflows |
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
- `feature-branching` — how to start/finish a feature branch
- `pr-create` — how to draft a PR body when the human asks to open one
- `human-checkpoint` — when and how to pause for the human
- `spec-writing` — how to write entity Behavior cases that produce good tests (and the canonical `[ ]`/`[~]`/`[x]` notation)
- `decision-recording` — how to file an ADR
- `gotcha-recording` — how to capture a failure mode for future agents

Stack-specific skills (e.g. `backend-impl`, `database-impl`, `frontend-impl`) are not shipped by default. `/project:interview` adds them after the stack is known.

## Frontmatter convention

Two regimes, one per layer:

**Schema files (`.claude/`)** carry harness-routing frontmatter, unchanged:

```yaml
---
name: <kebab-case-short-name>
description: <one line, action-oriented — when/why to use; for skills, this is the trigger>
type: agent | command | skill | rule
---
```

Skills in particular need a precise `description` because Claude Code uses it to decide whether to load the skill. State _exactly_ what triggers the skill — the keywords, the situations, the tool calls.

**Wiki pages (`docs/wiki/`)** follow the **Obsidian LLM-wiki standard** (source: `docs/raw/llm-wiki-obsidian-standard.md`; adoption ADR: `docs/wiki/decisions/2026-07-21-adopt-obsidian-llm-wiki-standard.md`). Guiding principle: **a structural field is only justified if it makes an absence (gap) or a conflict (contradiction/duplicate) computable.** The essentials, always in force:

- **Identity = filename.** No `name:` or `id:` field. Alternative names go in `aliases` — that is the anti-duplicate mechanism. Filenames avoid the illegal characters `* " \ / < > : | ? # ^ [ ]`.
- **One page = one concept.** Before creating a page, compare its essence against existing filenames and `aliases`. If the concept exists under another name → update it, never duplicate. Merge/split only whole concepts.
- **Flat frontmatter.** No nested YAML objects (Obsidian renders them as illegible blobs). Each relation is a top-level list property. Special keys plural: `tags`, `aliases`, `cssclasses`.
- **Wikilinks in properties: quoted and solitary.** List properties, one `"[[page]]"` per element — never several wikilinks in one value. That's what makes them count in graph and backlinks.
- **Closed facet vocabulary** (designed as Bases/Dataview columns and filters; lowercase, `snake_case`): `type: concept | procedure | reference | tutorial | entity | decision | summary`; `abstraction: principle | pattern | technique | instance`; `domains: [...]` (free but controlled); `status: stub | developing | stable` (decisions instead use `proposed | accepted | superseded | deprecated`).
- **Fixed link ontology**, each a list property of quoted solitary wikilinks: `implements`, `specializes`, `contrasts_with`, `alternative_to`, `depends_on`, `contradicts` (+ `supersedes`/`superseded_by` on decisions). Each type has *expected* links — gaps are computed from them, not intuited.
- **Body disclosure spine:** `> [!abstract] Essence` callout → `## Model` → `## Detail` → `## Boundaries` → `## Provenance`. Depth (disclosure sections) and semantic level (`abstraction` facet) are independent axes on the same page.
- **Provenance.** Every non-trivial claim traces to a `docs/raw/` file. `sources:` lists the raw paths; the `## Provenance` section maps claim ← source.
- **Dates:** `created` and `updated` (`YYYY-MM-DD`).

Full templates, facet/ontology tables, and placement procedure live in the `wiki-update` skill. Gap and contradiction detection is computable (run by `/project:wiki-lint`), not intuition — a gap is a hole in the graph relative to this schema, never "what feels missing".

## Hooks

Wired in `.claude/settings.json`:

| Hook                  | Phase                  | Purpose                                                                                                                                                                              |
| --------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `session-start.sh`    | SessionStart           | Warn on upstream divergence (no auto-pull), detect Python venv, warn on uncommitted — all to **stdout** (injected into the model's context); record HEAD SHA to `.claude/tmp/session-start-sha`; reset per-session dedup markers                                                              |
| `session-end.sh`      | Stop                   | Prompt to commit if dirty, append a session entry to `docs/wiki/log.md` (only when new commits landed since the last entry — never empty stamps or per-turn duplicates)              |
| `test-first-check.sh` | PreToolUse Write/Edit  | **Reminder, not a block:** on `feat/*` / `fix/*`, nudges via model-facing `additionalContext` (once per session) when production code is edited with no test in the session's changes yet                                                            |
| `auto-format.sh`      | PostToolUse Write/Edit | Run formatter by file extension                                                                                                                                                      |
| `wiki-drift-check.sh` | PostToolUse Write/Edit | Warn via model-facing `additionalContext` (once per drift-state) if source code changed this session but no `docs/wiki/` page has been touched; marker clears when the wiki is touched (scoped via the session-start SHA marker)                     |

## Golden rules

1. **Wiki is truth.** Code that disagrees with the wiki is the bug.
2. **No code without a failing test.** Test-first is the default; the `test-first-check` hook _reminds_ (no longer blocks) on `feat/*`/`fix/*`.
3. **Never modify a test to make it pass.** Update the spec → regenerate the test → implement.
4. **Always update wiki in the same change.** Touching `src/` requires touching the entity page.
5. **Never modify `docs/raw/` content.** Append only.
6. **Agents own `docs/wiki/`.** Humans browse; agents write.
7. **Always branch before coding.** Never commit to main.
8. **Conventional commits.** `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.
9. **Two-strike rule.** Two failed implementations on the same mechanism → tag a checkpoint (`git tag`), `git reset --hard` to a known-good commit, and retry from spec.
10. **Reviewer is periodic.** `/project:review` every ~5 todos — not in `/project:work`. Reviewer runs in a fresh worktree.
11. **Human-in-the-loop.** When you need a decision the wiki doesn't answer, stop and ask. Don't guess.
12. **Skills are how-to.** When the project gains a new domain or pattern, add a skill via `update-skill` — don't bury knowledge in agent prompts.
13. **Finalize with commit + push.** Every command or agent that mutates tracked files ends by committing and pushing to the working branch (`git push -u origin <branch>`) — an unpushed commit is lost when the container recycles. Only read-only commands are exempt.

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
