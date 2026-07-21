---
aliases: [Summaries guide]
type: reference
domains: [knowledge]
status: stable
sources: []
contradicts: []
open_questions: []
created: 2026-04-15
updated: 2026-07-21
---

# Summaries

> [!abstract] Essence
> One summary page per ingested raw source in `docs/raw/`. The summary is what the rest of the wiki cross-references — entities, concepts, and decisions link to the summary, not to the raw file.

## Filing

`/project:wiki-ingest` produces these for individual sources; the `wiki-maintainer` catches stragglers during `/project:wiki-lint`. Both run the placement check first — if the source's concept already has a page, they update it instead of duplicating.

## Page shape

Use the summary template in `/project:wiki-ingest` (`.claude/commands/project/wiki-ingest.md`): Obsidian-standard frontmatter (`type: summary`, `sources:` pointing at the raw path, `contradicts`, `open_questions`), then `> [!abstract] Essence`, `## Summary`, `## Key claims` (each claim ← its raw source), `## Boundaries`, `## Updates to the wiki`.

## Why these aren't the source

The raw file in `docs/raw/` is **immutable** — that's the source of truth. The summary is the *digestible* version for ongoing reference. Cross-link the summary, cite the raw file when accuracy matters.
