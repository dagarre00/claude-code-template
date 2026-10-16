---
name: wiki-update
description: How to structure a docs/wiki/ page under the Obsidian LLM-wiki standard — placement and dedup before creating, page templates, facet vocabulary, link ontology, and whether a discovery is fixed inline or queued in wiki-todos.md.
user-invocable: false
---

# Wiki Update — standard, templates, routing

Single source of truth for the wiki schema (rule 18). Ticking an entity's Behavior cases needs nothing from here.

## Placement — before creating any page

1. Write the concept's essence (1–2 standalone sentences).
2. Check for existing pages under another name: walk `docs/wiki/` and `grep -r "aliases:" -A3 docs/wiki/`.
3. **Exists** → merge into that page, add the new name to `aliases`, extend `sources`, bump `updated`.
4. **Does not exist** → create from a template below. Filename = canonical name without `* " \ / < > : | ? # ^ [ ]` (put symbol-bearing variants in `aliases`).
5. **Target of a new link does not exist** → create a `status: stub` page in the same change (or if outside your write scope, omit the link and queue a `wiki-todos.md` item).
6. **Merge** duplicate pages into the more canonical filename (keeping union of links/provenance and old name in `aliases`; ask the human if ambiguous). **Split** multi-concept pages and rewire links.

## Canonical page template

```markdown
---
aliases: [Agentic loop, Sense-Plan-Act]
type: concept             # concept | procedure | reference | tutorial | entity | decision | summary
abstraction: pattern      # principle | pattern | technique | instance
domains: [agents, software]
status: developing        # stub | developing | stable
sources:
  - docs/raw/anthropic-agents.md
implements:
  - "[[feedback-principle]]"
specializes: []
contrasts_with:
  - "[[linear-pipeline]]"
alternative_to: []
depends_on:
  - "[[world-model]]"
contradicts: []
open_questions:
  - How does this relate to hierarchical planning?
created: 2026-07-21
updated: 2026-07-21
---

# Agentic loop (Sense–Plan–Act)

> [!abstract] Essence
> One or two sentences that capture the concept, understandable out of context —
> read first, and the fingerprint used for dedup.

## Model
What it is, why it matters, when it applies.

## Detail
How it works: examples, variants, parameters.

## Boundaries
Edge cases, where it does NOT apply, open tensions and contradictions, *unverified* claims.

## Provenance
- Claim ← source; every non-trivial claim traces to a `docs/raw/` file.
```

`type: concept` pages use the `Essence → Model → Detail → Boundaries → Provenance` spine and the `abstraction` facet (`entity` pages use `abstraction: instance` and the Entity spine below; `decision`, `summary`, and `reference` pages omit `abstraction` and use their own templates). Frontmatter wikilinks are quoted strings (one per list item); body wikilinks are unquoted.

**`[infra]` concept pages** also carry a `## Behavior` section of verifiable operational assertions (`[ ]`/`[~]`/`[x]`); lint must not flag it.

## Entity page template (`docs/wiki/entities/<slug>.md`)

```markdown
---
aliases: []
type: entity
abstraction: instance
domains: [<domain>]
status: developing        # stub | developing | stable
sources: []
depends_on:
  - "[[other-entity]]"
contradicts: []
open_questions: []
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# <Entity Name>

> [!abstract] Essence
> What this entity exists to do, in user-facing terms.

## Behavior

- [ ] B1: <observable behavior, no implementation detail>

(States: `[ ]` not started · `[~]` test written and confirmed failing · `[x]` passing.)

## Implementation

- Files: [src/foo.py](../../../src/foo.py)
- Key functions: `do_thing()`
- Used by: [[consumer-entity]]

## Tests

- Files: [tests/test_foo.py](../../../tests/test_foo.py)
- Mapping: B1 → `test_does_thing`

## Boundaries

- Edge cases, known limitations, open tensions, unverified claims.

## Provenance

- Requirement ← `docs/raw/...`, a decision page, or a requirements section.
```

## Other templates

Supporting files beside this skill (open only when creating or restructuring that page):
- `summary-template.md` — `docs/wiki/summaries/<slug>.md` for an ingested source.
- `design-system-template.md` — `docs/wiki/design-system.md`, **only for projects with a UI surface**.

## Facet vocabulary (closed)

| Property | Allowed values | Use |
|---|---|---|
| `type` | `concept`, `procedure`, `reference`, `tutorial`, `entity`, `decision`, `summary` | Reader need. |
| `abstraction` | `principle`, `pattern`, `technique`, `instance` | Generality rung (required on `concept` and `entity`). |
| `domains` | controlled list (`agents`, `software`, `design`, …) | Application domains. |
| `status` | `stub`, `developing`, `stable` — decisions: `proposed`, `accepted`, `superseded`, `deprecated` | Maturity (`stub` = known gap). |

Ledgers (`log.md`, `todos.md`, `wiki-todos.md`, `gotchas.md`, `commands.md`), root spec pages (`requirements.md`, `architecture.md`, `git-conventions.md`, `design-system.md`), and folder `README.md` guides are `type: reference` navigational pages and are exempt from the orphan rule. Only content pages (`entity`, `concept`, `decision`, `summary`) can be orphans.

## Link ontology — and the gap each relation makes computable

| Relation | Direction | Gap rule |
|---|---|---|
| `implements` | technique/pattern → principle | A `technique` implements ≥1 `principle`. |
| `specializes` | instance/pattern → more general concept | Required on `instance` except `type: entity` and `type: summary`. |
| `contrasts_with` | ↔ comparable alternatives | Symmetric. |
| `alternative_to` | ↔ same function, different approach | Symmetric. |
| `depends_on` | concept → prerequisite | Target must exist (at least as `stub`). |
| `contradicts` | ↔ explicit conflict | Unresolved conflicts escalate to the human. |
| `supersedes` / `superseded_by` | decision ↔ decision | Superseded ADR has `status: superseded` + `superseded_by`. |

Fill schema gaps with `status: stub` and `open_questions`, never invented prose.

## Inline or queued

- **Inline** (in the same change, by write roles): one ADR, one gotcha, the active entity page, a single broken link, or a stub for a new link target.
- **Queued** in `docs/wiki/wiki-todos.md` (directly or via `Follow-ups:`): cross-section orphans, contradictions between pages (set `contradicts` on both; don't resolve), patterns recurring 3+ times (promote to `concepts/`), ambiguous merges/splits, or edits requiring 5+ pages read.
- **Routing:** pitfall → `gotchas.md`; design fork → ADR; repeated pattern → `wiki-todos.md`. `wiki-maintainer` is manual only (`/project:wiki`).
