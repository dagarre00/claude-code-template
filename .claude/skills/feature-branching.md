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

The `test-first-check` hook activates on `feat/*` and `fix/*` — it _reminds_ (never blocks) when you edit production code with no test in the session's changes yet. **The `<slug>` must equal the entity-page slug** — the branch name (`feat/<slug>`), the entity page, the plan scratch (`.claude/handoff/<slug>-plan.md`), and the test names all key off it. Pick it once and keep it stable.

## Batching todos

Two todos share a branch when **all** are true: same entity page, second depends on first, splitting produces a meaningless intermediate commit. Otherwise — separate branches. Batches of 2+ also trigger the `planner` — it writes a plan (via `plan-writing`) that the `developer` follows (see `/project:work` step 4).

## Commit cadence

- One commit per green TDD cycle (test + impl + entity-page update bundled).
- Refactor commits are separate from feat commits.
- Don't commit half-green code. Mid-cycle stop → tag a checkpoint (`git tag checkpoint-$(date -u +%Y%m%dT%H%M%SZ)`) and leave the tree.

## Finishing the feature

1. Final test run — full suite, not just the touched tests.
2. Entity page reflects current state; Behavior cases ticked.
3. TODO checked off / removed from `docs/wiki/todos.md` (shipped work lives in git history).
4. Push: `git push -u origin <branch>`.
5. PR (only on explicit human go-ahead): follow `pr-create` skill.
6. After merge: delete branch locally and on remote.

## Anti-patterns

- **Committing to `main`.** Branch first.
- **`--no-verify`.** If a hook blocks, fix the underlying issue.
- **`git commit -a`.** Stage explicitly.
- **Squashing locally to hide Red→Green cycles.** History is the trace of the TDD loop.
