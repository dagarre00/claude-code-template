---
name: feature-branching
description: Conductor-only. Branching procedure — when and how to branch, batching todos, pausing mid-task, syncing with develop, and cleaning up after a merge. Commit and branch naming live in docs/wiki/git-conventions.md. Trigger on "start branch", "feat/", "fix/", "batch todos", "finish feature".
type: skill
---

# Branching

Code (`feat/*`, `fix/*`, `refactor/*`, `perf/*`) is built on a branch cut from `develop` and merged by PR. Living documentation and maintenance (`docs/wiki/`, `docs/raw/`, `.agents/` config) commit directly to `develop`, or ride the active branch (rule 19). Naming and commit format: [`docs/wiki/git-conventions.md`](../../../docs/wiki/git-conventions.md).

## Starting work

1. **Clean tree:** `git status --porcelain` prints nothing. Dirty → `human-checkpoint` (or see Mid-task pause).

2. **Sync `develop`** — `fetch` + `merge --ff-only`, not `pull`, so a diverged `develop` fails safely:

   ```bash
   git checkout develop || { echo "could not switch to develop — stop and run human-checkpoint"; exit 1; }
   if git remote get-url origin >/dev/null 2>&1; then
     git fetch origin develop "refs/heads/<type>/<slug>:refs/remotes/origin/<type>/<slug>" 2>/dev/null || git fetch origin develop || { echo "fetch failed — stop and run human-checkpoint"; exit 1; }
     git merge --ff-only origin/develop || { echo "develop has diverged from origin — stop and run human-checkpoint"; exit 1; }
   fi
   ```

   A `--ff-only` failure means `develop` diverged → `human-checkpoint`; never force or rebase it. The fetch and merge share one guard, so with no `origin` both are skipped and the block works off local `develop` (a merge outside the guard would fail with `not something we can merge`).

3. **Create or resume** `<type>/<slug>` — `<type>` ∈ `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`:

   ```bash
   git checkout "<type>/<slug>" 2>/dev/null || git checkout -b "<type>/<slug>"
   if git rev-parse --verify "origin/<type>/<slug>" >/dev/null 2>&1; then
     git merge --ff-only "origin/<type>/<slug>" || { echo "<type>/<slug> has diverged from origin — stop and run human-checkpoint"; exit 1; }
   fi
   ```

   The `rev-parse` guard tells "no remote branch yet" (fine — first push to come) apart from "it exists and diverged" (stop — another session pushed here).

**`<slug>` equals the entity-page slug** — the branch, the entity page, the plan scratch (`.handoff/<slug>-plan.md`) and the test names all key off it. Pick it once.

## Which command branches

| Command | Branch |
| --- | --- |
| `/project:work` | `feat/<slug>`, created before the failing test |
| `/project:interview`, `/project:wiki`, `/project:review` | none — on `develop` (via [`sync-develop.md`](sync-develop.md)) or the active `feat/*` |
| `/project:adversary` | none — the existing `feat/*`/`fix/*`/`chore/*`; `develop` only for the release review |

Already on a branch whose work this belongs to → stay, and let its PR carry the change.

## Batching todos

Two todos share a branch only when **all** hold: same entity page, the second depends on the first, and splitting them yields a meaningless intermediate PR. A batch shares a branch, a plan and a PR — never a commit — and 2+ todos trigger the `planner`.

## Mid-task pause

Interrupted before a green commit boundary:

- **Preferred — checkpoint.** Stage your paths explicitly (never `git add -p`: an interactive prompt hangs with no human), commit `wip: <what's in flight>`, and `git tag checkpoint-$(date -u +%Y%m%dT%H%M%SZ)`. On resume, `git reset HEAD~1` and continue.
- **Fallback — stash**, only for a tiny change resumed within the same session: `git stash push -m "wip: <what>"`, later `git stash pop`. Never leave a stash across sessions.

## Syncing a long-running branch

Merge `develop` in early and often — the conflict surface only grows:

```bash
git fetch origin develop
git merge origin/develop     # conflicts: git-recovery skill
<test command>               # a merge can bring breakage — re-verify
git push
```

After it, `docs/wiki/log.md` (merged by union) may be out of order: `node tools/workflow-mcp/verify.mjs --sort-log` and commit the result with the merge. Never rebase a pushed branch as routine sync — sessions share branches concurrently. Rebase + `--force-with-lease` needs explicit human approval; bare `--force`, never.

## After the human merges the PR

```bash
git checkout develop
git fetch origin develop && git merge --ff-only origin/develop
git branch -d feat/<slug>              # safe delete: refuses if unmerged
git push origin --delete feat/<slug>
```

## Anti-patterns

- **Committing code to `develop` or `main`.** Branch first.
- **`git commit -a` or `git add -A`.** Stage your own paths explicitly (rule 21).
- **Squashing to hide the Red→Green trace.** History is the evidence the loop ran.
