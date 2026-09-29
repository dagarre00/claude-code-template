---
aliases: [Concepts guide]
type: reference
domains: [knowledge]
status: stable
sources: []
contradicts: []
open_questions: []
created: 2026-04-15
updated: 2026-09-23
---

# Concepts

> [!abstract] Essence
> Patterns, conventions and domain ideas that recur across the project, written once instead of in three entity pages.

- **When:** a pattern (retry, caching, pagination, validation…) that three or more pages describe in their own words, a domain term several pages need defined, or an approach the team must follow consistently. A one-off explanation stays in its entity page.
- **Template:** the canonical page in the `wiki-update` skill (Essence, Model, Detail, Boundaries, Provenance). Run the placement check first — it may exist under another alias.
- **Filing:** the `wiki-maintainer` promotes recurring text into concepts; other agents may file a `status: stub` inline when a pattern is clear, and the maintainer normalizes it later.
- **`[infra]` concepts** also carry a `## Behavior` section of verifiable operational assertions, worked by `/project:work` like an entity's.
