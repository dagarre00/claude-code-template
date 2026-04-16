---
name: wiki-log
description: Show the last N entries of the wiki log. Default N=10.
type: command
---

Show the last N entries from `docs/wiki/log.md`. Default: 10. If the user passes an argument, use it.

```bash
grep "^## \[" docs/wiki/log.md | tail -${ARGUMENTS:-10}
```

Format the output as a readable bulleted list grouped by op type (ingest / work / lint / rollback / query-filed).
