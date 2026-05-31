---
name: conflict-resolution
description: How to resolve merge or rebase conflicts in this project. Trigger on "merge conflict", "rebase conflict", "CONFLICT (content)", "<<<<<<", "resolve conflict", "git merge failed", "git rebase failed".
type: skill
---

# Conflict Resolution

## When this fires

Git reports `CONFLICT (content)` during a `git merge`, `git rebase`, or `git cherry-pick`. The working tree contains conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`).

## Procedure

### 1 — Understand the full state

```bash
git status                     # lists every conflicted file
git diff --diff-filter=U       # shows all conflict markers at once
git log --oneline -10 HEAD     # see what's being merged in
```

### 2 — Resolve each conflicted file

Open each file listed under `both modified` (or `both added`). For every conflict marker block:

1. Read **ours** (above `=======`) and **theirs** (below `=======`).
2. Decide: keep ours, keep theirs, or write a synthesis.
3. Delete the three marker lines (`<<<<<<<`, `=======`, `>>>>>>>`).
4. Verify the file is syntactically correct.

If the correct resolution is ambiguous, stop and use `human-checkpoint` — do not guess.

### 3 — Verify nothing is left

```bash
grep -rn "<<<<<<\|=======\|>>>>>>>" src/ tests/ 2>/dev/null
```

If that prints anything, there are unresolved markers — do not continue.

### 4 — Run the test suite

```bash
# Use the command from docs/wiki/commands.md
```

All tests must pass before marking resolution complete. If tests fail after a correct-looking resolution, the merge itself may be wrong — use `human-checkpoint`.

### 5 — Complete the operation

**After `git merge`:**
```bash
git add <resolved-files>
git commit   # uses the auto-generated merge commit message — keep it
```

**After `git rebase`:**
```bash
git add <resolved-files>
git rebase --continue   # do NOT commit manually; rebase applies commits one by one
```

**After `git cherry-pick`:**
```bash
git add <resolved-files>
git cherry-pick --continue
```

### 6 — Abort if in doubt

If at any point the resolution is unclear and the human is unavailable, abort cleanly rather than committing a guess:

```bash
git merge --abort      # or
git rebase --abort     # or
git cherry-pick --abort
```

Then tag a checkpoint and use `human-checkpoint` to surface the situation.

## Long-running branch drifting from develop

When a feature branch is many commits behind `develop`, conflict surface grows. Prefer rebasing onto `develop` _early and often_ (after each integration lands on develop) rather than accumulating drift:

```bash
git fetch origin develop
git rebase origin/develop    # conflict-resolve per commit if needed
git push --force-with-lease origin <branch>   # safe force-push: fails if remote has diverged elsewhere
```

`--force-with-lease` is the only acceptable force-push in this project, and only on **feature** branches. Never `--force`, and never force-push `develop` or `main`.

## Anti-patterns

- **Committing conflict markers.** Always grep for `<<<<<<<` before committing.
- **Accepting "theirs" blindly.** Each side may have introduced correct logic.
- **Rebasing `develop` or `main`.** Both are protected — never rebase them. Only rebase short-lived branches that are yours alone. If someone else has pulled your branch, merge instead.
- **Guessing a merge into a protected branch.** If resolving a `feat/* → develop` (or `develop → main`) merge is ambiguous, `git merge --abort` and use `human-checkpoint` rather than committing a guess.
