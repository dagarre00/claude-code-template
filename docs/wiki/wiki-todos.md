---
aliases: [Wiki cleanup queue, Maintainer queue]
type: reference
domains: [knowledge]
status: stable
sources: []
contradicts: []
open_questions: []
created: 2026-05-11
updated: 2026-07-21
---

# Wiki Todos

> [!abstract] Essence
> Queue of cleanup tasks for the wiki-maintainer. Agents append a one-line entry whenever they discover something the maintainer should handle later (orphan, missing ADR, repeated concept, broken link). `/project:wiki-lint` processes this queue and removes resolved lines.

## Format
```
- [ ] <YYYY-MM-DD> <agent>: <one-line action>
```

## Pending

*(Empty.)*
- [ ] 2026-08-27 [wiki] Reconcile the findings-mailbox lifecycle: `.gitignore` says the mailbox is promoted to `docs/wiki/reviews/<date>-<slug>.md` and must never be deleted unpromoted, while behavioral rule 20 and `adversarial-review` step 9 say the record is the commit body and the mailbox is deleted. One of the two is stale.
