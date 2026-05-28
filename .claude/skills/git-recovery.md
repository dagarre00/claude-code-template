---
name: git-recovery
description: Emergency and advanced git operations — stash, cherry-pick, bisect, blame, undo a commit, recover lost work, clean up a branch. Trigger on "stash", "cherry-pick", "bisect", "git blame", "lost commit", "undo commit", "recover", "clean up branch", "drop commit", "reflog".
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
- `feature-branching` says "don't be clever with stashing" — when in doubt, checkpoint-tag and reset.

## Cherry-pick — bring a single commit across branches

```bash
# Find the commit SHA you want
git log --oneline <source-branch> | head -20

# Apply it to the current branch
git cherry-pick <sha>

# If conflicts arise, follow conflict-resolution skill, then:
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

## Clean up a feature branch before PR

```bash
# Fetch latest main
git fetch origin main

# Rebase onto current main (resolves conflicts per commit)
git rebase origin/main

# Safe force-push (fails if remote has diverged beyond your rebase)
git push --force-with-lease origin <branch>
```

Only `--force-with-lease`, never bare `--force`.

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
git log HEAD..origin/main --oneline   # commits on main not in your branch
git log origin/main..HEAD --oneline   # your commits not yet on main
```
