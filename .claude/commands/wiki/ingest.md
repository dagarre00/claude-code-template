---
name: wiki-ingest
description: Process pending raw sources in docs/raw/ into the wiki. Creates/updates summary, entity, concept, and decision pages; cross-links; logs.
type: command
---

Use the **wiki-maintainer** agent.

## Inputs

- Optional argument: path to a specific raw source (relative or absolute). If omitted, process all rows in `docs/raw/index.md` with `status: pending`.

## What the agent does (per source)

1. Read the raw source fully. Do not modify it.
2. Write a summary page at `docs/wiki/summaries/<slug>.md` using the summaries/ template.
3. Update affected entity pages in `docs/wiki/entities/` — create new pages if a new feature/module/concept appears, update existing pages otherwise.
4. Update `docs/wiki/concepts/` if the source introduces or revises a pattern/convention.
5. If the source contains a non-trivial design decision, add an ADR to `docs/wiki/decisions/`.
6. Cross-link: add `[[wiki-link]]` references in every page that relates to the new content.
7. Flag contradictions inline: `> ⚠ contradicts [[page#section]]: <describe>`.
8. Update `docs/wiki/index.md` to list newly-created pages.
9. Append to `docs/wiki/log.md`: `## [YYYY-MM-DD] ingest | <source-title>`.
10. Update the row in `docs/raw/index.md`: set `status` to `ingested` and link the summary page.

## Rules

- A single source should touch 5–15 wiki pages. If it only touched 1, you probably under-integrated — revisit.
- Never delete content from an existing wiki page in this pass — edit, supersede with a note, or mark `status: stale` in frontmatter.
- Report back a list of every page touched so the user can browse the diff in Obsidian.
