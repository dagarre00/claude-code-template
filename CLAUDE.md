# Project Schema — Wiki-Driven, TDD-Enforced Development

This repository is a **template** for an agentic software-development workflow built around two ideas:

1. **The wiki is the spec.** `docs/wiki/` is the source of truth for what the project is. Code that disagrees with the wiki is the bug.
2. **TDD is harness-enforced, not honor-system.** No production code without a failing test first. The `test-first-check.sh` hook blocks code edits without a matching test on `feat/*` and `fix/*` branches.

## Identity

You are an AI development agent working on this project. Read this file at the top of every session. Then, before every task:

1. Read `docs/wiki/gotchas.md` for known failure points.
2. Read `docs/wiki/todos.md` to know what's next.
3. If the task touches a feature, read the matching `docs/wiki/entities/<slug>.md` and `docs/wiki/requirements.md`.

## Template → Project bootstrap

This repository ships as a **template**. The first time `/project:interview` or `/project:init` runs successfully on a clone, the template becomes a real project. At that moment, the schema files in this repo must be specialized to the project — they are written generically right now and will lie if left alone.

Trigger: end of `/project:interview` (after `requirements.md` is approved) **or** end of `/project:init` (if no `requirements.md` exists yet but the stack is detected). The agent running that command MUST do the bootstrap before reporting the command as complete.

Bootstrap checklist — update each file so it reflects the actual project, not the generic template:

1. **`CLAUDE.md`** (this file)
   - Replace the opening paragraph with a one-paragraph description of the actual project.
   - Add a `## Project context` section right after `## Identity` listing: project name, one-line vision, primary stack, primary entities (linking `[[entities/<slug>]]`).
   - Leave Operations / Frontmatter / Slash Commands / Golden Rules sections untouched — they're stack-agnostic.

2. **`HUMAN.md`**
   - Replace the "What is this?" intro with the project's actual purpose.
   - Update the Quick start commands if the stack adds project-specific bootstrap steps (e.g. `docker compose up`, `pnpm install`).

3. **`SETUP.md`**
   - Add stack-specific install steps under a new `## Project setup` section (Python venv, Node dependencies, DB migrations, env vars).

4. **`.claude/agents/initializer.md`**
   - Mark as superseded with `status: shipped` in frontmatter — the initializer is one-shot and shouldn't run again. Optionally delete it.

5. **`.claude/agents/tester.md`, `implementer.md`**
   - Append a `## Project conventions` section pointing to the test command in `docs/wiki/commands.md` and the test-file naming in `docs/wiki/architecture.md`. No need to duplicate them — just point.

6. **`.claude/skills/code-style/SKILL.md`, `git-conventions/SKILL.md`**
   - These already point to `docs/wiki/architecture.md` — verify that page now has real content (not the template stub).

7. **`docs/wiki/gotchas.md`**
   - Delete the example bullets under `## Examples`. Real gotchas accumulate as the project runs.

8. **`README.md`** (create if absent)
   - One paragraph + link to HUMAN.md + link to docs/wiki/index.md. The repo has no README in template form by design — the project gets its own.

9. **Commit the bootstrap as `chore: bootstrap template for <project-name>`** so the template-vs-project transition is visible in git history.

After this commit, `/project:work` is the normal entry point. The template phase is over.

## The Three Layers

1. **Raw sources** — `docs/raw/` (immutable drop-zone)
   User-provided and agent-emitted documents: interview transcripts, meeting notes, spec PDFs, research articles, API docs, agent memory snapshots. Agents **read from** but never **edit** raw files — they only append new ones.

2. **Wiki** — `docs/wiki/` (LLM-owned)
   Every markdown file here is written and maintained by the LLM. Entities, concepts, decisions, summaries, living specs. This is your single browsable knowledge base (open `docs/` in Obsidian).

3. **Schema** — this file (`CLAUDE.md`) plus `.claude/rules/behavioral.md`
   Tells agents how to operate: layout, frontmatter, ingest/query/lint, TDD loop, hard rules.

## Wiki Directory Layout

```
docs/
├── raw/                        # immutable sources
│   ├── index.md                # catalog + ingestion status per source
│   ├── interviews/             # /project:interview and /project:feature output
│   └── <user-dropped-files>    # PDFs, markdown, transcripts, anything
├── wiki/                       # LLM-owned knowledge base
│   ├── index.md                # content catalog (one-line per page)
│   ├── log.md                  # append-only ops log
│   ├── requirements.md         # LIVING SPEC — code must match
│   ├── architecture.md         # stack, conventions, patterns, testing strategy
│   ├── todos.md                # current TODO queue (priority-ordered)
│   ├── completed.md            # shipped work with wiki-link back-refs
│   ├── gotchas.md              # known failure points
│   ├── commands.md             # working shell commands (incl. test command)
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

### TDD coverage check
Trigger: `/project:tdd-check` after a batch of work or before `/project:review`.
Lists every entity whose `## Behavior` bullets aren't yet realized in test files. Surfaces shipped entities with no tests as Critical drift.

## Code-Development Adaptation

This repo is not a passive knowledge base — it builds software. The wiki is the **spec**; the code is the **implementation**; the tests are the **contract** between them.

### The code-wiki contract
- `docs/wiki/requirements.md` is authoritative. If code contradicts it, either the code is wrong or the spec needs to be updated in the same change.
- `docs/wiki/entities/<feature>.md` documents each feature's expected behavior, interface, and design. Each `## Behavior` bullet is a test contract: the tester agent derives ≥1 test per bullet.
- `docs/wiki/decisions/` holds ADRs. Any non-trivial design call gets a decision page.

### The `/project:work` loop (spec-driven, TDD-enforced)

**Classify first** — read the top 3 Pending TODOs and assign each:
- **Simple** — ≤2 files, <50 lines, no new dependencies, no ADR-worthy decision. Main agent handles all phases.
- **Complex** — multiple files, new patterns, external dependencies, or ADR-worthy decisions. Multi-agent dispatch.
- **Batch** — 2–3 consecutive Simple TODOs sharing the same entity or overlapping files. Context loaded once, implemented together.

Then run:

1. **Query** — load `wiki/requirements.md` + relevant entities + `wiki/gotchas.md`. One load serves the whole batch.
2. **Spec** — verify entity `## Behavior` has concrete Given/When/Then cases. Expand if vague — this is the test contract.
3. **Plan** — draft implementation plan via `superpowers:writing-plans`, present to user, wait for confirmation.
4. **Branch** — `feat/<slug>` (never commit to main). The branch name turns on TDD enforcement.
5. **Red** — write all failing tests for the batch/task from `## Behavior`. Run them. **Confirm all RED for the right reason** (missing feature, not import errors). Print failure count.
   - Simple/Batch: main agent writes tests directly.
   - Complex: tester agent writes tests + emits `.claude/handoff/<slug>.json` with `red_confirmed: true`, `red_command`, `red_failure_count`.
6. **Green** — write minimal code to pass all tests. The `test-first-check.sh` hook blocks code edits with no matching test — by design.
   - Simple/Batch: main agent implements.
   - Complex: implementer agent re-runs `red_command` to verify reproducibility, then implements, then deletes the handoff.
7. **Refactor** — clean up. Tests must stay GREEN.
8. **Verify** — run the full suite fresh. 0 failures or it's not done.
9. **Update wiki** — revise entity page (Behavior + Code References), add ADRs, move TODO(s) to `completed.md`, append to `log.md`.
   - Simple/Batch: update entity page inline; dispatch wiki-maintainer for full update every **3 simple TODOs**.
   - Complex: dispatch wiki-maintainer immediately after each task.
10. **Commit** — conventional message referencing the TODO slug(s). Never commit while red.

**Reviewer is periodic** — runs every ~5 completed TODOs via `/project:review`, not in this loop.

## Frontmatter Convention

Every `.md` in `.claude/` (agents, commands, skills, rules) and in `docs/wiki/` must have frontmatter so the harness can discover and route correctly:

```yaml
---
name: <kebab-case-short-name>
description: <one line, action-oriented — when/why to use>
type: agent | command | skill | rule | wiki-entity | wiki-concept | wiki-decision | wiki-summary | wiki-index | wiki-log | wiki-spec
---
```

Wiki pages may add: `sources:` (list of raw paths), `updated: YYYY-MM-DD`, `status: draft|approved|stale|shipped|deprecated`.

Agents only need the standard Claude Code fields: `name`, `description`, `type`, `tools`, `model`. Other fields (`memory`, `effort`, `color`, `background`, `maxTurns`) are not standard harness features and are not used.

## Slash Commands

### Project commands (`/project:*`)
| Command | Purpose |
|---------|---------|
| `/project:interview` | **Initial** project requirements Q&A → full project scope, rewrites `wiki/requirements.md` from scratch |
| `/project:feature` | **Incremental** feature interview → appends to `requirements.md`, creates entity page + Behavior spec, seeds TODOs |
| `/project:init` | Detect stack, scaffold wiki, seed `architecture.md` |
| `/project:work` | Classify TODOs (simple/complex/batch) → spec → red → green → refactor → update wiki → commit |
| `/project:tdd-check` | Audit which entities have unrealized Behavior cases (no matching tests) |
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

## Agent Routing

| Task | Agent |
|------|-------|
| TDD Red phase (write failing tests) | tester |
| TDD Green+Refactor (make tests pass) | implementer |
| Periodic full audit (~every 5 TODOs) | reviewer |
| First-time setup | initializer |
| Raw→wiki ingestion, lint, cross-linking | wiki-maintainer |

There is intentionally **no researcher or orchestrator**: research happens via `/wiki:query`, orchestration is the explicit loop in `/project:work`. The reviewer is **not** part of the work loop — it is a periodic quality gate.

## Sub-agent dispatch rules

- Each sub-agent gets **scoped context** — task, prior outputs, relevant constraints. Never dump full memory.
- Tester → implementer → wiki-maintainer is the complex-path order. Simple TODOs stay in the main agent.
- Use `/wiki:query <question>` for research before building — there is no separate researcher agent.

## Hooks (harness enforcement)

Configured in `.claude/settings.json`:

| Hook | Phase | Purpose |
|------|-------|---------|
| `test-first-check.sh` | PreToolUse on Write/Edit | Blocks code edits on `feat/*`/`fix/*` without a matching test file |
| `auto-format.sh` | PostToolUse on Write/Edit | Runs ruff/black/prettier/gofmt/rustfmt by extension |
| `raw-index-sync.sh` | PostToolUse on Write/Edit | Auto-catalogs new files under `docs/raw/` as `pending` |
| `code-ref-check.sh` | PostToolUse on Write/Edit | Reminds when source files lack a Code References section in any entity page |
| `wiki-drift-check.sh` | Stop | Warns when code was edited but no wiki page was touched this session |
| `raw-pending-check.sh` | Stop | Warns when raw sources are still `pending` at session end |
| `on-task-complete.sh` | Stop | Appends a row to `docs/changelog.md` |
| `auto-checkpoint.sh` | Stop | Tags `checkpoint-<timestamp>-auto` if anything changed since the last checkpoint |

These run regardless of agent. They are the harness — agents cannot opt out.

## Golden Rules

1. **Wiki is truth.** Code that disagrees with the wiki is the bug.
2. **No code without a failing test.** Spec → test → code, in that order. The hook enforces this on `feat/*`/`fix/*` branches.
3. **Never modify tests to make them pass.** Update the spec first, regenerate the test, then implement.
4. **Always update the wiki in the same change.** Touch `src/` → touch the entity page. The `wiki-drift-check` hook warns at session end.
5. **Never modify `docs/raw/` content.** Append only. Raw sources are immutable.
6. **Agents own `docs/wiki/`.** Users browse it, agents write it.
7. **One source → many page touches.** Ingest should touch ~5–15 pages; fewer means under-integrated.
8. **File back valuable queries.** Non-obvious `/wiki:query` output → save as `concepts/` page.
9. **Always branch before coding.** Never commit to main.
10. **Conventional commits:** `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.
11. **Two-strike rule.** Two failed implementations → `/project:rollback`, retry from spec.
12. **Reviewer is periodic.** `/project:review` every ~5 TODOs — not in the work loop. Reviewer creates `review/YYYY-MM-DD` branch before writing anything.

## What's Stored Where (quick lookup)

| Concern | Location |
|---------|----------|
| What the project should do | `docs/wiki/requirements.md` |
| How it's built | `docs/wiki/architecture.md` + `docs/wiki/entities/*` |
| Why we chose X | `docs/wiki/decisions/*` |
| What can go wrong | `docs/wiki/gotchas.md` |
| What's next | `docs/wiki/todos.md` |
| What's shipped | `docs/wiki/completed.md` |
| Working shell commands (incl. test) | `docs/wiki/commands.md` |
| Project tree | `docs/wiki/file-map.md` |
| Timeline of ops | `docs/wiki/log.md` |
| Session summaries | `docs/changelog.md` (hook-maintained) |
| Raw sources (immutable) | `docs/raw/` |
| Hard behavioral constraints | `.claude/rules/behavioral.md` |
