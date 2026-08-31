---
name: feature-branching
description: Branching procedure for this project — when to branch, batching rules, finishing-up checklist. Commit-message format itself lives in docs/wiki/git-conventions.md. Trigger on "start branch", "feat/", "fix/", "batch todos", "finish feature".
type: skill
---

# Branching

Always branch before code implementation. Feature and bugfix code (`feat/*`, `fix/*`, `refactor/*`, `perf/*`) is built on a dedicated branch cut from `develop` and merged via PR. Living documentation and maintenance (`docs/wiki/`, `docs/raw/`, `.claude/` config) commits directly to `develop` (or stays on your active branch) to keep the living spec responsive without PR fatigue. Commit-message format and PR template live in [`docs/wiki/git-conventions.md`](../../../docs/wiki/git-conventions.md).

## Starting work

1. Confirm clean tree:

   ```bash
   git status --porcelain
   ```

   If dirty: stop and run `human-checkpoint`. See **Mid-task pause** below if you need to temporarily set aside in-progress work.

2. Fetch and sync develop. Using `fetch` + `merge --ff-only` (rather than bare `pull`) makes the two steps explicit and fails safely if develop has diverged in a non-fast-forward way:

   ```bash
   git checkout develop || { echo "could not switch to develop — stop and run human-checkpoint"; exit 1; }
   if git remote | grep -q .; then
     git fetch origin develop "refs/heads/<type>/<slug>:refs/remotes/origin/<type>/<slug>" 2>/dev/null || git fetch origin develop || { echo "fetch failed — stop and run human-checkpoint"; exit 1; }
     git merge --ff-only origin/develop || { echo "develop has diverged from origin — stop and run human-checkpoint"; exit 1; }
   fi
   ```

   If `merge --ff-only` fails, develop has diverged — use `human-checkpoint`. Do not force or rebase develop. No remote at all (`git remote` prints nothing)? The fetch **and** the `merge --ff-only` are both inside the guard, so both are skipped and the block works straight off local `develop`. Keep them together: without a remote there is no `origin/develop` to merge, and a merge left outside the guard fails with `not something we can merge`.

3. Branch as `<type>/<short-slug>` where `<type>` ∈ `feat`, `fix`, `chore`, `docs`, `refactor`, `test`. Examples: `feat/auth-login`, `fix/race-on-double-submit`, `chore/upgrade-pytest`, `feat/profile` (batched).

   ```bash
   git checkout "<type>/<slug>" 2>/dev/null || git checkout -b "<type>/<slug>"
   if git rev-parse --verify "origin/<type>/<slug>" >/dev/null 2>&1; then
     git merge --ff-only "origin/<type>/<slug>" || { echo "<type>/<slug> has diverged from origin — stop and run human-checkpoint"; exit 1; }
   fi
   ```

   The `rev-parse --verify` guard tells "remote branch doesn't exist yet" (fine — this is likely the first push) apart from "remote branch exists and has diverged" (stop — another session may have pushed here).

**The `<slug>` must equal the entity-page slug** — the branch name (`feat/<slug>`), the entity page, the plan scratch (`.claude/handoff/<slug>-plan.md`), and the test names all key off it. Pick it once and keep it stable.

## Which command branches, and when

Code mutations branch **before the first write** (behavioral rule 19). Living documentation and knowledge-base maintenance commit directly to `develop` when standing on `develop`, or stay on your active feature branch if running mid-task.

| Command                | Branch                             | Created before          |
| ---------------------- | ---------------------------------- | ----------------------- |
| `/project:work`        | `feat/<slug>`                      | the failing test        |
| `/project:interview`   | none (direct on `develop` or active `feat/*`) | —                       |
| `/project:wiki-ingest` | none (direct on `develop` or active `feat/*`) | —                       |
| `/project:agent-scout` | none (direct on `develop` or active `feat/*`) | —                       |
| `/project:wiki-lint`   | none (direct on `develop` or active `feat/*`) | —                       |
| `/project:review`      | none (direct on `develop` or active `feat/*`) | —                       |
| `/project:handoff`     | none (direct on `develop` or active `feat/*`) | —                       |
| `/project:adversary`   | none (runs on existing `feat/*` branch)       | —                       |

In every case the rule is the same: **code changes branch from `develop`.** Already on a `feat/*`/`fix/*` branch whose work this belongs to → stay there and let that branch's PR carry the change.

## Batching todos

Two todos share a branch when **all** are true: same entity page, second depends on first, splitting produces a meaningless intermediate commit. Otherwise — separate branches. Batches of 2+ also trigger the `planner` — it writes a plan (via `plan-writing`) that the `developer` follows (see `/project:work` step 4).

## Mid-task pause

When interrupted mid-cycle (not at a green commit boundary), pick the lightest-weight option:

1. **Preferred — checkpoint tag.** Commit the in-progress state with a `wip:` prefix, tag it, then reset when resuming:

   ```bash
   git add <coherent-paths>                 # stage explicitly by path — never `git add -p` (interactive mode hangs with no human at the prompt)
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

If conflicts arise, follow the `git-recovery` skill (Resolve merge / rebase / cherry-pick conflicts). `--force-with-lease` is the only acceptable force-push form; never bare `--force`.

## Commit cadence

- One commit per green TDD cycle (test + impl + entity-page update bundled).
- Refactor commits are separate from feat commits.
- Don't commit half-green code. Mid-cycle stop → tag a checkpoint (`git tag checkpoint-$(date -u +%Y%m%dT%H%M%SZ)`) and leave the tree.

## Finishing the feature

1. Final test run — full suite, not just the touched tests.
2. Entity page reflects current state; Behavior cases ticked.
3. TODO checked off / removed from `docs/wiki/todos.md` (shipped work lives in git history).
4. Sync with develop one last time before pushing (catches late changes to develop):

   ```bash
   git fetch origin develop
   git rebase origin/develop   # follow git-recovery skill (conflicts) if needed
   ```

5. Push: `git push -u origin <branch>` (or `git push --force-with-lease` after a rebase).
6. **Auto-PR (invoked by `/project:work`):** follow `pr-create` skill to draft and open the PR targeting `develop`, then `git checkout develop`.
7. After the human merges the PR — clean up both local and remote branch:

   ```bash
   git checkout develop
   git pull --ff-only
   git branch -d feat/<slug>              # safe delete (errors if unmerged)
   git push origin --delete feat/<slug>   # delete remote tracking branch
   ```

## Anti-patterns

- **Committing code to `develop` or `main`.** Branch first. (Living documentation and maintenance commands commit directly to `develop` under behavioral rule 19 — see the table above.)
- **`git commit -a`.** Stage explicitly.
- **Squashing locally to hide Red→Green cycles.** History is the trace of the TDD loop.
