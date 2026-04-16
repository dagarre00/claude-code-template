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
│   ├── interviews/             # /project:interview output lands here
│   ├── memory-snapshots/       # agents drop knowledge dumps here
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
- Flags approved/shipped entity pages missing a `## Code References` section.
- Flags Code References rows where the referenced file no longer exists (broken references).
- Flags entity pages whose `<!-- Last verified: -->` date lags the `updated:` frontmatter by more than 30 days.
- Suggests new questions to investigate and new sources to seek.

## Code-Development Adaptation

This repo is not a passive knowledge base — it builds software. The wiki is the **spec**; the code is the **implementation**. The wiki comes first.

### The code-wiki contract
- `docs/wiki/requirements.md` is authoritative. If code contradicts it, either the code is wrong or the spec needs to be updated in the same change.
- `docs/wiki/entities/<feature>.md` documents each feature's expected behavior, interface, and design. The implementer reads the relevant entity page before writing code and **updates it after**.
- `docs/wiki/decisions/` holds ADRs. Any non-trivial design call gets a decision page.

### Code Reference Convention

Every `entities/<feature>.md` must include a `## Code References` section that links the wiki spec to the actual implementation. This is mandatory for any entity with `status: approved` or `status: shipped`.

**Format:**

```markdown
## Code References

<!-- Last verified: YYYY-MM-DD -->
| Symbol | Location | Description |
|--------|----------|-------------|
| `functionName()` | `src/module/file.ts:42` | What it does |
| `CONSTANT_NAME` | `src/config.ts:15` | What it configures |
| `ClassName` | `src/module/class.ts:1` | What it represents |
```

**Rules:**
- File paths are relative to the project root.
- Line number = declaration line (not a call site).
- Include: exported functions, classes, interfaces, key constants, configuration knobs.
- Omit: trivial getters/setters, test helpers, internal-only implementation details, generated code.
- Update line numbers and the `<!-- Last verified: -->` comment after every refactor.
- Concept pages use `## Code Locations` (same format, simpler bullet list is fine).

**Enforcement:**
- `code-ref-check.sh` (PostToolUse) — fires on every `Write`/`Edit` of a source file. Warns if no entity references the file, or if the referencing entity lacks a Code References section.
- `wiki-drift-check.sh` (Stop) — at session end, lists all approved/shipped entity pages missing a Code References section.

### The `/project:work` loop
Pick the top TODO from `wiki/todos.md` and run:

1. **Query** — load `wiki/requirements.md` + related entities + `wiki/gotchas.md`. Establish what's expected.
2. **Plan** — draft a short plan, present to user, wait for confirmation.
3. **Branch** — `feat/<slug>` or `fix/<slug>` (never commit to main).
4. **Implement** — write code. Reference the entity page.
5. **Test** — run tests. Fix until green.
6. **Review** — self-review against `wiki/gotchas.md` + project conventions.
7. **Update wiki** — revise the entity page, add ADRs if decisions were made, update `wiki/requirements.md` if behavior changed, append to `wiki/completed.md`.
8. **Log** — append `## [YYYY-MM-DD] work | <task-title>` to `wiki/log.md`.
9. **Commit** — conventional message referencing the TODO slug.

### Agent memory → raw sources
When an agent completes a task and learns something worth keeping (gotcha, pattern, decision), it writes a snapshot to `docs/raw/memory-snapshots/YYYY-MM-DD-<agent>-<slug>.md`. The next `/wiki:ingest` integrates it into the right wiki page.

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
| `/project:interview` | Guided requirements Q&A → writes transcript to `docs/raw/interviews/` then ingests into `wiki/requirements.md` |
| `/project:init` | Detect stack, scaffold wiki, seed `architecture.md` |
| `/project:work` | Pick top TODO → query → plan → implement → test → review → update wiki → log |
| `/project:review` | Code review of uncommitted changes (writes gotchas to `wiki/gotchas.md`) |
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

1. **Wiki is truth.** The wiki describes what the project is and should be. Code that disagrees with the wiki is the bug.
2. **Always update the wiki in the same change.** If you touch code under `src/`, you must touch the relevant wiki page(s) in the same task. The `wiki-drift-check` hook reminds you at session end.
3. **Never modify `docs/raw/` content.** Add to it only. Raw sources are immutable.
4. **Agents own `docs/wiki/`.** Users browse it, agents write it. Exceptions noted in the per-agent instructions.
5. **One source → many page touches.** A single ingest should land on ~5-15 pages; if it only touched one, you probably under-integrated.
6. **File back valuable queries.** If a `/wiki:query` output is non-obvious, save it as a `concepts/` page. Your work compounds.
7. **Always branch before coding.** Never commit to main.
8. **Conventional commits:** `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.
9. **Two-strike rule.** If an approach fails twice, pivot — don't triple down.
10. **Rollback over fix-forward.** If implementation fails review, `/project:rollback` and retry from scratch.

## Agent Routing

| Task | Agent |
|------|-------|
| Code implementation | implementer |
| Code review | reviewer |
| Tests | tester |
| First-time setup | initializer |
| Raw→wiki ingestion, lint, cross-linking | wiki-maintainer |

There is intentionally **no researcher or orchestrator** in this methodology: research happens via `/wiki:query` against an already-rich knowledge base, and orchestration is the explicit 9-step loop in `/project:work`.

## What's Stored Where (quick lookup)

| Concern | Location |
|---------|----------|
| What the project should do | `docs/wiki/requirements.md` |
| How it's built | `docs/wiki/architecture.md` + `docs/wiki/entities/*` (with Code References tables) |
| Why we chose X | `docs/wiki/decisions/*` |
| What can go wrong | `docs/wiki/gotchas.md` |
| What's next | `docs/wiki/todos.md` |
| What's shipped | `docs/wiki/completed.md` |
| Working shell commands | `docs/wiki/commands.md` |
| Project tree | `docs/wiki/file-map.md` |
| Timeline of ops | `docs/wiki/log.md` |
| Session summaries | `docs/changelog.md` (hook-maintained) |
| Raw sources (immutable) | `docs/raw/` |
