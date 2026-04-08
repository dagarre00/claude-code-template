This is a fresh session resuming from a previous checkpoint.

FIRST, check if a session checkpoint exists:

```bash
cat docs/agent-context/session-checkpoint.md 2>/dev/null || echo "No checkpoint found"
```

If it exists, read it and summarize: what was done, what's in progress, what's next.

Read `docs/agent-context/active-todos.md` for the current task list (auto-synced by the sync-todos hook). Continue where the previous session left off.
