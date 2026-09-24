---
aliases: [ADR guide, Decisions guide]
type: reference
domains: [knowledge]
status: stable
sources: []
contradicts: []
open_questions: []
created: 2026-04-15
updated: 2026-09-23
---

# Decisions (ADRs)

> [!abstract] Essence
> Small, dated records of **why** a non-trivial choice was made, for the future reader who would otherwise second-guess it.

- **When and how:** the `decision-recording` skill — an ADR for a choice between reasonable alternatives that will shape future work, or to resolve a `contradicts` pair.
- **Naming:** `YYYY-MM-DD-<short-kebab-name>.md`, e.g. `2026-05-11-pick-postgres-over-sqlite.md`.
- **Lifecycle:** `proposed` → `accepted` → `superseded` / `deprecated`. An accepted ADR is never edited — a new one `supersedes` it, and the old one gets `status: superseded` and `superseded_by`.
- **Review reports** from `/project:review` also live here as `review-YYYY-MM-DD.md` (`type: reference`).
