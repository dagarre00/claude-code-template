---
name: project-rollback
description: List available git checkpoints and revert to one. Use when an implementation attempt has failed review/tests.
type: command
---

FIRST, list available checkpoints by running this script exactly:

```bash
.claude/scripts/rollback.sh
```

Show the list to the user and ask which checkpoint to roll back to.

After the user chooses, run the rollback script with the tag name:

```bash
.claude/scripts/rollback.sh <chosen-tag>
```

THEN, update `docs/wiki/todos.md`: move any rows that were in the `In Progress` table back to `Pending`.

Append `## [YYYY-MM-DD] rollback | to <tag>` to `docs/wiki/log.md`.
