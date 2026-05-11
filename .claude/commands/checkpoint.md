---
name: checkpoint
description: Tag HEAD as checkpoint-<timestamp> before a risky operation, so /rollback can come back to it. Use before refactors that touch many files, before a destructive command, or before a two-strike retry.
type: command
---

# /checkpoint

You create a recoverable snapshot via a git tag. This is cheaper than a branch and easier to find.

## When to use

- Before a refactor that touches many files.
- Before a destructive command (drop tables, force-update, mass rename).
- Before retrying a failed implementation (two-strike rule).
- Before a `/rollback` (so you can undo the rollback if needed).

## Steps

1. **Verify working tree is committable.** If dirty:
   - Stage and commit with a `chore: checkpoint pre-<reason>` message, OR
   - Ask the human via `human-checkpoint` whether to commit or stash.

2. **Create the tag:**
   ```bash
   STAMP=$(date -u +%Y%m%dT%H%M%SZ)
   TAG="checkpoint-$STAMP"
   git tag -a "$TAG" -m "checkpoint: $REASON"
   ```
   Where `$REASON` is a one-line description provided by the human or inferred from the next planned operation.

3. **Push the tag** so it survives a local checkout being lost:
   ```bash
   git push origin "$TAG"
   ```
   If no remote: print a warning that the tag is local-only.

4. **Log it.** Append to `docs/wiki/log.md`:
   ```markdown
   ## [YYYY-MM-DD HH:MM] checkpoint — <reason>
   - Tag: checkpoint-<stamp>
   - HEAD: <short sha>
   - Branch: <name>
   ```

5. **Report to the human.** The tag name. The next planned operation. How to roll back (`/rollback`).

## What you do NOT do

- **No checkpoints on dirty trees without committing first.** Tags are pointers to commits; uncommitted work isn't tagged.
- **No checkpoint spam.** One checkpoint per risky operation is enough — don't tag every two minutes.
- **No tag deletion in this command.** Cleanup happens via `/rollback` or a separate operation.
