---
aliases: [Ops log, Timeline]
type: reference
domains: [software]
status: stable
sources: []
contradicts: []
open_questions: []
created: 2026-04-15
updated: 2026-08-30
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

## [2026-08-28 04:32] pr — llm-handoff worktrees

- Branch: claude/llm-handoff-file-instructions-jccasa
- PR: https://github.com/dagarre00/claude-code-template/pull/36
- PR #34 merged the branch's first two commits to `main` (reconciled into
  `develop` as 03ded64). The worktree / no-force-push commit landed after that
  merge, so it needed a new PR — a merged PR cannot track follow-up work.
- Brought the branch current by merging `develop` in (not rebasing), so no
  history was rewritten and no force-push was needed.

## [2026-08-29 11:34] chore — llm-handoff TEMPLATE.md defects

Three defects surfaced while filling in `.claude/skills/llm-handoff/TEMPLATE.md`
for a real handoff; fixed in the template and its `SKILL.md` companion.

- §6 Step 6.4, §7.3, and §12 said "remove the closed todo line(s)"
  unconditionally — destructive for a multi-part todo, since closing one part
  would delete the whole item including still-open siblings. Reworded to
  remove only the specific line(s) actually closed this cycle and leave open
  parts of a multi-part item in place.
- §7.3's filed-finding line used a `[review]` tag, but this repo's
  findings-backlog saturation counter (rule 22 / `FINDINGS_MAX`) greps for the
  literal string `[adversary]`. Changed the template's example line and
  `SKILL.md`'s audit checklist to `[adversary]`, and noted why the exact tag
  matters.
- The template had one `{{BASE_BRANCH}}` placeholder serving two different
  roles: where to cut the worktree branch from, and where the PR lands. Fine
  for a plain cycle where they coincide, but unrepresentable for a stacked
  cycle (branching from a prior, not-yet-merged cycle's branch). Split it into
  `{{CUT_FROM_BRANCH}}` (worktree source, Step 7 sync target) and
  `{{BASE_BRANCH}}` (PR target only), threaded through §1, rule 14, Steps 1/2/7,
  and §12; updated `SKILL.md`'s placeholder table and hand-over note to match.

## [2026-08-30 20:58] fix — template logic gaps and command sync

- Fixed branch resumption and creation in `/project:work`: if on `feat/<slug>` with open Behavior cases, continue rather than resetting to `develop`; in step 2, check if `feat/<slug>` exists before checkout instead of failing with `checkout -b`.
- Fixed `/project:review` worktree cleanup: use `git worktree remove --force "$WORKTREE"` after copying the report back to avoid failure on untracked report files.
- Fixed `/project:init` step 8a: check for remote before pushing `develop` to prevent errors on unlinked repos.
- Synchronized `/project:handoff` across all tables: added to `CLAUDE.md.tmpl`, `HUMAN.md`, `README.md`, `feature-branching` skill, and `docs/getting-started.md`.
- Fixed maintenance cadence and schema reference greps: added robust regex matching for multi-word/suffixed log entries and heading citations with slashes.
- Fixed stale commit description in `docs/getting-started.md` to reflect the per-case developer commit cadence.

## [2026-08-30 21:08] refactor — remove review worktrees & adopt lean living-wiki on develop

- Removed worktree isolation from `/project:review` and `reviewer.md`: reviewer now runs directly in a fresh subagent context, avoiding dependency re-install overhead and worktree teardown friction.
- Adopted Option A integration model (Rule 19, `git-conventions.md`, `feature-branching`): code modifications strictly branch and open PRs (`feat/*`, `fix/*`), while routine living-wiki/docs maintenance (`/project:wiki-lint`, `/project:review`, `/project:wiki-ingest`, `/project:interview`, `/project:agent-scout`, `/project:handoff`) commits directly to `develop` (or stays on the active feature branch).
- Synchronized command steps across `review.md`, `interview.md`, `wiki-lint.md`, `wiki-ingest.md`, `agent-scout.md`, and `handoff.md` to remove throwaway chore branches and PRs for wiki-only edits.
- Updated `CLAUDE.md`, `CLAUDE.md.tmpl`, `HUMAN.md`, `README.md`, and `docs/getting-started.md` to match the streamlined workflow.

## [2026-08-30 21:25] fix — adversary review round 1 fixes

- Fixed `reviewer.md`: removed redundant `wiki-todos.md` queue append instruction to eliminate double-processing with `review.md` caller extraction.
- Fixed remote branch resumption in `work.md` and `feature-branching`: use `git checkout "<type>/<slug>" 2>/dev/null || git checkout -b "<type>/<slug>"` to properly auto-track existing remote branches in ephemeral containers.
- Added self-defensive `if [ "$(git branch --show-current)" = "develop" ]` guards to `develop` fast-forward blocks in all maintenance commands (`review`, `interview`, `wiki-lint`, `wiki-ingest`, `agent-scout`).
- Added `/project:handoff` to `docs/wiki/git-conventions.md` integration model list.

## [2026-08-30 22:07] adversary — workflow

- Commit reviewed: 7111c4d (range `develop...HEAD`)
- Findings: 8 (0 critical, 0 major, 8 minor) + 2 nits
- Disposition: 0 filed, 8 fixed, 0 rejected — all fixes explicitly approved by the human ("fix all the findings, this is a template and should not have any pending todo"), so no todo lines were added
- Per-finding fixes and reasons: `git log --grep="adversary round"`

## [2026-08-30 22:23] adversary — workflow round 2

- Commit range reviewed: `7111c4d..HEAD`
- Findings: 4 (1 major, 3 minor) + 2 nits
- Disposition: 0 filed, 4 fixed, 0 rejected — all fixes explicitly approved by the human ("fix everything"), so no todo lines were added
- Per-finding fixes and reasons: `git log --grep="adversary round"`
