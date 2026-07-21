---
aliases: [Ops log, Timeline]
type: reference
domains: [software]
status: stable
sources: []
contradicts: []
open_questions: []
created: 2026-04-15
updated: 2026-07-21
---

# Log

> Append-only chronological record. Each entry begins with `## [YYYY-MM-DD HH:MM] <kind>` so the file can be grep'd.
> Session-end entries are suppressed until `/project:init` writes the first `init` entry below.

## [2026-07-21 12:00] methodology-update

- Adopted the Obsidian LLM-wiki standard for docs/wiki (raw source: docs/raw/llm-wiki-obsidian-standard.md) → [[decisions/2026-07-21-adopt-obsidian-llm-wiki-standard]]
- Ingested: docs/raw/llm-wiki-obsidian-standard.md → [[summaries/llm-wiki-obsidian-standard]]
- Schema updated: CLAUDE.md, behavioral rule 18, wiki-update + decision-recording skills, wiki-maintainer agent, /project:wiki-lint, /project:wiki-ingest, reviewer output frontmatter
- Legacy-page migration queued in [[wiki-todos]] (4 items) for /project:wiki-lint

## [2026-07-21 13:00] wiki-maintenance

- Migrated 13 legacy pages to the Obsidian standard: 8 base/ledger pages, 4 folder READMEs, 1 ADR (2026-06-11) — frontmatter mapped (name/description dropped, facets added), intro blockquotes converted to Essence callouts, bodies preserved
- Removed hook pages ([[entities/hooks]] entity, 2026-05-31 routing ADR, hook gotchas) per human instruction to strip hooks from the project
- Lint: 0 orphan issues, 0 broken links, 0 invariant violations (closed vocab verified: 2 decision / 12 reference / 1 summary)
- Wiki-todos processed: 5 (4 migration items + entities/hooks item resolved by deletion)
- Questions for human: 0
