---
name: project-fresh
description: Resume from a saved checkpoint in a new session. Use instead of /compact when context feels heavy.
type: command
---

This is a fresh session resuming from a previous checkpoint.

FIRST, check if a session checkpoint exists:

```bash
cat docs/wiki/session-checkpoint.md 2>/dev/null || echo "No checkpoint found"
```

If it exists, read it and summarize: what was done, what's in progress, what's next.

Then read:
- `docs/wiki/todos.md` — the current TODO queue
- The last 5 entries of `docs/wiki/log.md` via: `grep "^## \[" docs/wiki/log.md | tail -5`

Continue where the previous session left off.
