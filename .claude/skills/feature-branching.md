---
name: feature-branching
description: Branching procedure for this project — when to branch (off develop), batching rules, finishing-up checklist. Commit-message format lives in CLAUDE.md and docs/wiki/git-conventions.md; the merge itself lives in the branch-merge skill. Trigger on "start branch", "feat/", "fix/", "batch todos", "finish feature".
type: skill
---

# Branching

Always branch before code. **Never commit directly to `main` or `develop`** — both are protected. Short-lived branches are cut from `develop` and merged back into `develop`; `main` advances only by release. The full branch model, commit-message format, and PR template live in [`docs/wiki/git-conventions.md`](../../docs/wiki/git-conventions.md) — this skill won't repeat them. The merge back into `develop` is its own procedure: the [branch-merge skill](./branch-merge.md).

## Starting work

1. Confirm clean tree:

   ```bash
   git status --porcelain
   ```

   If dirty: stop and run `human-checkpoint`. See **Mid-task pause** below if you need to temporarily set aside in-progress work.

2. Fetch and sync **develop** (the base branch). Using `fetch` + `merge --ff-only` (rather than bare `pull`) makes the two steps explicit and fails safely if develop has diverged in a non-fast-forward way:

   ```bash
   git fetch origin develop
   git checkout develop && git merge --ff-only origin/develop
   ```

   If `merge --ff-only` fails, develop has diverged — use `human-checkpoint`. Do not force or rebase develop. (`hotfix/*` is the one exception — it cuts from `main`; see `git-conventions.md` → Hotfixes.)

3. Branch as `<type>/<short-slug>` where `<type>` ∈ `feat`, `fix`, `chore`, `docs`, `refactor`, `test`. Examples: `feat/auth-login`, `fix/race-on-double-submit`, `chore/upgrade-pytest`, `feat/profile` (batched).

   ```bash
   git checkout -b feat/<slug>
   ```

The `test-first-check` hook activates on `feat/*` and `fix/*` — it _reminds_ (never blocks) when you edit production code with no test in the session's changes yet. **The `<slug>` must equal the entity-page slug** — the branch name (`feat/<slug>`), the entity page, the plan scratch (`.claude/handoff/<slug>-plan.md`), and the test names all key off it. Pick it once and keep it stable.

## Batching todos

Two todos share a branch when **all** are true: same entity page, second depends on first, splitting produces a meaningless intermediate commit. Otherwise — separate branches. Batches of 2+ also trigger the `planner` — it writes a plan (via `plan-writing`) that the `developer` follows (see `/project:work` step 4).

## Mid-task pause

When interrupted mid-cycle (not at a green commit boundary), pick the lightest-weight option:

1. **Preferred — checkpoint tag.** Commit the in-progress state with a `wip:` prefix, tag it, then reset when resuming:

   ```bash
   git add -p                               # stage only the coherent parts
   git commit -m "wip: <what's in flight>"
   git tag checkpoint-$(date -u +%Y%m%dT%H%M%SZ)
   ```

   On resume, `git reset HEAD~1` (soft) to un-commit the wip, then continue.

2. **Fallback — stash.** Only when the interrupted change is genuinely tiny and you'll resume within the same session:

   ```bash
   git stash push -m "wip: <what you were doing>"
   # ... handle interruption ...
   git stash pop
   ```

   See the `git-recovery` skill for stash details. Never leave a stash across sessions.

## Sync with develop (long-running branches)

When your branch has been open for several days and develop has moved on, rebase early — the longer you wait, the larger the conflict surface:

```bash
git fetch origin develop
git rebase origin/develop
git push --force-with-lease origin <branch>   # safe: fails if remote has new commits you don't have
```

If conflicts arise, follow the `conflict-resolution` skill. `--force-with-lease` is the only acceptable force-push form; never bare `--force`.

## Commit cadence

- One commit per green TDD cycle (test + impl + entity-page update bundled).
- Refactor commits are separate from feat commits.
- Don't commit half-green code. Mid-cycle stop → tag a checkpoint (`git tag checkpoint-$(date -u +%Y%m%dT%H%M%SZ)`) and leave the tree.

## Finishing the feature

1. Final test run — full suite, not just the touched tests.
2. Entity page reflects current state; Behavior cases ticked.
3. TODO checked off / removed from `docs/wiki/todos.md` (shipped work lives in git history).
4. Sync with develop one last time before merging (catches late changes to develop):

   ```bash
   git fetch origin develop
   git rebase origin/develop   # follow conflict-resolution skill if needed
   ```

5. Push: `git push -u origin <branch>` (or `git push --force-with-lease` after a rebase).
6. **Merge into `develop`** (the merge gate — human-approved, `--no-ff`, then branch cleanup): hand off to the [branch-merge skill](./branch-merge.md). In the normal flow `/project:work` drives this step; if you are finishing outside `/project:work`, follow `branch-merge` yourself. A PR to `develop` is the alternative only when the human asks for one (`pr-create` skill) — both stay human-approved.

## Anti-patterns

- **Committing to `main` or `develop`.** Branch first; both are protected.
- **Merging your own branch without the human's go-ahead.** The merge into `develop` is gated — propose, wait, then merge.
- **`--no-verify`.** If a hook blocks, fix the underlying issue.
- **`git commit -a`.** Stage explicitly.
- **Squashing or fast-forwarding into `develop`.** Feature merges are `--no-ff`; history is the trace of the TDD loop.
