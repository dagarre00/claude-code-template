---
aliases: [Living spec]
type: reference
domains: [software]
status: stub
sources: []
contradicts: []
open_questions: []
created: 2026-04-15
updated: 2026-08-13
---

# Requirements

> [!abstract] Essence
> Living spec — what the prototype must do. Code that disagrees with this file is the bug.

> Run `/project:interview` to fill the gaps below. This page covers **product logic only**; the technical layer is assumed and recorded in [[architecture]] (behavioral rule 6).

## Vision

_(One paragraph. The problem this prototype explores and who it serves.)_

`<TBD via /project:interview>`

## What this prototype is testing

_(The single most important section here. A prototype exists to answer a question — "will people actually use this?", "is the parsing tractable?", "is it fast enough on a small box?". Name the question, and name what would make you throw the whole thing away.)_

- **Question:** `<TBD>`
- **Throw it away if:** `<TBD>`

## Users

_(Who operates this. Often one person — say so explicitly if it is; it justifies most of the assumed defaults in [[architecture]].)_

`<TBD via /project:interview>`

## User stories

_(Each story names the user, the capability, and the benefit. Small enough to map to one entity page and produce demonstrable slices.)_

**Format:**

```
- As a <user type>, I want <capability>, so that <benefit>.
  - Demonstrated by: <the observable check that proves it — a command and what you'd see>
  - Maps to: [[entities/<slug>]]
```

**Example:**

```
- As the operator, I want to drop a CSV into the box and have its rows stored, so that I can query them later.
  - Demonstrated by: `curl -F file=@sample.csv localhost:8000/upload` returns a stored count matching the file's row count.
  - Maps to: [[entities/csv-ingest]]
```

**Stories:**

`<TBD via /project:interview>`

## Functional requirements

_(What the system must do. Each item is an observable capability, not an implementation choice. Link to the entity page that owns it.)_

- `<TBD via /project:interview>` — each item links to its entity page, e.g. `[[entities/csv-ingest]]`

## Known gaps and edge cases

_(Filled by the interview's gap sweep — empty input, duplicates, interrupted runs, the second user. Each one is either a slice on an entity page or a declared shortcut. Nothing found here is ever silently dropped.)_

| Case | Decision | Where it lives |
| --- | --- | --- |
| `<TBD>` | slice / declared shortcut / out of scope | `<entity page>` |

## Non-functional requirements

_(A prototype has almost none. Everything unstated defaults to [[architecture#assumed defaults]] — no auth, one environment, stdout logging, best-effort reliability. Fill a line here **only** when the human named an actual number or constraint, because doing so overrides the assumed default and binds the builder.)_

- `<none stated>`

## Out of scope

_(Explicit non-goals. The highest-value section in a prototype — it's what stops the thing growing into a product nobody specified.)_

- `<TBD>`

## Open questions

_(Things the wiki doesn't answer yet. Resolve via `/project:interview` or `human-checkpoint`. These are exported verbatim by `/project:graduate`.)_

- `<TBD>`
