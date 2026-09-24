---
aliases: [Review reports, Audit reports]
type: reference
domains: [knowledge]
status: stable
sources: []
contradicts: []
open_questions: []
created: 2026-09-24
updated: 2026-09-24
---

# Reviews

> [!abstract] Essence
> The dated whole-repository audits `/project:review` saves, verbatim, one per run — a record of what the reviewer found at that commit, not a decision.

- **Naming:** `review-YYYY-MM-DD.md`, `type: reference`, linked from its `review` entry in the log.
- **What happens to the findings:** the command distributes them — Critical, Warnings and recommended todos to `todos.md`, Drift to `wiki-todos.md`, missing ADRs to a todo. The report itself is not edited afterwards.
- **Not decisions:** an ADR lives in [[decisions/README|decisions/]]; a review may recommend one.
