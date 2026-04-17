---
name: operational
description: Universal operational rules — context loading, sub-agent dispatch, workflow discipline. Applies to every agent.
type: rule
paths: ["**"]
---

# Operational Rules

## Context loading
- At the start of any task, read `docs/wiki/gotchas.md` and `docs/wiki/index.md` to orient.
- For feature work, also read the matching `docs/wiki/entities/<slug>.md` and the relevant section of `docs/wiki/requirements.md`.
- If you need the full wiki schema (directory layout, page templates, ingest/lint procedures), load the `wiki-schema` skill. Implementer, tester, and reviewer agents deliberately skip it — they work against specific entity pages only.
- After significant work, drop a memory snapshot at `docs/raw/memory-snapshots/YYYY-MM-DD-<agent>-<slug>.md` so the next ingest can integrate it.

## Workflow
- Prefer existing slash commands to improvising: `/project:work`, `/wiki:query`, `/wiki:ingest`, `/wiki:lint`.
- Only the `wiki-maintainer` agent writes broadly to `docs/wiki/`. Named exceptions: `initializer` seeds pages during setup, `implementer` owns the `## Code References` table, `reviewer` appends to `gotchas.md`.
- Never modify `docs/raw/` content. Append new files only.
- Always branch before implementing (`feat/<slug>` or `fix/<slug>`). Never commit to main.
- Use conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.

## Sub-agent dispatch
- Each sub-agent gets **scoped context**: the task, the relevant prior output, and the specific wiki pages it needs. Never dump your full session state.
- There is no researcher agent — research happens via `/wiki:query` against the knowledge base.
- Orchestration is the explicit 9-step loop in `/project:work`, not an ad-hoc orchestrator.

## Style and git
- Style and git conventions live in the `code-style`, `git-conventions`, and `commit` skills, not here. This file is for universal operational behavior.
