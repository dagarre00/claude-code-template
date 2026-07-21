---
aliases: [ADR guide, Decisions guide]
type: reference
domains: [knowledge]
status: stable
sources: []
contradicts: []
open_questions: []
created: 2026-04-15
updated: 2026-07-21
---

# Decisions (ADRs)

> [!abstract] Essence
> Architectural Decision Records — small, dated notes capturing **why** a non-trivial choice was made. They live here because future readers (including future you) will second-guess otherwise.

## When to file

See the `decision-recording` skill (`.claude/skills/decision-recording/SKILL.md`) for triggers and the page template. Short version: file an ADR when picking between reasonable alternatives that will shape future work, or when resolving a `contradicts` pair.

## Naming

`YYYY-MM-DD-<short-kebab-name>.md` — e.g. `2026-05-11-pick-postgres-over-sqlite.md`. The date makes timeline scanning easy; the slug makes search easy.

## Lifecycle

- Status: `proposed` → `accepted` → `superseded` / `deprecated` (the decision-specific `status` vocabulary).
- ADRs are **immutable once accepted**. To change direction, file a new ADR with `supersedes: ["[[decisions/<old-slug>]]"]` and mark the old one `status: superseded` + `superseded_by`. Do not edit the body of an accepted ADR.
- Review reports also live here (`review-YYYY-MM-DD.md`) — `type: reference`, a kind of ADR.
