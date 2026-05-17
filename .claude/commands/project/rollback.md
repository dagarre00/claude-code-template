---
name: rollback
description: List available checkpoint tags and revert to one. Destructive — confirm with human before resetting. Use after a failed implementation, a broken refactor, or a two-strike pivot.
type: command
---

# /project:rollback

You restore the project to a prior `checkpoint-<timestamp>` tag. This is **destructive** to the current working tree — confirm with the human first.

## Preconditions

- At least one `checkpoint-*` tag exists.
- The human is present to confirm.

If no checkpoints exist: run `human-checkpoint` — explain there's nothing to roll back to.

## Steps

1. **List checkpoints, most recent first:**
   ```bash
   git tag --list 'checkpoint-*' --sort=-creatordate | head -10
   ```

2. **For each, show context:**
   ```bash
   for t in $(git tag --list 'checkpoint-*' --sort=-creatordate | head -10); do
     echo "--- $t ---"
     git show "$t" --no-patch --format='%cd %s' --date=short
   done
   ```

3. **Ask the human** via `human-checkpoint` which tag to roll back to. Show:
   - The tag list with one-line summaries.
   - The current branch + HEAD.
   - Your recommendation (usually the most recent checkpoint before the failure point).

4. **Confirm scope of destruction.** Default is `git reset --hard <tag>` on the current branch — this **discards uncommitted changes and commits after the tag on the current branch**. State this explicitly before acting.

5. **Optional: pre-rollback checkpoint.** Before resetting, create one more checkpoint via `/project:checkpoint` so the rollback itself is recoverable.

6. **Reset:**
   ```bash
   git reset --hard <chosen-tag>
   ```

7. **If the original branch was pushed**, warn the user that the remote diverges and they may need to force-push. Do **not** auto-force-push from this command.

8. **Log it.** Append to `docs/wiki/log.md`:
   ```markdown
   ## [YYYY-MM-DD HH:MM] rollback
   - To: <tag>
   - From: <previous HEAD short sha>
   - Reason: <why>
   ```

9. **Report to the human.** Where they are now. Recommended next step (often `/project:interview` to re-spec, or `/project:work` to retry differently — never repeat the same approach that failed).

## What you do NOT do

- **No force-push.** Even on a feature branch, this command does not force-push. The human runs that explicitly if they want it.
- **No silent reset.** Always state what's being discarded before acting.
- **No rollback to a tag the human didn't pick.** Even if "obvious."
- **No rollback as a routine cleanup.** This is a recovery tool. Reach for it after a clear failure.
