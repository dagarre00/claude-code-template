---
name: wiki-update
description: How agents update the wiki during work — Obsidian link format, frontmatter, entity-page structure, log entries, wiki-todos queue. Use whenever touching docs/wiki/ during /work, /review, or ingest. Trigger on "update wiki", "entity page", "finished feature", "wiki link", "obsidian", "wiki-todos".
type: skill
---

# Updating the Wiki

The wiki is browsed in Obsidian. Every link inside `docs/wiki/` must be a valid Obsidian wiki-link. Code and wiki edits ship in the same change.

## Inline vs deferred to the wiki-maintainer

You — implementer, tester, reviewer — own **small, in-scope** wiki edits and make them in the same commit as the code. The wiki-maintainer is **manual only** (`/wiki-lint` or explicit human request) and handles large or cross-page cleanup.

**Do inline** (same commit, no dispatch):
- Entity-page Behavior tick (`[ ]` → `[~]` → `[x]`).
- Entity-page Implementation section update (files, functions touched).
- A single new ADR via `decision-recording`.
- A single new gotcha entry via `gotcha-recording`.
- A log entry in `docs/wiki/log.md`.
- Move a TODO from `todos.md` to `completed.md`.
- Fixing a single broken `[[wiki-link]]` you happened to notice.

**Defer to maintainer** (append a one-line entry to `docs/wiki/wiki-todos.md`):
- Orphan pages across many sections.
- Contradictions between two existing pages (don't auto-resolve — flag).
- A pattern that recurs 3+ times and should be promoted to `concepts/`.
- Ingesting a new raw source from `docs/raw/`.
- Mass cross-link cleanup or large index rewrites.
- Any change that needs reading 5+ pages to do safely.

**Never** dispatch the wiki-maintainer from another agent. The queue is the handoff.

## Obsidian link syntax — required inside `docs/wiki/`

| Form | Use |
|------|-----|
| `[[entities/auth]]` | Link to a wiki page |
| `[[gotchas#login-flow]]` | Link to a heading |
| `[[concepts/retry-pattern\|the retry pattern]]` | Aliased link (the `\|` is a pipe) |
| `![[summaries/some-source]]` | Embed another page's content |
| `#tag` (in body) or `tags: [tag1, tag2]` (frontmatter) | Tags |

**External URLs and non-wiki files** (anything under `.claude/`, `src/`, `tests/`, etc.) keep standard markdown:
`[label](relative/or/absolute/path)`.

If you link to a wiki page that doesn't exist yet, **create the stub** with frontmatter (even just a one-line placeholder) before committing. Broken wiki-links are the #1 wiki-maintainer cleanup item.

## Frontmatter — every wiki page

```yaml
---
name: <kebab-case-page-name>
description: <one line for index.md>
type: wiki-entity | wiki-concept | wiki-decision | wiki-summary | wiki-index | wiki-log | wiki-spec
updated: YYYY-MM-DD
status: draft | approved | stale | shipped | deprecated
tags: [optional, list]
sources: [docs/raw/...]   # only for summary pages
---
```

## Entity page structure (`docs/wiki/entities/<slug>.md`)

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
- [ ] B1: <case statement — observable behavior, no implementation detail>
- [ ] B2: ...

(States: `[ ]` not started, `[~]` in-progress / Red, `[x]` shipped / Green)

## Implementation
- Files: [src/foo.py](../../src/foo.py), [src/bar.py](../../src/bar.py)
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

## During `/work`

Touch — in the same commit that touches code:
1. Entity page Behavior checkboxes (`[ ]` → `[~]` → `[x]`).
2. Entity page Implementation section (files, functions).
3. `docs/wiki/todos.md` — move the completed item.
4. `docs/wiki/completed.md` — append with backref to the entity page.

## During a discovery

When you find a project-specific pitfall, design fork, or pattern:
- Pitfall → `gotcha-recording` skill.
- Design choice → `decision-recording` skill.
- Repeated pattern → append to `docs/wiki/wiki-todos.md`: `Promote <pattern> to concepts/`.

## The `wiki-todos.md` queue

For everything the maintainer should clean up later, **don't fix it in your work session unless trivial**. Append one line to `docs/wiki/wiki-todos.md`:

```
- [ ] <YYYY-MM-DD> <agent>: <one-line action>
```

Examples:
- `- [ ] 2026-05-11 implementer: review [[concepts/cache-invalidation]] for staleness`
- `- [ ] 2026-05-11 tester: missing Behavior cases on [[entities/login]]`

## Anti-patterns

- **`[text](page.md)` links inside the wiki.** Use `[[page]]` instead. Obsidian won't render the link.
- **Updating code without updating the entity page.** The `wiki-drift-check` hook will warn at session end.
- **Marking a Behavior case `[x]` without running the matching test.** Verify before asserting.
- **Inventing a wiki link to a page that doesn't exist.** Stub the page first.
