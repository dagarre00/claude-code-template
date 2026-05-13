---
name: decisions-readme
description: Guide to the decisions directory — when to file an ADR, naming, and lifecycle.
type: wiki-decision
updated: 2026-05-11
status: approved
---

# Decisions (ADRs)

Architectural Decision Records — small, dated notes capturing **why** a non-trivial choice was made. They live here because future readers (including future you) will second-guess otherwise.

## When to file

See the `decision-recording` skill (`.claude/skills/decision-recording.md`) for triggers. Short version: file an ADR when picking between reasonable alternatives that will shape future work.

## Naming

`YYYY-MM-DD-<short-kebab-name>.md` — e.g. `2026-05-11-pick-postgres-over-sqlite.md`. The date makes timeline scanning easy; the slug makes search easy.

## Lifecycle

- Status: `proposed` → `accepted` → `superseded` / `deprecated`.
- ADRs are **immutable once accepted**. To change direction, file a new ADR and mark the old one `superseded`. Do not edit the body of an accepted ADR.
- Review reports also live here (`review-YYYY-MM-DD.md`) — they are a kind of ADR.
