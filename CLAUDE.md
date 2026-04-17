# Project Schema — Wiki-Driven Development

This repository follows a **wiki-as-compounding-artifact** methodology adapted for software development.
The wiki is the **source of truth** for what the project is and how it is built. Code must never drift from it.

## The Three Layers

1. **Raw sources** — `docs/raw/` (immutable drop-zone)
   User-provided and agent-emitted documents: interview transcripts, feature specs, memory snapshots, PDFs, articles, API docs. Agents **read from** but never **edit** raw files — they only append new ones.

2. **Wiki** — `docs/wiki/` (LLM-owned)
   Every markdown file here is written and maintained by the LLM. Entities, concepts, decisions, summaries, living specs. Open `docs/` in Obsidian to browse.

3. **Schema** — this file (`CLAUDE.md`)
   A short overview of the system. For the **full mechanics** — directory layout, page templates, frontmatter rules, Code References format, and the ingest/query/lint procedures — load the `wiki-schema` skill.

## How it works (in one paragraph)

Raw sources land in `docs/raw/`. The **wiki-maintainer** agent ingests them into `docs/wiki/` — writing summary pages, creating or updating entity/concept/decision pages, cross-linking, and flagging contradictions. Queries are answered from `docs/wiki/` with citations, and non-obvious answers are filed back as concept pages so knowledge compounds. Code work is driven by `wiki/todos.md` through the nine-step `/project:work` loop; the entity page is the spec and the implementer keeps its `## Code References` table in sync with the actual code.

## What's stored where

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

## Slash Commands

### Project commands (`/project:*`)

| Command | Purpose |
|---------|---------|
| `/project:feature` | Scope a new feature, write spec to `docs/raw/feature-requests/`, ingest, seed a TODO |
| `/project:interview` | Guided requirements Q&A → transcript → `wiki/requirements.md` |
| `/project:init` | Detect stack, scaffold wiki, seed `architecture.md` |
| `/project:work` | Top TODO → query → plan → implement → test → review → update wiki → log |
| `/project:review` | Code review of uncommitted changes |
| `/project:status` | Dump project state |
| `/project:checkpoint` | Git-tag HEAD + session snapshot |
| `/project:rollback` | Revert to a checkpoint |
| `/project:fresh` | Resume from checkpoint in a new session |

### Wiki commands (`/wiki:*`)

| Command | Purpose |
|---------|---------|
| `/wiki:ingest [path]` | Process `docs/raw/` → wiki |
| `/wiki:query <question>` | Answer from the wiki with citations |
| `/wiki:lint` | Health-check the wiki |
| `/wiki:log [n]` | Show last n log entries |

## Agent Routing

| Task | Agent | Model | Needs full wiki schema? |
|------|-------|-------|-------------------------|
| Raw→wiki ingestion, lint, cross-linking | `wiki-maintainer` | opus | **Yes** — loads `wiki-schema` skill |
| Code implementation | `implementer` | opus | No — reads only the relevant entity page + `architecture.md` + `gotchas.md` |
| Code review | `reviewer` | opus | No — reads only `architecture.md`, `gotchas.md`, and the relevant entity page |
| Tests | `tester` | sonnet | No — reads only the entity page's `## Behavior` + `architecture.md` Testing section |
| First-time setup | `initializer` | haiku | Partial — knows where to seed pages |

**Model tier rationale:** opus for open-ended reasoning (synthesizing the knowledge graph, generating code from spec, catching subtle review issues); sonnet for structured derivation (tests from an explicit `## Behavior` contract); haiku for pattern-match setup (stack detection, command discovery, stub creation).

There is intentionally **no researcher or orchestrator**: research happens via `/wiki:query` against an already-rich knowledge base; orchestration is the explicit 9-step loop in `/project:work`.

## Golden Rules

1. **Wiki is truth.** Code that disagrees with the wiki is the bug.
2. **Wiki + code in the same change.** Touching `src/` means touching the relevant entity page. The `wiki-drift-check` hook reminds at session end.
3. **Never modify `docs/raw/` content.** Only add new files.
4. **Agents own `docs/wiki/`.** Users browse it; agents write it. (Exceptions are named in per-agent instructions.)
5. **One source → many page touches.** A single ingest should land on 5–15 pages; fewer means under-integration.
6. **File back valuable queries.** Non-obvious `/wiki:query` outputs become `concepts/` pages. Knowledge compounds.
7. **Always branch before coding.** Never commit to main.
8. **Conventional commits:** `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.
9. **Two-strike rule.** If an approach fails twice, pivot — don't triple down.
10. **Rollback over fix-forward.** If implementation fails review, `/project:rollback` and retry from scratch.

## For full schema details

The `wiki-schema` skill contains the complete specification: directory layout, frontmatter convention, per-folder page templates, Code References rules and enforcement hooks, and the full ingest/query/lint/step-8-wiki-update procedures. The wiki-maintainer agent and every `/wiki:*` and `/project:*` command that touches the wiki must load it. Implementer, tester, and reviewer agents deliberately do **not** load it — they work against specific entity pages and stay lean.
