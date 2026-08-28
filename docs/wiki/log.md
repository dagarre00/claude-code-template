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

## [2026-08-27 21:19] wiki-maintenance — findings-mailbox lifecycle

- Drained `wiki-todos.md`: the one open item was the `.gitignore` / rule 20
  contradiction over the findings mailbox. Resolved in favour of rule 20.
- The `.gitignore` comment was the stale side: it claimed the mailbox is
  promoted to `docs/wiki/reviews/<date>-<slug>.md` and must never be deleted
  unpromoted, citing `adversarial-review` step 8. But step 8 is the stop
  condition and says nothing about promotion; step 9 says delete. The
  `docs/wiki/reviews/` directory does not exist and is referenced nowhere
  else. Rule 20, `adversarial-review` step 9, and `/project:work` step 9 all
  agree the record is the commit body.
- Rewrote the comment to match, folded the `*-handoff.md` glob into the same
  block, and corrected the suffix caveat to cover all three globs.
- Verified the globs functionally with `git check-ignore`, including the
  documented case that a suffixed variant (`*-plan-v2.md`) is NOT ignored.
- Scanned the repo for sibling defects — dangling path references and broken
  wikilinks. No genuine ones: the remaining hits are templated paths, the
  conditional `design-system.md`, and fenced/backticked examples.
