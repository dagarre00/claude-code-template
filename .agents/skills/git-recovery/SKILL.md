---
name: git-recovery
description: Emergency and advanced git operations, and merge/rebase conflict resolution. Stash, cherry-pick, bisect, blame, undo a commit, recover lost work, clean up a branch, resolve conflicts. Trigger on "stash", "cherry-pick", "bisect", "git blame", "lost commit", "undo commit", "recover", "clean up branch", "drop commit", "reflog", "merge conflict", "rebase conflict", "CONFLICT (content)", "<<<<<<", "resolve conflict", "git merge failed", "git rebase failed".
type: skill
---

# Git Recovery & Advanced Operations

## Stash — pause mid-task cleanly

Prefer committing a checkpoint over stashing. Stash is for genuinely temporary interruptions (e.g. a quick bug-fix on another branch while mid-feature).

```bash
# Save with a label so you know what it is
git stash push -m "wip: <what you were doing>"

# List stashes
git stash list

# Restore the most recent
git stash pop

# Restore a specific entry (e.g. stash@{2})
git stash pop stash@{2}

# Discard a stash you no longer need
git stash drop stash@{0}
```

**Rules:**
- Never stash across a branch switch and forget about it. Always pop before the next session.
- If the stash is more than one session old, pop it, commit the state, and resume properly.
- `feature-branching` prefers a checkpoint-tagged `wip:` commit over a stash — when in doubt, checkpoint-tag and reset.

## Cherry-pick — bring a single commit across branches

```bash
# Find the commit SHA you want
git log --oneline <source-branch> | head -20

# Apply it to the current branch
git cherry-pick <sha>

# If conflicts arise, resolve them (see "Resolve merge / rebase / cherry-pick conflicts" below), then:
git cherry-pick --continue   # or --abort
```

Use sparingly. Cherry-picks create duplicated history. Prefer merging branches when the work is related.

## Bisect — binary-search for a regression

```bash
git bisect start
git bisect bad                 # current commit is broken
git bisect good <known-good-sha>   # last known-good commit

# Git checks out a midpoint — run your test:
<test command from docs/wiki/commands.md>

git bisect good    # if test passes at this midpoint
git bisect bad     # if test fails

# Repeat until git identifies the first bad commit.
git bisect reset   # always reset when done — restores HEAD
```

## Blame — trace a line's history

```bash
# Who last changed line 42 of a file
git blame -L 42,42 src/path/to/file.py

# Ignore whitespace changes
git blame -w src/path/to/file.py

# Show the commit that introduced a specific string
git log -S "the string" --oneline src/path/to/file.py
```

## Undo a commit (not yet pushed)

```bash
# Soft reset — keeps changes staged
git reset --soft HEAD~1

# Mixed reset — keeps changes unstaged (default)
git reset HEAD~1

# Hard reset — DISCARDS changes (destructive, ask human first)
git reset --hard HEAD~1
```

Never hard-reset without a checkpoint tag first:
```bash
git tag checkpoint-$(date -u +%Y%m%dT%H%M%SZ)
git reset --hard HEAD~1
```

## Recover a "lost" commit via reflog

Commits are rarely truly lost — `git reflog` stores every HEAD movement for 90 days.

```bash
git reflog | head -20           # find the SHA you want to recover
git checkout <sha>              # detached HEAD at that point
git checkout -b recover/<stamp> # save it as a branch
```

## Remove a file from history (sensitive data)

This is destructive and rewrites history — always get human approval first.

```bash
# Modern approach (requires git-filter-repo, preferred over filter-branch)
git filter-repo --path <sensitive-file> --invert-paths

# After, everyone who cloned must re-clone — communicate this.
```

## Sync a feature branch with develop before PR

```bash
git fetch origin develop
git merge origin/develop   # resolve conflicts per commit (see below), then re-run the full suite
git push
```

Merging, not rebasing, is the routine sync: sessions share branches, and a rebase rewrites pushed history another session may hold. Rebase + `--force-with-lease` only with explicit human approval (`human-checkpoint`); bare `--force` never.

## Delete a branch

```bash
# After merge — delete local
git branch -d feat/<slug>      # safe: refuses if unmerged
git branch -D feat/<slug>      # force delete (use only when sure)

# Delete remote
git push origin --delete feat/<slug>
```

The `feature-branching` skill's "Finishing the feature" checklist includes branch deletion as the last step after merge.

## Fetch without merging

```bash
# Update remote tracking refs without touching local branches
git fetch origin

# See what came in
git log HEAD..origin/develop --oneline   # commits on develop not in your branch
git log origin/develop..HEAD --oneline   # your commits not yet on develop
```

## Resolve merge / rebase / cherry-pick conflicts

Fires when git reports `CONFLICT (content)` and the tree has `<<<<<<<`, `=======`, `>>>>>>>` markers.

### 1 — Understand the full state

```bash
git status                     # every conflicted file
git diff --diff-filter=U       # all conflict markers at once
git log --oneline -10 HEAD     # what's being merged in
```

### 2 — Resolve each conflicted file

For every marker block: read **ours** (above `=======`) and **theirs** (below), decide keep-ours / keep-theirs / synthesis, delete the three marker lines, and verify the file is syntactically correct. If the correct resolution is ambiguous, stop and use `human-checkpoint` — do not guess.

### 3 — Verify nothing is left

```bash
grep -rn "<<<<<<\|=======\|>>>>>>>" src/ tests/ 2>/dev/null
```

Any output = unresolved markers; do not continue.

### 4 — Run the full test suite

Use the command from `docs/wiki/commands.md`. All tests must pass before marking resolution complete. If tests fail after a correct-looking resolution, the merge itself may be wrong — use `human-checkpoint`.

### 5 — Complete the operation

```bash
git add <resolved-files>
git commit                 # after merge — keep the auto-generated message
git rebase --continue      # after rebase — do NOT commit manually
git cherry-pick --continue # after cherry-pick
```

### 6 — Abort if in doubt

Rather than commit a guess when the human is unavailable:

```bash
git merge --abort   # or git rebase --abort / git cherry-pick --abort
```

Then tag a checkpoint and use `human-checkpoint`.

**Conflict anti-patterns:** committing conflict markers (always grep first); accepting "theirs" blindly (each side may hold correct logic); rebasing a shared branch (merge instead — see "Sync a feature branch" above). Merge develop in early and often to keep the conflict surface small.
