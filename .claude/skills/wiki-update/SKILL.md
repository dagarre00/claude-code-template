---
name: wiki-update
description: How to structure a wiki entity page in this project and route discoveries (gotchas / ADRs / cross-page cleanup). Use when creating a new entity page, restructuring one, or deciding whether a discovery belongs inline or in the maintainer queue. Trigger on "new entity page", "entity page structure", "inline vs maintainer", "wiki-todos queue", "found a pattern", "found a contradiction".
type: skill
---

# Wiki Update — Structure and Routing

Routine ticks (`[ ]` → `[~]` → `[x]`, checking off a todo in `todos.md`, appending a log line) are documented in `tdd-loop`. This skill covers the two things _it_ doesn't: the entity-page **template**, and the **inline-vs-maintainer routing** when you discover something.

Pre-loaded context you can rely on: Obsidian link syntax (behavioral rule 18); frontmatter shape (`CLAUDE.md` → Frontmatter convention); `wiki-todos.md` self-documents its line format in its own header.

## Entity page template (`docs/wiki/entities/<slug>.md`)

```markdown
---
name: <slug>
description: <one line>
type: wiki-entity
updated: YYYY-MM-DD
status: draft | shipped
tags: [...]
---

# <Entity Name>

## Purpose

One paragraph: what this entity exists to do, in user-facing terms.

## Behavior

- [ ] B1: <observable behavior, no implementation detail>
- [ ] B2: ...

(States `[ ]` / `[~]` / `[x]` defined in `spec-writing` skill → "Behavior case states".)

## Implementation

- Files: [src/foo.py](../../src/foo.py)
- Key functions: `do_thing()`, `parse_x()`
- Depends on: [[entities/other-thing]]
- Used by: [[entities/consumer]]

## Tests

- Files: [tests/test_foo.py](../../tests/test_foo.py)
- Mapping: B1 → `test_does_thing`, B2 → `test_parses_x`

## Notes

- Anything important an LLM should know on revisit.

## Related

- [[concepts/relevant-pattern]]
- [[decisions/2026-04-01-some-choice]]
```

If you link to a wiki page that doesn't exist yet, **stub it** (frontmatter + one-line placeholder) before committing. Broken `[[wiki-link]]`s are the #1 maintainer cleanup item.

## Inline vs maintainer routing

You — the `developer` or `reviewer` — own **small, in-scope** wiki edits and make them in the same commit as the code. The wiki-maintainer is **manual only** and handles large or cross-page work.

**Inline** (same commit, no dispatch): single ADR via `decision-recording`; single gotcha via `gotcha-recording`; entity-page edit on the entity you're working on; fixing a single broken `[[link]]` you happened to notice.

**Defer to maintainer** (append a line to `docs/wiki/wiki-todos.md`):

- Orphan pages across many sections.
- Contradictions between two existing pages (flag, don't auto-resolve).
- A pattern recurring 3+ times — promote to `concepts/`.
- Mass cross-link cleanup or large index rewrites.
- Any change that needs reading 5+ pages to do safely.

**Discovery quick routing**: project pitfall → `gotcha-recording`. Design fork → `decision-recording`. Repeated pattern → wiki-todos line. **Never** dispatch the wiki-maintainer from another agent.
