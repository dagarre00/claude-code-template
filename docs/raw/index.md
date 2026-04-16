---
name: raw-sources-index
description: Catalog of every raw source dropped into docs/raw, plus ingestion status
type: wiki-index
updated: 2026-04-15
---

# Raw Sources Index

> Every file in `docs/raw/` should be listed here so agents know what's pending.
> **Never edit raw source content.** Only add, catalog, and mark as ingested.

## How to add a source

1. Drop the file into `docs/raw/` (or an appropriate subfolder).
2. Add a row below under the matching section.
3. Run `/wiki:ingest` (or `/wiki:ingest <path>` to target a single file).

## Status legend

- `pending` — in `docs/raw/`, not yet read by wiki-maintainer
- `ingested` — fully processed, wiki pages created/updated, summary page exists
- `partial` — ingested but flagged for re-visit (contradictions, missing context)
- `skipped` — reviewed, decided not to ingest (e.g., duplicate, off-topic)

## Sources

### Interviews (`docs/raw/interviews/`)

| File | Date added | Status | Summary page |
|------|------------|--------|--------------|
| *(none yet — run `/project:interview` to create one)* | | | |

### Memory snapshots (`docs/raw/memory-snapshots/`)

| File | Agent | Date added | Status | Summary page |
|------|-------|------------|--------|--------------|
| *(none yet — agents drop learnings here at task completion)* | | | | |

### User-dropped (`docs/raw/`)

| File | Kind | Date added | Status | Summary page |
|------|------|------------|--------|--------------|
| *(none yet)* | | | | |
