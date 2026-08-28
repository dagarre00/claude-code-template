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

## [2026-08-28 04:18] chore — llm-handoff worktrees, no force-push

- The external agent now works in its own git worktree (§5 Step 2) instead of
  the main checkout, so a session already using that checkout is never
  disturbed. Teardown in Step 8; `git worktree remove` is never forced.
- Removed the only force flag the brief carried: Step 7 synced with
  `git rebase` + `git push --force-with-lease`, and now merges the base branch
  in and pushes normally. Rule 14 and the § 6 policy became a flat prohibition.
- Handoff brief stays gitignored (`.claude/handoff/*-handoff.md`). Git does not
  carry ignored files into a new worktree, so Step 2 copies the brief in and
  installs dependencies there, then verifies with `git check-ignore` — a
  smoke test caught that the ignore rule only applies if the branch cut from
  carries it, so the brief is moved out rather than committed if it does not.
