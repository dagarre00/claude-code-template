---
name: git-recovery
description: Conductor-only. Emergency and advanced git procedure — undoing commits, recovering lost work (reflog), stash vs checkpoint, cherry-pick, bisect, history rewrites, deleting branches, and resolving merge/rebase/cherry-pick conflicts.
user-invocable: false
---

# Git Recovery

Before any destructive git operation, run `git status --porcelain` and account for every line (rule 21).

## Rules for the risky operations

- **Destructive = ask first:** `git reset --hard`, `git branch -D`, `git clean`, force-push, or any history rewrite requires `human-checkpoint` approval and a tag first (`git tag checkpoint-$(date -u +%Y%m%dT%H%M%SZ)`). `git reset --soft` / `git reset` of an unpushed commit preserves changes and needs neither.
- **Checkpoint over stash:** Pause mid-task with a tagged `wip:` commit (`feature-branching § Mid-task pause`). Use stash only for a brief same-session pause (`git stash push -u -m "wip: <unique tag>"`, apply by SHA from `git stash list --format='%H %gs'`, never bare `git stash pop`).
- **Merge, never rebase, to sync:** Rebase + `--force-with-lease` requires explicit human approval; bare `--force` or rebasing `develop`/`main` is forbidden.
- **Lost commits:** Recover from `git reflog` via `git checkout -b recover/<stamp> <sha>`.
- **Sensitive data in history:** Requires human approval, then `git filter-repo --path <file> --invert-paths` (never `filter-branch`).
- **Cherry-pick sparingly** (prefer merging related branches).
- **Bisect** with `git bisect run <test command>` and always finish with `git bisect reset`.
- **Deleting a merged branch:** `git branch -d <branch>` and `git push origin --delete <branch>` (`-D` requires approval).

## Resolving conflicts

On `CONFLICT (content)`, resolve every hunk on its merits (never take one side wholesale) and complete the operation (`git commit` or `rebase`/`cherry-pick --continue`) only after no conflict markers remain and the **full test suite** passes.

- **Ambiguous hunk or failing suite after resolution** → `human-checkpoint`.
- **When in doubt with no human available:** abort (`git merge --abort` / `rebase --abort` / `cherry-pick --abort`), tag a checkpoint, and run `human-checkpoint`.

If union-merging `docs/wiki/log.md` puts entries out of order, sort them oldest-first by `## [YYYY-MM-DD HH:MM]` in the merge commit.
