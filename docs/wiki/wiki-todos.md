---
name: wiki-todos
description: Cleanup queue for the wiki-maintainer. Other agents append; /wiki-lint processes.
type: wiki-spec
updated: 2026-05-11
status: draft
---

# Wiki Todos

> Queue of cleanup tasks. Agents append a one-line entry whenever they discover something the maintainer should handle later (orphan, missing ADR, repeated concept, broken link). `/wiki-lint` processes this queue and removes resolved lines.

## Format
```
- [ ] <YYYY-MM-DD> <agent>: <one-line action>
```

## Pending

*(Empty.)*
