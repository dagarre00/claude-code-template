FIRST, list available checkpoints by running this script exactly:

```bash
.claude/scripts/rollback.sh
```

Show the list to the user and ask which checkpoint to roll back to.

After the user chooses, run the rollback script with the tag name:

```bash
.claude/scripts/rollback.sh <chosen-tag>
```

THEN, update `docs/project-state.md`: mark any TODOs that were "In Progress" back to "Pending". The sync-todos hook will auto-sync active-todos.md when you save the file.
