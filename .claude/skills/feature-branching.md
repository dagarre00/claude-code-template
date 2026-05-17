---
name: feature-branching
description: Branching procedure for this project — when to branch, batching rules, finishing-up checklist. Commit-message format itself lives in CLAUDE.md golden rule 8 and docs/wiki/git-conventions.md. Trigger on "start branch", "feat/", "fix/", "batch todos", "finish feature".
type: skill
---

# Branching

Always branch before code. Never commit to `main`. Commit-message format and PR template live in [`docs/wiki/git-conventions.md`](../../docs/wiki/git-conventions.md) and are summarized by `CLAUDE.md` golden rule 8 — this skill won't repeat them.

## Starting work

1. Confirm clean tree:

   ```bash
   git status --porcelain
   ```

   If dirty: stop and run `human-checkpoint`. Don't be clever with stashing.

2. Sync main:

   ```bash
   git checkout main && git pull --ff-only
   ```

3. Branch as `<type>/<short-slug>` where `<type>` ∈ `feat`, `fix`, `chore`, `docs`, `refactor`, `test`. Examples: `feat/auth-login`, `fix/race-on-double-submit`, `chore/upgrade-pytest`, `feat/profile` (batched).

   ```bash
   git checkout -b feat/<slug>
   ```

The `test-first-check` hook activates on `feat/*` and `fix/*` — you'll need the `red_confirmed` handoff (see [[concepts/handoff-format]]) before any code edit.

## Batching todos

Two todos share a branch when **all** are true: same entity page, second depends on first, splitting produces a meaningless intermediate commit. Otherwise — separate branches. Batches of 2+ also trigger the planner (see `/work` step 4).

## Commit cadence

- One commit per green TDD cycle (test + impl + entity-page update bundled).
- Refactor commits are separate from feat commits.
- Don't commit half-green code. Mid-cycle stop → `/checkpoint` and leave the tree.

## Finishing the feature

1. Final test run — full suite, not just the touched tests.
2. Entity page reflects current state; Behavior cases ticked.
3. TODO moved from `docs/wiki/todos.md` to `docs/wiki/completed.md`.
4. Push: `git push -u origin <branch>`.
5. PR (only on explicit human go-ahead): follow `pr-create` skill.
6. After merge: delete branch locally and on remote.

## Anti-patterns

- **Committing to `main`.** Branch first.
- **`--no-verify`.** If a hook blocks, fix the underlying issue.
- **`git commit -a`.** Stage explicitly.
- **Squashing locally to hide Red→Green cycles.** History is the trace of the TDD loop.
