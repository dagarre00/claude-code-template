---
name: feature-branching
description: Conductor-only. Branching procedure — when and how to branch, batching todos, pausing mid-task, syncing with develop, and cleaning up after a merge. Commit and branch naming live in docs/wiki/git-conventions.md.
user-invocable: false
---

# Branching

Code (`feat/*`, `fix/*`, `refactor/*`, `perf/*`) ships on a branch cut from `develop` and merged via PR. Living documentation and maintenance (`docs/wiki/`, `docs/raw/`, `.claude/`) commit directly to `develop` or ride the active branch (rule 19). Naming and commit format: [`docs/wiki/git-conventions.md`](../../../docs/wiki/git-conventions.md).

## Starting work

1. **Clean tree:** `git status --porcelain` must be empty (else `human-checkpoint` or see `§ Mid-task pause`).
2. **Sync `develop`** (`fetch` + `merge --ff-only`, never `pull`):

   ```bash
   git checkout develop || { echo "could not switch to develop — stop and run human-checkpoint"; exit 1; }
   if git remote get-url origin >/dev/null 2>&1; then
     git fetch origin develop "refs/heads/<type>/<slug>:refs/remotes/origin/<type>/<slug>" 2>/dev/null || git fetch origin develop || { echo "fetch failed — stop and run human-checkpoint"; exit 1; }
     git merge --ff-only origin/develop || { echo "develop has diverged from origin — stop and run human-checkpoint"; exit 1; }
   fi
   ```

   If `--ff-only` fails, `develop` diverged → `human-checkpoint` (never force or rebase). If no `origin` remote exists, both fetch and merge are skipped cleanly.
3. **Create or resume `<type>/<slug>`** (`<type>` ∈ `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`):

   ```bash
   git checkout "<type>/<slug>" 2>/dev/null || git checkout -b "<type>/<slug>"
   if git rev-parse --verify "origin/<type>/<slug>" >/dev/null 2>&1; then
     git merge --ff-only "origin/<type>/<slug>" || { echo "<type>/<slug> has diverged from origin — stop and run human-checkpoint"; exit 1; }
   fi
   ```

**`<slug>` equals the entity-page slug** (or `[infra]` concept slug) — branch, wiki page, `.handoff/<slug>-plan.md`, and test names all key off it.

## Which command branches

| Command | Branch |
| --- | --- |
| `/project:work` | `feat/<slug>` (or `fix/<slug>`), cut before the first failing test |
| `/project:interview`, `/project:wiki`, `/project:review` | none — on `develop` (via [`sync-develop.md`](sync-develop.md)) or the active `feat/*` |
| `/project:adversary` | none — runs on the active branch (`develop` only for release review, whose approved fixes cut `fix/<slug>`) |

## Batching todos

Multiple todos share a branch only when they target the same entity page, depend on each other sequentially, and splitting them would produce a meaningless intermediate PR. A batch shares a branch, plan, and PR (never a single squashed commit), and 2+ todos trigger `planner`.

## Mid-task pause

If interrupted before a green commit boundary:

- **Preferred — checkpoint commit:** Stage paths explicitly (never `git add -p`), commit `wip: <what's in flight>`, and tag `git tag checkpoint-$(date -u +%Y%m%dT%H%M%SZ)`. On resume, `git reset HEAD~1`.
- **Fallback — named stash** (same-session only): `git stash push -u -m "wip: <unique tag>"`, record its SHA from `git stash list --format='%H %gs'`, and later apply via `git stash apply <sha>` (never bare `git stash pop`).

## Syncing a long-running branch

```bash
git fetch origin develop
git merge origin/develop     # conflicts: git-recovery skill
<test command>               # re-verify after merge
git push
```

If union-merging `docs/wiki/log.md` puts entries out of timestamp order, sort them oldest-first by `## [YYYY-MM-DD HH:MM]` in the merge commit. Never rebase a pushed branch without explicit human approval.

## After the human merges the PR

```bash
git checkout develop
git fetch origin develop && git merge --ff-only origin/develop
git branch -d feat/<slug>
git push origin --delete feat/<slug>
```

## Anti-patterns

- **Committing code to `develop` or `main`.**
- **`git commit -a` or `git add -A`** (stage explicit paths per rule 21).
- **Squashing commits to hide the Red→Green trace.**
