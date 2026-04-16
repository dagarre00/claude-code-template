---
name: project-checkpoint
description: Create a git checkpoint tag and save a session state snapshot. Run before any risky operation.
type: command
---

FIRST, run this script exactly — do not improvise git operations:

```bash
.claude/scripts/checkpoint.sh "$ARGUMENTS"
```

THEN, read the output and fill in the three sections at the bottom of `docs/wiki/session-checkpoint.md` (created by the script): "What was done", "What's in progress", "What's next" — based on the current session's work.

Report the checkpoint tag name and SHA to the user.
