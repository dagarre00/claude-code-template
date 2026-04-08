FIRST, run this script exactly — do not improvise the git operations:

```bash
.claude/scripts/checkpoint.sh "$ARGUMENTS"
```

THEN, read the output and fill in the three sections at the bottom of `docs/agent-context/session-checkpoint.md`: "What was done", "What's in progress", "What's next" — based on the current session's work.

Report the checkpoint tag name and SHA to the user.
