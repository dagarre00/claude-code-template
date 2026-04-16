---
name: wiki-log
description: Chronological append-only log of every ingest, query-filed-back, work task, and lint pass
type: wiki-log
updated: 2026-04-15
---

# Wiki Log

> **Format:** `## [YYYY-MM-DD] <op> | <title>` so entries are parseable.
> Ops: `ingest`, `work`, `lint`, `query-filed`, `decision`.
> Parse last 5: `grep "^## \[" docs/wiki/log.md | tail -5`

---

## [2026-04-15] migration | Adopt wiki-driven methodology

Bootstrap entry. Repository migrated from agent-context + plans model to wiki-as-compounding-artifact model.
- Created `docs/raw/` and `docs/wiki/` layers.
- Retired researcher, orchestrator, docs-maintainer agents.
- Introduced wiki-maintainer + `/wiki:ingest|query|lint|log` commands.
- Added wiki-drift hook to enforce spec-code alignment.
