---
name: project-status
description: Show current project state — branch, TODOs, recent log entries, recent checkpoints.
type: command
---

Run this script exactly:

```bash
.claude/scripts/status.sh
```

Present a readable summary that highlights:
- Current branch and uncommitted change count
- How many TODOs are in `Pending` vs `In Progress` vs `Blocked` (from `docs/wiki/todos.md`)
- The last 5 entries from `docs/wiki/log.md`
- The last 3 git checkpoints
- Any pending raw sources awaiting ingest (rows in `docs/raw/index.md` with status `pending`)
