---
aliases: [Ops log, Timeline]
type: reference
domains: [software]
status: stable
sources: []
contradicts: []
open_questions: []
created: 2026-04-15
updated: 2026-09-23
---

# Log

> Append-only, oldest first. Every change to tracked files adds an entry in the same commit, headed `## [YYYY-MM-DD HH:MM] <kind>` (UTC) with kind `init`, `interview`, `work`, `pr`, `adversary`, `review`, `wiki-ingest`, `wiki-maintenance` or `chore` — see [log-and-commit](../../.agents/skills/feature-branching/log-and-commit.md). `/project:wiki` archives this file once it passes ~100 entries.
