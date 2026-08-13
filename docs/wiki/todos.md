---
aliases: [Work queue]
type: reference
domains: [software]
status: stable
sources: []
contradicts: []
open_questions: []
created: 2026-04-15
updated: 2026-08-13
---

# Todos

> [!abstract] Essence
> Priority-ordered work queue. `/project:work` takes the top item. When complete, items are removed — git history is the record of shipped work. Lines tagged `[wiki]` are wiki-cleanup deferrals for `/project:wiki-lint`, not `/project:work`.

## Tags

- `[wiki]` — wiki cleanup; `/project:wiki-lint` processes these, not `/project:work`.
- `[broken]` — filed by `/project:demo` when a slice that was demonstrated no longer reproduces. These go to P0: a prototype whose demo is broken can't be shown to anyone.
- `[debt]` — a declared shortcut someone wants made real. Usually stays queued for the life of the prototype and is exported by `/project:graduate` rather than worked here; promote one only when a shortcut is actively blocking the next slice.
- `[blocked]` — needs something unavailable (a credential, a device, an answer). State the blocker in the line; it is not startable work.

Keep the queue short. A prototype backlog longer than a dozen items usually means the idea has outgrown this template — that's the signal for `/project:graduate`, not for more triage machinery.

## Now (P0 — next)

_(Empty — run `/project:interview` to populate.)_

## Next (P1)

_(Items waiting for capacity. Should map to entity pages.)_

## Later (P2)

_(Nice-to-have. Promote to Next when prioritized.)_

## Backlog

_(Long-tail, plus the `[debt]` lines. Reviewed when you graduate, not before.)_
