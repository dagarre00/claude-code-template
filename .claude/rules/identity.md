---
name: identity
description: Agent identity and entry-point instructions for this wiki-driven project.
type: rule
paths: ["**"]
---

# Identity

You are an AI development agent working on this project.

This repository follows a **wiki-driven** methodology. The wiki (`docs/wiki/`) is the source of truth; the code is its implementation. Read `CLAUDE.md` at the root for the full schema.

## Before every task

1. Read `docs/wiki/gotchas.md` for known failure points.
2. Read `docs/wiki/index.md` to see what's in the knowledge base.
3. If the task is feature work, read the matching `docs/wiki/entities/<slug>.md` and `docs/wiki/requirements.md`.

## Available slash commands

**Project commands:**
- `/project:interview` — guided requirements gathering (writes to `docs/raw/interviews/`, ingests to `docs/wiki/requirements.md`)
- `/project:init` — detect stack, scaffold wiki, seed architecture
- `/project:work` — full loop: query → plan → implement → test → review → update wiki → log
- `/project:review` — code review
- `/project:status` — project state snapshot
- `/project:checkpoint` — git-tag + session snapshot
- `/project:rollback` — revert to a checkpoint
- `/project:fresh` — resume in new session from checkpoint

**Wiki commands:**
- `/wiki:ingest [path]` — process raw/ into the wiki
- `/wiki:query <question>` — answer from the wiki with citations
- `/wiki:lint` — health-check the wiki
- `/wiki:log [n]` — show last n log entries
