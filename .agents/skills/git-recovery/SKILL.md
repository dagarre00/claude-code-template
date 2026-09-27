---
name: git-recovery
description: Conductor-only. This project's rules for emergency and advanced git — undoing commits, recovering lost work, stash, cherry-pick, bisect, history rewrites, deleting branches — and the procedure for resolving merge, rebase and cherry-pick conflicts. Trigger on "stash", "cherry-pick", "bisect", "git blame", "lost commit", "undo commit", "recover", "clean up branch", "drop commit", "reflog", "merge conflict", "rebase conflict", "CONFLICT (content)", "<<<<<<", "resolve conflict", "git merge failed", "git rebase failed".
type: skill
---

# Git Recovery

Plain git, with this project's safety rules on top. Before anything destructive, run `git status --porcelain` and account for every line — changes you did not make belong to another session (rule 21).

## Rules for the risky operations

- **Destructive = ask first.** `git reset --hard`, `git branch -D`, `git clean`, a force-push, or any history rewrite needs the human's approval (`human-checkpoint`) and a checkpoint tag before it runs: `git tag checkpoint-$(date -u +%Y%m%dT%H%M%SZ)`. `git reset --soft` / `git reset` of an unpushed commit keep the changes and need neither.
- **Checkpoint over stash.** Pause mid-task with a tagged `wip:` commit (`feature-branching` § Mid-task pause). A stash is for a tiny interruption resumed in the same session; label it (`git stash push -m "wip: …"`) and never leave one across sessions — an old stash gets popped, committed, and resumed properly.
- **Merge, never rebase, to sync.** Sessions share branches concurrently, and a rebase rewrites pushed history another session holds. Rebase + `--force-with-lease` only with explicit approval; bare `--force` never; `develop` and `main` never.
- **Lost commits** stay in `git reflog` until gc expires them — by default 30 days for a commit no branch reaches: `git checkout -b recover/<stamp> <sha>`.
- **Sensitive data in history** → human approval, then `git filter-repo --path <file> --invert-paths` (not `filter-branch`), and everyone who cloned must re-clone.
- **Cherry-pick sparingly** — it duplicates history; merge related branches instead.
- **Bisect** with the project's test command (`git bisect run <test command>` when it exits non-zero on failure), and always `git bisect reset` when done.
- **Deleting a merged branch:** `git branch -d` (refuses if unmerged) and `git push origin --delete <branch>`; `-D` only with approval.

## Resolving conflicts

When a merge, rebase or cherry-pick reports `CONFLICT (content)`, resolve every block on its merits — each side may hold correct logic, so never take one side wholesale — and complete it only once no marker remains and the **full test suite** passes: `git commit` with the generated merge message, or `rebase`/`cherry-pick --continue` (never a manual commit mid-rebase).

- **An ambiguous block** → `human-checkpoint`, never a guess.
- **A failing suite after a correct-looking resolution** means the merge itself may be wrong → `human-checkpoint`.
- **In doubt with no human available:** abort (`git merge --abort`, or `rebase`/`cherry-pick --abort`), tag a checkpoint, and `human-checkpoint`.

`docs/wiki/log.md` merges by union and never conflicts, but may come out of order — `node tools/workflow-mcp/verify.mjs --sort-log`, committed with the merge.
