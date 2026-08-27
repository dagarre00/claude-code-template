---
aliases: [Ops log, Timeline]
type: reference
domains: [software]
status: stable
sources: []
contradicts: []
open_questions: []
created: 2026-04-15
updated: 2026-08-05
---

# Log

> Append-only chronological record. Each entry begins with `## [YYYY-MM-DD HH:MM] <kind>` so the file can be grep'd — `init`, `interview`, `work`, `pr`, `review`, `agent-scout`, `wiki-maintenance`.
> Entries are written by the command that did the work, in the same commit as the work. `/project:wiki-lint` archives this file once it passes ~100 entries.

## [2026-08-27 00:00] chore

- Added a reconciliation check (`wiki-maintainer` reconciliation pass, `/project:wiki-lint` step 4) for dangling `<file>.md § <Section>` citations: schema files (`.claude/rules/behavioral.md`, skills, commands) can add a citation to a wiki section in the same commit as a new rule, but downstream projects that pull in the schema update without also getting that wiki-side content end up with a citation pointing nowhere. Reported externally: rule 22's `docs/wiki/todos.md § Filed-findings backlog` reference, plus the pre-existing `P0_MAX` reference, had no matching section in that project's `todos.md`. This template's own `todos.md` already carries both sections (added alongside the rule text in a prior commit), so nothing needed backfilling here — the fix is the new check itself, which stubs a missing section rather than inventing content.
