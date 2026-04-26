---
name: code-style
description: Coding style and conventions for this project. Use whenever writing new code, reviewing code, refactoring, or when the user asks about conventions, naming, or style. Trigger on "style", "convention", "naming", "format", "lint".
type: skill
---

# Code Style

The single source of truth for naming, comments, error handling, file organization, and architecture rules is **[`docs/wiki/architecture.md`](../../../docs/wiki/architecture.md)**. Read that file before writing or reviewing code.

## What to check (in order)

1. `docs/wiki/architecture.md` → `## Naming Conventions`, `## Comments`, `## Error Handling`, `## Design Patterns`, `## Testing Strategy`.
2. `docs/wiki/gotchas.md` → known failure points relevant to the area you're editing.
3. The matching `docs/wiki/entities/<slug>.md` → feature-specific design notes.

If `architecture.md` doesn't cover a question (e.g. an emerging pattern), surface the gap so it can be recorded — don't invent a new convention silently. File the convention under `docs/wiki/concepts/<slug>.md` if it's reusable.

## Hard rules (non-negotiable, regardless of language)

- Readable beats clever — code is read 10x more than written.
- Comment WHY, not WHAT.
- No swallowed exceptions.
- Validate at boundaries, trust internal code.
- One responsibility per function; one class per file unless tightly coupled.

Everything else (file naming, casing per language, layering, imports order) lives in `architecture.md` and is project-specific. Defer to it.
