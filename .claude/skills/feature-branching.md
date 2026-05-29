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

   If dirty: stop and run `human-checkpoint`. See **Mid-task pause** below if you need to temporarily set aside in-progress work.

2. Fetch and sync main. Using `fetch` + `merge --ff-only` (rather than bare `pull`) makes the two steps explicit and fails safely if main has diverged in a non-fast-forward way:

   ```bash
   git fetch origin main
   git checkout main && git merge --ff-only origin/main
   ```

   If `merge --ff-only` fails, main has diverged — use `human-checkpoint`. Do not force or rebase main.

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

## Sync with main (long-running branches)

When your branch has been open for several days and main has moved on, rebase early — the longer you wait, the larger the conflict surface:

```bash
git fetch origin main
git rebase origin/main
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
4. Sync with main one last time before pushing (catches late changes to main):

   ```bash
   git fetch origin main
   git rebase origin/main   # follow conflict-resolution skill if needed
   ```

5. Push: `git push -u origin <branch>` (or `git push --force-with-lease` after a rebase).
6. PR (only on explicit human go-ahead): follow `pr-create` skill.
7. After merge — clean up both local and remote branch:

   ```bash
   git checkout main
   git pull --ff-only
   git branch -d feat/<slug>              # safe delete (errors if unmerged)
   git push origin --delete feat/<slug>   # delete remote tracking branch
   ```

## Anti-patterns

- **Committing to `main`.** Branch first.
- **`--no-verify`.** If a hook blocks, fix the underlying issue.
- **`git commit -a`.** Stage explicitly.
- **Squashing locally to hide Red→Green cycles.** History is the trace of the TDD loop.
