---
name: todos
description: Priority-ordered work queue. /project:work always pulls the top pending TODO.
type: wiki-spec
status: draft
updated: 2026-04-15
---

# TODOs

> **Source of truth** for what's next. `/project:work` picks the top pending row.
> Generated from [[requirements]] during `/project:interview` finalization, or added manually as work is discovered.

## Pending

| ID | Priority | Feature area | Description | Entity page |
|----|----------|--------------|-------------|-------------|
| *(none — run `/project:interview` and then `/project:work` to generate TODOs from requirements)* | | | | |

## In Progress

| ID | Branch | Started | Owner |
|----|--------|---------|-------|
| *(none)* | | | |

## Blocked

| ID | Blocked by | Reason |
|----|------------|--------|
| *(none)* | | |

## Priority scale

- `P0` — ship-blocker, must do now
- `P1` — core feature, scheduled
- `P2` — nice-to-have, can slip
- `P3` — someday, park it
