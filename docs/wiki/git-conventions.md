---
name: git-conventions
description: Branching and commit conventions for this project. Mirrors the feature-branching skill.
type: wiki-spec
updated: 2026-06-10
status: draft
---

# Git Conventions

> Project conventions. Updated when the team adopts a new flow; mirror changes into the [feature-branching skill](../../.claude/skills/feature-branching/SKILL.md).

## Default branch

`develop` — integration branch. No direct **code** commits — feature and fix work always goes through `<type>/<slug>` branches and PRs. Docs-only commits made by the orchestrating commands (`/project:interview` transcripts + wiki updates, `/project:review` reports, `/project:wiki-ingest` summaries, the `session-end.sh` log entry) may land directly on `develop`; if the remote branch-protects `develop`, run those commands from a `docs/*` or `chore/*` branch instead. `/project:work` always starts and ends on `develop`. `main` is the release branch, updated separately when `develop` is promoted.

## Branch naming

`<type>/<short-slug>`, where `<type>` ∈:

- `feat` — new capability
- `fix` — bug fix
- `chore` — tooling, deps, CI, non-functional housekeeping
- `docs` — documentation only
- `refactor` — code restructuring with no behavior change
- `test` — test-only additions
- `perf` — performance work

Slug: kebab-case, ≤ 4 words, matches the entity slug when applicable.

Examples: `feat/auth-login`, `fix/race-on-double-submit`, `chore/upgrade-pytest`.

## Commit format

Conventional commits, present tense:

```
<type>(<scope>): <one-line summary>

<optional body — what and why, not how>

<optional footer — refs to wiki pages, breaking changes>
```

- `type` matches the branch type vocabulary.
- `scope` is the entity slug or affected area.
- Subject ≤ 72 characters, no trailing period.
- Body wraps at 72.

## Cadence

- One commit per green TDD cycle (test + impl + entity-page update).
- Refactor commits are separate from feat commits.
- Don't commit half-green code.
- **Always push after committing** (`git push -u origin <branch>`). An unpushed commit is lost when the execution container recycles — see `.claude/rules/behavioral.md` #19. Read-only commands (those that don't mutate tracked files) are the only exception.

## PRs

- Open from `<type>/<slug>` to `develop`.
- Opened automatically by `/project:work` (via the `pr-create` skill) once all Behavior cases for the cycle are `[x]`.
- Title mirrors the lead commit.
- Description references the entity page and the Behavior cases covered.
- Squash on merge unless preserving the TDD trace adds value.
- Merging is always the human's call.

## Force-push policy

- `--force-with-lease` is the only acceptable force-push (used after a rebase onto develop). It fails safely if the remote branch has been updated since your last fetch.
- Bare `--force` is never used.
- Never force-push `develop` or `main`.

## Merge conflicts

Follow the [conflict-resolution skill](../../.claude/skills/conflict-resolution/SKILL.md) when `git merge` or `git rebase` produces `CONFLICT (content)` markers. Key steps: resolve markers, grep for leftovers, run full tests, then `git add + git commit` (merge) or `git add + git rebase --continue` (rebase).

## Branch cleanup (after merge)

```bash
git checkout develop
git pull --ff-only
git branch -d feat/<slug>              # -d is safe: errors if unmerged
git push origin --delete feat/<slug>
```

## Advanced git operations

Stash, cherry-pick, bisect, blame, reflog recovery, and other edge-case operations are covered by the [git-recovery skill](../../.claude/skills/git-recovery/SKILL.md).

## Tags

- `checkpoint-<UTC-timestamp>` — tag HEAD with plain git (`git tag checkpoint-$(date -u +%Y%m%dT%H%M%SZ)`) before risky operations, so you can `git reset --hard` back if needed.
- Other tags reserved for releases (format defined later).
