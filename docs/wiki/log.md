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

> [!abstract] Essence
> The project's timeline: one dated entry per change to tracked files, which the rest of the wiki cites as evidence.

> Append-only, oldest first. Every change to tracked files adds an entry in the same commit, headed `## [YYYY-MM-DD HH:MM] <kind>` (UTC) with kind `init`, `interview`, `work`, `pr`, `adversary`, `review`, `wiki-ingest`, `wiki-maintenance` or `chore` — see [log-and-commit](../../.claude/skills/feature-branching/log-and-commit.md). `/project:wiki` archives this file once it passes 100 entries, keeping the latest 30 (and the latest `review`) here and moving the rest to `summaries/log-archive-<YYYY>.md` by each entry's year.

## [2026-10-17 04:35] chore

Made native dispatch the explicit default in `rules/workflow.md` and `subagent-dispatch`; mode changes only on human request. Role models kept at shipped defaults.
