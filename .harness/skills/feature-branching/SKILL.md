---
name: feature-branching
description: "Branching procedure for this project — when to branch, batching rules, finishing-up checklist. Commit-message format itself lives in docs/wiki/git-conventions.md. Trigger on \"start branch\", \"feat/\", \"fix/\", \"batch todos\", \"finish feature\"."
---

# Branching

**Conductor only for mutating Git operations.** An MCP worker stays on the
server-assigned branch and must not run this skill's branch, sync, tag, reset,
stash, merge, push, PR, or cleanup procedures. It returns its blocker/result to
the conductor. Before a conductor branch switch or history operation, inspect
`list_workers()`; do not strand an active task pinned to the integration branch.
Worker integration and worktree cleanup go through `mcp-coordination`, not the
shell examples below. Human remote PR merges remain separate.

Always branch before code implementation. Feature and bugfix code (`feat/*`, `fix/*`, `refactor/*`, `perf/*`) is built on a dedicated branch cut from `develop` and merged via PR. Living documentation and maintenance (`docs/wiki/`, `docs/raw/`, `.harness/` config) commits directly to `develop` (or stays on your active branch) to keep the living spec responsive without PR fatigue. Commit-message format and PR template live in [`docs/wiki/git-conventions.md`](../../../docs/wiki/git-conventions.md).

## Starting work

1. Confirm clean tree:

   ```bash
   git status --porcelain
   ```

   If dirty: stop and run `human-checkpoint`. See **Mid-task pause** below if you need to temporarily set aside in-progress work.

2. Fetch and sync develop. Using `fetch` + `merge --ff-only` (rather than bare `pull`) makes the two steps explicit and fails safely if develop has diverged in a non-fast-forward way:

   ```bash
   git checkout develop || { echo "could not switch to develop — stop and run human-checkpoint"; exit 1; }
   if git remote get-url origin >/dev/null 2>&1; then
     git fetch origin develop "refs/heads/<type>/<slug>:refs/remotes/origin/<type>/<slug>" 2>/dev/null || git fetch origin develop || { echo "fetch failed — stop and run human-checkpoint"; exit 1; }
     git merge --ff-only origin/develop || { echo "develop has diverged from origin — stop and run human-checkpoint"; exit 1; }
   fi
   ```

   If `merge --ff-only` fails, develop has diverged — use `human-checkpoint`. Do not force or rebase develop. No `origin` remote (`git remote get-url origin` fails)? The fetch **and** the `merge --ff-only` are both inside the guard, so both are skipped and the block works straight off local `develop`. Keep them together: without a remote there is no `origin/develop` to merge, and a merge left outside the guard fails with `not something we can merge`.

3. Branch as `<type>/<short-slug>` where `<type>` ∈ `feat`, `fix`, `chore`, `docs`, `refactor`, `test`. Examples: `feat/auth-login`, `fix/race-on-double-submit`, `chore/upgrade-pytest`, `feat/profile` (batched).

   ```bash
   git checkout "<type>/<slug>" 2>/dev/null || git checkout -b "<type>/<slug>"
   if git rev-parse --verify "origin/<type>/<slug>" >/dev/null 2>&1; then
     git merge --ff-only "origin/<type>/<slug>" || { echo "<type>/<slug> has diverged from origin — stop and run human-checkpoint"; exit 1; }
   fi
   ```

   The `rev-parse --verify` guard tells "remote branch doesn't exist yet" (fine — this is likely the first push) apart from "remote branch exists and has diverged" (stop — another session may have pushed here).

**The `<slug>` must equal the entity-page slug** — the branch name (`feat/<slug>`), the entity page, the plan scratch (`.harness/handoff/<slug>-plan.md`), and the test names all key off it. Pick it once and keep it stable.

## Which command branches, and when

Code mutations branch **before the first write** (behavioral rule 19). Living documentation and knowledge-base maintenance commit directly to `develop` when standing on `develop`, or stay on your active feature branch if running mid-task.

| Command                | Branch                             | Created before          |
| ---------------------- | ---------------------------------- | ----------------------- |
| `{{cmd:work}}`        | `feat/<slug>`                      | the failing test        |
| `{{cmd:interview}}`   | none (direct on `develop` or active `feat/*`) | —                       |
| `{{cmd:wiki-ingest}}` | none (direct on `develop` or active `feat/*`) | —                       |
| `{{cmd:agent-scout}}` | none (direct on `develop` or active `feat/*`) | —                       |
| `{{cmd:wiki-lint}}`   | none (direct on `develop` or active `feat/*`) | —                       |
| `{{cmd:review}}`      | none (direct on `develop` or active `feat/*`) | —                       |
| `{{cmd:handoff}}`     | none (direct on `develop` or active `feat/*`) | —                       |
| `{{cmd:adversary}}`   | none (existing `feat/*`/`fix/*`/`chore/*`; `develop` only for the release review) | — |

The maintenance commands sync via the canonical guarded block in [`sync-develop.md`](sync-develop.md) (next to this skill) — one copy, referenced everywhere.

In every case the rule is the same: **code changes branch from `develop`.** Already on a `feat/*`/`fix/*` branch whose work this belongs to → stay there and let that branch's PR carry the change.

## Batching todos

Two todos share a branch when **all** are true: same entity page, second depends on first, splitting produces a meaningless intermediate commit. Otherwise — separate branches. Batches of 2+ also trigger the `planner` — it returns a plan through MCP (via `plan-writing`) that the conductor forwards inline to the `developer` (see `{{cmd:work}}` step 4).

## Mid-task pause

Preserve the integration checkout and any active worker state. Do not switch
branches or stash unknown changes to handle an interruption. Workers return
their current SHA, dirty paths, and blocker; the conductor resumes from task
status rather than assuming local work was pushed. For explicitly authorized
recovery of conductor-owned work, consult `git-recovery` and account for exact
paths before mutation. Never reset a partial worker merely to make it restartable.

## Sync with develop (long-running branches)

When your branch has been open for a while and develop has moved on, **merge develop in** — early and often; the longer you wait, the larger the conflict surface:

```bash
git fetch origin develop
git merge origin/develop     # resolve conflicts per git-recovery skill
<test command>               # the merge can bring in breakage — re-verify
git push
```

Never rebase a pushed branch as routine sync: other sessions may hold the integration branch (behavioral rule 21, `{{cmd:work}}` step 2's divergence guard), and a rebase rewrites history another session may hold. Rebase + `--force-with-lease` is an exception that needs explicit human approval via `human-checkpoint`; bare `--force` is never used.

## Commit cadence

- One commit per green TDD cycle (test + impl + entity-page update bundled).
- Refactor commits are separate from feat commits.
- Workers commit green cases locally, never push; conductor integrates and pushes.
- Don't commit half-green code. A mid-cycle worker stop preserves the tree and
  returns a blocker; conductor recovery requires explicit ownership and scope.

## Finishing the feature

1. Final test run — full suite, not just the touched tests.
2. Entity page reflects current state; Behavior cases ticked.
3. TODO checked off / removed from `docs/wiki/todos.md` (shipped work lives in git history).
4. Sync with develop one last time before pushing (catches late changes to develop):

   ```bash
   git fetch origin develop
   git merge origin/develop    # follow git-recovery skill (conflicts) if needed; then re-run the tests
   ```

5. Push: `git push -u origin <branch>`.
6. **Auto-PR (invoked by `{{cmd:work}}`):** follow `pr-create` skill to draft and open the PR targeting `develop`, then `git checkout develop`.
7. Only after confirming the human actually merged the remote PR and no task
   still depends on this integration branch, perform authorized feature-branch
   cleanup. Worker branches/worktrees are cleaned by MCP, not this block:

   ```bash
   git checkout develop
   git fetch origin develop && git merge --ff-only origin/develop
   git branch -d feat/<slug>              # safe delete (errors if unmerged)
   git push origin --delete feat/<slug>   # delete remote tracking branch
   ```

## Anti-patterns

- **Committing code to `develop` or `main`.** Branch first. (Living documentation and maintenance commands commit directly to `develop` under behavioral rule 19 — see the table above.)
- **`git commit -a`.** Stage explicitly.
- **Squashing locally to hide Red→Green cycles.** History is the trace of the TDD loop.
