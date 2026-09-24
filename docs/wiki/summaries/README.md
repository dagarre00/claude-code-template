---
aliases: [Summaries guide]
type: reference
domains: [knowledge]
status: stable
sources: []
contradicts: []
open_questions: []
created: 2026-04-15
updated: 2026-09-23
---

# Summaries

> [!abstract] Essence
> One digest per ingested `docs/raw/` source. The rest of the wiki links the summary; the immutable raw file stays the source of truth, cited where accuracy matters.

`/project:wiki <source>` writes them one at a time, and its argument-free health pass catches raw files that never got one. Both run the placement check first, so a concept that already has a page is updated rather than duplicated. Template: `.agents/skills/wiki-update/summary-template.md`.
