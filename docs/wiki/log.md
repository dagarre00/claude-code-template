---
name: log
description: Chronological ops log — ingests, work cycles, reviews, lints, checkpoints.
type: wiki-log
updated: 2026-05-11
status: draft
---

# Log

> Append-only chronological record. Each entry begins with `## [YYYY-MM-DD HH:MM] <kind>` so the file can be grep'd.
> Session-end entries are suppressed until `/project:init` writes the first `init` entry below.

## [2026-07-21 12:00] methodology-update

- Adopted the Obsidian LLM-wiki standard for docs/wiki (raw source: docs/raw/llm-wiki-obsidian-standard.md) → [[decisions/2026-07-21-adopt-obsidian-llm-wiki-standard]]
- Ingested: docs/raw/llm-wiki-obsidian-standard.md → [[summaries/llm-wiki-obsidian-standard]]
- Schema updated: CLAUDE.md, behavioral rule 18, wiki-update + decision-recording skills, wiki-maintainer agent, /project:wiki-lint, /project:wiki-ingest, reviewer output frontmatter
- Legacy-page migration queued in [[wiki-todos]] (4 items) for /project:wiki-lint
