# Project Schema — Wiki-Driven Development

This repository follows a **wiki-as-compounding-artifact** methodology adapted for software development.
The wiki is the **source of truth** for what the project is and how it is built. Code must never drift from it.

## The Three Layers

1. **Raw sources** — `docs/raw/` (immutable drop-zone)
   User-provided and agent-emitted documents: interview transcripts, meeting notes, spec PDFs, research articles, API docs, agent memory snapshots. Agents **read from** but never **edit** raw files — they only append new ones.

2. **Wiki** — `docs/wiki/` (LLM-owned)
   Every markdown file here is written and maintained by the LLM. Entities, concepts, decisions, summaries, living specs. This layer replaces the old agent-context + plans + per-doc structure. It is your single browsable knowledge base (open `docs/` in Obsidian).

3. **Schema** — this file (`CLAUDE.md`)
   Tells agents how to operate: what the wiki looks like, how ingest/query/lint work, how code-dev ties into the wiki. The only file in the project that describes the system.

## Wiki Directory Layout

```
docs/
├── raw/                        # immutable sources
│   ├── index.md                # catalog + ingestion status per source
│   ├── interviews/             # /project:interview and /project:feature output lands here
│   └── <user-dropped-files>    # PDFs, markdown, transcripts, anything
├── wiki/                       # LLM-owned knowledge base
│   ├── index.md                # content catalog (one-line per page)
│   ├── log.md                  # append-only ops log
│   ├── requirements.md         # LIVING SPEC — code must match
│   ├── architecture.md         # stack, conventions, patterns
│   ├── todos.md                # current TODO queue (priority-ordered)
│   ├── completed.md            # shipped work with wiki-link back-refs
│   ├── gotchas.md              # known failure points
│   ├── commands.md             # working shell commands
│   ├── file-map.md             # auto-generated project tree
│   ├── entities/               # one page per feature/module/component
│   ├── concepts/               # patterns, conventions, domain ideas
│   ├── decisions/              # ADRs
│   └── summaries/              # one page per ingested raw source
├── changelog.md                # hook-appended session summaries
├── INDEX.md                    # pointer to wiki/index.md
└── SETUP.md                    # qmd install + environment setup
```

## Core Operations

### Ingest
Trigger: `/wiki:ingest` or whenever a new file appears in `docs/raw/`.
The wiki-maintainer agent:
1. Reads each un-ingested source in `docs/raw/`.
2. Writes a summary page to `docs/wiki/summaries/`.
3. Updates affected entity / concept / decision pages (creates new ones if needed).
4. Cross-links: every new page linked from `wiki/index.md` and any related page.
5. Flags contradictions with existing claims — notes them inline with `> ⚠ contradicts [[page#section]]`.
6. Appends one log entry: `## [YYYY-MM-DD] ingest | <source-title>`.
7. Marks the raw source's status in `docs/raw/index.md` as ingested.

### Query
Trigger: `/wiki:query <question>` or inline whenever you need to know something.
The agent:
1. Reads `docs/wiki/index.md` to locate relevant pages.
2. Drills into those pages, follows `[[wiki-links]]` as needed.
3. If qmd is installed, shells out for hybrid search (`qmd search "<query>" docs/wiki/`).
4. Synthesizes an answer with citations like `[[entities/payment-flow#retry-policy]]`.
5. If the answer is non-trivial (a comparison, analysis, new connection), offers to **file it back** as a wiki page under `concepts/` or `decisions/` — queries that compound matter.

### Lint
Trigger: `/wiki:lint` periodically (suggest weekly or after 10+ sources ingested).
The wiki-maintainer:
- Detects contradictions between pages.
- Flags orphan pages (no inbound links) and hub pages that should be split.
- Finds concepts mentioned ≥3 times without their own page.
- Finds broken `[[wiki-links]]`.
- Finds requirements in `wiki/requirements.md` with no corresponding `entities/` page — potential code drift.
- Suggests new questions to investigate and new sources to seek.

## Code-Development Adaptation

This repo is not a passive knowledge base — it builds software. The wiki is the **spec**; the code is the **implementation**. The wiki comes first.

### The code-wiki contract
- `docs/wiki/requirements.md` is authoritative. If code contradicts it, either the code is wrong or the spec needs to be updated in the same change.
- `docs/wiki/entities/<feature>.md` documents each feature's expected behavior, interface, and design. The implementer reads the relevant entity page before writing code and **updates it after**.
- `docs/wiki/decisions/` holds ADRs. Any non-trivial design call gets a decision page.

### The `/project:work` loop (spec-driven TDD)

**Classify first** — read the top 3 Pending TODOs and assign each:
- **Simple** — ≤2 files, <50 lines, no new dependencies, no ADR-worthy decision. Main agent handles all phases.
- **Complex** — multiple files, new patterns, external dependencies, or ADR-worthy decisions. Multi-agent dispatch.
- **Batch** — 2–3 consecutive Simple TODOs sharing the same entity or overlapping files. Context loaded once, implemented together.

Then run:

1. **Query** — load `wiki/requirements.md` + relevant entities + `wiki/gotchas.md`. One load serves the whole batch.
2. **Spec** — verify entity `## Behavior` has concrete Given/When/Then cases. Expand if vague — this is the test contract.
3. **Plan** — draft implementation plan, present to user, wait for confirmation.
4. **Branch** — `feat/<slug>` (never commit to main).
5. **Red** — write all failing tests for the batch/task from `## Behavior`. Confirm all RED.
   - Simple/Batch: main agent writes tests directly.
   - Complex: tester agent writes tests + drops `.claude/handoff/<slug>.json` for structured handoff.
6. **Green** — write minimal code to pass all tests. Confirm all GREEN.
   - Simple/Batch: main agent implements.
   - Complex: implementer agent reads handoff file, implements, deletes handoff file on success.
7. **Refactor** — clean up. Tests must stay GREEN.
8. **Update wiki** — revise entity page, add ADRs, move TODO(s) to `completed.md`, append to `log.md`.
   - Simple/Batch: update entity page inline; dispatch wiki-maintainer for full update every **3 simple TODOs**.
   - Complex: dispatch wiki-maintainer immediately after each task.
9. **Commit** — conventional message referencing the TODO slug(s).

**Reviewer is periodic** — runs every ~5 completed TODOs via `/project:review`, not in this loop.

## Frontmatter Convention

Every `.md` in `.claude/` (agents, commands, skills, rules) and in `docs/wiki/` must have frontmatter so the orchestrator / main agent can discover and route correctly:

```yaml
---
name: <kebab-case-short-name>
description: <one line, action-oriented — when/why to use>
type: agent | command | skill | rule | wiki-entity | wiki-concept | wiki-decision | wiki-summary | wiki-index | wiki-log | wiki-spec
---
```

Wiki pages may add: `sources:` (list of raw paths), `updated: YYYY-MM-DD`, `status: draft|approved|stale`.

## Slash Commands

### Project commands (`/project:*`)
| Command | Purpose |
|---------|---------|
| `/project:interview` | **Initial** project requirements Q&A → full project scope, rewrites `wiki/requirements.md` from scratch |
| `/project:feature` | **Incremental** feature interview → appends to `requirements.md`, creates entity page + Behavior spec, seeds TODOs |
| `/project:init` | Detect stack, scaffold wiki, seed `architecture.md` |
| `/project:work` | Classify TODOs (simple/complex/batch) → spec → red → green → refactor → update wiki → commit |
| `/project:review` | Periodic full audit: all code vs all docs, hidden bugs, stale tests (every ~5 TODOs) |
| `/project:status` | Dump project state |
| `/project:checkpoint` | Git-tag current HEAD + write session snapshot |
| `/project:rollback` | Revert to a checkpoint |
| `/project:fresh` | Resume from checkpoint in a new session |

### Wiki commands (`/wiki:*`)
| Command | Purpose |
|---------|---------|
| `/wiki:ingest [path]` | Process raw/ → wiki (all pending, or specific path) |
| `/wiki:query <question>` | Search wiki, synthesize answer with citations, optionally file back |
| `/wiki:lint` | Health-check the wiki |
| `/wiki:log [n]` | Show last n log entries |

## Golden Rules

1. **Wiki is truth.** Code that disagrees with the wiki is the bug.
2. **Spec before tests, tests before code.** Entity `## Behavior` → failing tests (RED) → implementation (GREEN) → refactor. No exceptions.
3. **Never modify tests to make them pass.** Update the spec first, regenerate the test, then implement.
4. **Always update the wiki in the same change.** Touch `src/` → touch the entity page. The `wiki-drift-check` hook warns at session end.
5. **Never modify `docs/raw/` content.** Append only. Raw sources are immutable.
6. **Agents own `docs/wiki/`.** Users browse it, agents write it.
7. **One source → many page touches.** Ingest should touch ~5-15 pages; fewer means under-integrated.
8. **File back valuable queries.** Non-obvious `/wiki:query` output → save as `concepts/` page.
9. **Always branch before coding.** Never commit to main.
10. **Conventional commits:** `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.
11. **Two-strike rule.** Two failed attempts → pivot.
12. **Rollback over fix-forward.** Two failed implementations → `/project:rollback`.
13. **Reviewer is periodic.** `/project:review` every ~5 TODOs — not in the work loop. Reviewer creates `review/YYYY-MM-DD` branch before writing anything.

## Agent Routing

| Task | Agent |
|------|-------|
| TDD Red phase (write failing tests) | tester |
| TDD Green+Refactor (make tests pass) | implementer |
| Periodic full audit (~every 5 TODOs) | reviewer |
| First-time setup | initializer |
| Raw→wiki ingestion, lint, cross-linking | wiki-maintainer |

There is intentionally **no researcher or orchestrator**: research happens via `/wiki:query`, orchestration is the explicit loop in `/project:work`. The reviewer is **not** part of the work loop — it is a periodic quality gate.

## What's Stored Where (quick lookup)

| Concern | Location |
|---------|----------|
| What the project should do | `docs/wiki/requirements.md` |
| How it's built | `docs/wiki/architecture.md` + `docs/wiki/entities/*` |
| Why we chose X | `docs/wiki/decisions/*` |
| What can go wrong | `docs/wiki/gotchas.md` |
| What's next | `docs/wiki/todos.md` |
| What's shipped | `docs/wiki/completed.md` |
| Working shell commands | `docs/wiki/commands.md` |
| Project tree | `docs/wiki/file-map.md` |
| Timeline of ops | `docs/wiki/log.md` |
| Session summaries | `docs/changelog.md` (hook-maintained) |
| Raw sources (immutable) | `docs/raw/` |
