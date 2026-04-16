---
name: wiki-index
description: Content catalog of the project wiki — links to every page with a one-line summary
type: wiki-index
updated: 2026-04-15
---

# Project Wiki — Index

The living knowledge base. Open `docs/` in Obsidian to browse visually (graph view recommended).

## Living spec

- [[requirements]] — what the project should do (LIVING SPEC, always current)
- [[architecture]] — stack, patterns, conventions
- [[todos]] — priority-ordered work queue
- [[completed]] — shipped work (with wiki-link back-refs to entities)

## Operational

- [[gotchas]] — known failure points, edge cases, recurring mistakes
- [[commands]] — working shell commands (setup, build, test, deploy)
- [[file-map]] — auto-generated project tree
- [[log]] — chronological ops log (ingest / work / lint entries)

## Knowledge graph

- [[entities/]] — one page per feature, module, or component
- [[concepts/]] — patterns, conventions, domain ideas
- [[decisions/]] — ADRs (architectural decision records)
- [[summaries/]] — one page per ingested raw source

## Raw sources

- `../raw/index.md` — catalog of un-ingested and ingested raw sources

## How to keep this page current

Every `/wiki:ingest` run should:
1. Add a row to the relevant section above for each new page
2. Update the `updated:` frontmatter date
3. Not exceed ~200 lines (split into sub-indexes if the wiki outgrows this)
