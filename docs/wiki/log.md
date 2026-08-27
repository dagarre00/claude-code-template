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

## [2026-08-27 21:13] chore — llm-handoff

- Added the `llm-handoff` skill (`.claude/skills/llm-handoff/`) and the
  `/project:handoff` command: package a todo as one self-contained brief an
  external, non-Claude agent can run from as its sole prompt.
- `TEMPLATE.md` carries the brief itself — mission, hard rules, inlined wiki
  context, spec, per-case test-first procedure, review-by-sub-agent protocol,
  git conventions, wiki edits, stop-and-ask triggers, completion report, and a
  definition-of-done checklist. The external agent deletes it and reports back.
- `.gitignore`: `.claude/handoff/*-handoff.md` joins the scratch globs.
- `CLAUDE.md`: slash-command table row and skill-catalog entry.
