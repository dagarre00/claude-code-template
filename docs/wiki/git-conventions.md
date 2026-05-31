---
name: git-conventions
description: Branch model, commit format, and the LLM-owned merge/release flow for this project. The single source of truth for git; the feature-branching and branch-merge skills are the procedures that implement it.
type: wiki-spec
updated: 2026-05-31
status: approved
---

# Git Conventions

> The project's git contract. **The agent owns git state end to end** — branching, committing, syncing, merging, releasing, and cleanup are all done by the LLM. The human approves merges and releases; the human does **not** hand-manage branches. Procedures live in the [feature-branching](../../.claude/skills/feature-branching.md), [branch-merge](../../.claude/skills/branch-merge.md), [conflict-resolution](../../.claude/skills/conflict-resolution.md), and [git-recovery](../../.claude/skills/git-recovery.md) skills; this page is the policy they implement. When the flow changes, change it here first, then mirror into the skills.

## Branch model

Two long-lived branches, both protected — **no direct commits to either**:

| Branch    | Role                          | Receives merges from                          | Cut from  |
| --------- | ----------------------------- | --------------------------------------------- | --------- |
| `main`    | Production / released state   | `develop` (releases), `hotfix/*`              | —         |
| `develop` | Integration of finished work  | `feat/*`, `fix/*`, `chore/*`, `docs/*`, …     | `main`    |

All day-to-day work happens on **short-lived branches cut from `develop`** and merged back into `develop`. `main` only ever moves forward by a release (`develop → main`) or a hotfix. `develop` is the base branch for `/project:work`, `/project:review`, and `/project:wiki-lint`.

### Direct-commit exception

The "no direct commits to a protected branch" rule has exactly one carve-out: **append-only `docs/wiki/log.md` bookkeeping records** — the `session-end` hook's auto-log and the `/project:release` log entry — may be committed straight onto the current protected branch. Everything else (source, tests, spec, every other wiki page) routes through a short-lived branch and the merge gate. Nothing else commits directly to `main` or `develop`.

```
main     ●─────────────────────●(v0.2.0)──────────────●(v0.3.0)
          \                    /                      /
develop    ●──●──●──●──●──●──●●──●──●──●──●──●──●──●─●●
            \  /    \  /        \  /          \  /
feat/a       ●●      ?           ?             ?
fix/b               ●●●
chore/c                          ●●
```

## Short-lived branches

`<type>/<short-slug>`, where `<type>` ∈:

- `feat` — new capability
- `fix` — bug fix
- `chore` — tooling, deps, CI, non-functional housekeeping
- `docs` — documentation only
- `refactor` — code restructuring with no behavior change
- `test` — test-only additions
- `perf` — performance work
- `hotfix` — urgent production fix (the **only** type cut from `main`, not `develop` — see [Hotfixes](#hotfixes))

Slug: kebab-case, ≤ 4 words, **equal to the entity slug** when applicable — the branch (`feat/<slug>`), the entity page, the plan scratch (`.claude/handoff/<slug>-plan.md`), and the test names all key off it. Pick it once, keep it stable.

Examples: `feat/auth-login`, `fix/race-on-double-submit`, `chore/upgrade-pytest`, `hotfix/leaked-token`.

## Commit format

Conventional commits, present tense:

```
<type>(<scope>): <one-line summary>

<optional body — what and why, not how>

<optional footer — refs to wiki pages, breaking changes>
```

- `type` matches the branch-type vocabulary (`feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`).
- `scope` is the entity slug or affected area.
- Subject ≤ 72 characters, no trailing period. Body wraps at 72.
- **Merge and release commits are exempt** from the conventional subject format — they keep git's descriptive merge message (see below). Never end commit messages with tool/model identifiers.

## Cadence

- One commit per green TDD cycle (test + impl + entity-page update).
- Refactor commits are separate from feat commits.
- Don't commit half-green code.
- **Always push after committing** (`git push -u origin <branch>`). An unpushed commit is lost when the execution container recycles — see `.claude/rules/behavioral.md` #19. Read-only commands are the only exception.

## The feature cycle — branch → work → merge

A full `/project:work` cycle is **LLM-driven, human-approved at the merge gate**:

1. **Branch from `develop`.** Sync develop, then cut the short-lived branch:

   ```bash
   git fetch origin develop
   git checkout develop && git merge --ff-only origin/develop
   git checkout -b feat/<slug>
   ```

   If `merge --ff-only` fails, develop has diverged non-fast-forward — stop and use `human-checkpoint`. Never force or rebase `develop`.

2. **Work the branch.** TDD loop; commit and push to the feature branch.

3. **Merge into `develop` (human-approved).** When the cycle is green and pushed, the agent **proposes the merge and waits for the human's go-ahead** (the merge gate). On approval it integrates with a **`--no-ff` merge commit**, runs the full suite on `develop`, pushes, and deletes the branch. Full procedure: [branch-merge skill](../../.claude/skills/branch-merge.md).

   ```bash
   git fetch origin develop
   git checkout develop && git merge --ff-only origin/develop   # develop must be current
   git merge --no-ff feat/<slug>                                # keep git's "Merge branch …" message
   # run the full test suite on develop — it must be green before pushing
   git push origin develop
   git branch -d feat/<slug>                                    # safe: errors if unmerged
   git push origin --delete feat/<slug>
   ```

`--no-ff` is deliberate: every feature lands as one merge node on `develop`, preserving the feature boundary and the red→green→refactor trace. Never fast-forward or squash a feature into `develop`.

## Releases — `develop → main`

`main` only advances through a release, driven by **`/project:release`** with explicit human approval. The agent never pushes to `main` outside an approved release (or hotfix).

```bash
git fetch origin main develop
git checkout main && git merge --ff-only origin/main
git merge --no-ff develop -m "release: v<X.Y.Z>"
git tag -a v<X.Y.Z> -m "Release v<X.Y.Z>"
git push origin main --follow-tags
```

- **Versioning:** semantic `vMAJOR.MINOR.PATCH`. The human confirms the version bump; the agent proposes one from the conventional-commit history since the last tag (`feat` → minor, `fix`/`chore` → patch, breaking-change footer → major).
- After a release, `main` and `develop` share history, so no back-merge is needed — **unless** `main` received a hotfix (see below).

## Hotfixes

Urgent fixes to released code skip `develop` on the way in and are back-merged after:

```bash
git fetch origin main
git checkout main && git merge --ff-only origin/main
git checkout -b hotfix/<slug>
# TDD the fix (regression test first), commit, push
```

Then merge to `main` (tag a patch release) **and** back-merge into `develop` so the fix isn't lost on the next release. Both merges are `--no-ff` and human-approved. The dual-merge procedure is in the [branch-merge skill](../../.claude/skills/branch-merge.md#hotfix-dual-merge).

## Force-push policy

- `--force-with-lease` is the only acceptable force-push — used after rebasing a **feature** branch onto `develop`. It fails safely if the remote branch moved since your last fetch.
- Bare `--force` is never used.
- **Never force-push `main` or `develop`.**

## Merge conflicts

Follow the [conflict-resolution skill](../../.claude/skills/conflict-resolution.md) when `git merge` or `git rebase` produces `CONFLICT (content)` markers. Key steps: resolve markers, grep for leftovers, run the full suite, then `git add` + `git commit` (merge) or `git add` + `git rebase --continue` (rebase). If a resolution is ambiguous, abort and use `human-checkpoint` — never commit a guess into `develop` or `main`.

## Branch cleanup

Feature branches are deleted by `branch-merge` immediately after a successful merge (local `git branch -d`, remote `git push origin --delete`). `-d` is safe — it refuses to delete an unmerged branch. The long-lived `main` and `develop` are never deleted.

## Syncing a long-running branch

When a feature branch lags `develop`, rebase early — the longer you wait, the larger the conflict surface:

```bash
git fetch origin develop
git rebase origin/develop
git push --force-with-lease origin <branch>
```

## Tags

- `vMAJOR.MINOR.PATCH` — annotated release tags on `main`, created by `/project:release`.
- `checkpoint-<UTC-timestamp>` — `git tag checkpoint-$(date -u +%Y%m%dT%H%M%SZ)` before a risky operation, so you can `git reset --hard` back. Created with plain git; not pushed.

## Advanced operations

Stash, cherry-pick, bisect, blame, reflog recovery, and other edge cases are covered by the [git-recovery skill](../../.claude/skills/git-recovery.md).

## Pull requests (optional)

This template's default cycle merges to `develop` **locally** via `branch-merge` — a PR is not required. When the team works on a shared remote that requires review, open a PR from the feature branch **to `develop`** (releases PR `develop → main`) instead of the local merge; see the [pr-create skill](../../.claude/skills/pr-create.md). PR creation and merge stay human-approved either way.

## Related

- [[requirements]]
- [[architecture]]
- [[commands]]
