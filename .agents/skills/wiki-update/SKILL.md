---
name: wiki-update
description: How to structure a docs/wiki/ page under the Obsidian LLM-wiki standard — placement and dedup before creating, the page templates, facet vocabulary and link ontology — and whether a discovery is fixed inline or queued for the maintainer. Trigger on "new entity page", "new concept page", "wiki page structure", "frontmatter", "wikilink property", "aliases", "inline vs maintainer", "wiki-todos queue", "found a pattern", "found a contradiction".
type: skill
---

# Wiki Update — standard, templates, routing

The single source of truth for the wiki standard; its invariants are also the "Obsidian LLM-wiki standard" behavioral rule. Ticking an entity's Behavior cases needs nothing from here.

## Placement — before creating any page

1. Write the concept's essence: one or two sentences that stand alone.
2. Look for it under another name: walk the tree and `grep -r "aliases:" -A3 docs/wiki/`.
3. **It exists** → update that page: merge the new material into the right section, add the new name to `aliases`, extend `sources`, bump `updated`.
4. **It doesn't** → create it from a template below. Filename = the canonical concept name, with none of `* " \ / < > : | ? # ^ [ ]`; symbol-bearing variants go in `aliases`.
5. **Link a page that doesn't exist yet → stub it** in the same change (template frontmatter, `status: stub`, a one-line placeholder) — a broken wikilink fails CI. A stub outside the paths you may edit means no link: record a wiki-todo instead.
6. **Merge** two pages on one concept into the more canonical filename, keeping the union of links and provenance and the discarded name in `aliases` — ask the human first if the contents are ambiguous. **Split** a page covering two concepts and rewire its links.

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

Depth is the body spine (Essence → Model → Detail → Boundaries); the semantic level is the `abstraction` facet — every page has both. Frontmatter wikilinks are quoted and one per list element; body wikilinks are plain.

**`[infra]` concept pages** also carry a `## Behavior` section of verifiable operational assertions, with the same `[ ]`/`[~]`/`[x]` states as an entity. That section is valid there; lint must not flag it.

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

Behavior is the entity's Model; Implementation and Tests are its Detail. Related pages link through the frontmatter relations, which the graph and the gap checks read.

## Other templates

Supporting files beside this skill — open one only when creating or restructuring that page:

- `summary-template.md` — a `docs/wiki/summaries/` page for an ingested source.
- `design-system-template.md` — `docs/wiki/design-system.md`, **only for a project with a UI surface**; never created speculatively.

## Facet vocabulary (closed)

| Property | Allowed values | Use |
|---|---|---|
| `type` | `concept`, `procedure`, `reference`, `tutorial`, `entity`, `decision`, `summary` | What the page's reader needs. |
| `abstraction` | `principle`, `pattern`, `technique`, `instance` | The rung on the generality ladder. |
| `domains` | a controlled list (`agents`, `software`, `design`, …) | Application domains; several allowed. |
| `status` | `stub`, `developing`, `stable` — decisions: `proposed`, `accepted`, `superseded`, `deprecated` | Maturity; `stub` is a known gap. |

The ledgers (`log.md`, `todos.md`, `wiki-todos.md`, `gotchas.md`, `commands.md`) are `type: reference` with their own body formats — the frontmatter rules still apply. They, the root spec pages (`requirements.md`, `architecture.md`, `git-conventions.md`, `design-system.md`) and the folder `README.md` guides are **navigational**: reached through the tree, not the graph, so they are exempt from the orphan rule. Only content pages (entities, concepts, decisions, summaries) can be orphans.

## Link ontology — and the gap each relation makes computable

| Relation | Direction | Gap rule |
|---|---|---|
| `implements` | technique/pattern → principle | A `technique` implements ≥1 `principle`. |
| `specializes` | instance/pattern → a more general concept | An `instance` without it is usually misclassified. |
| `contrasts_with` | ↔ comparable alternatives | Symmetric. |
| `alternative_to` | ↔ same function, different approach | Symmetric. |
| `depends_on` | concept → prerequisite | The prerequisite exists as a page (else a `stub`). |
| `contradicts` | ↔ explicit conflict | Any unresolved one goes to the human. |
| `supersedes` / `superseded_by` | decision ↔ decision | A superseded ADR carries `status: superseded` and a `superseded_by` link. |

A gap is a hole in the graph relative to this schema, never "what feels missing" — fill it with `status: stub` and `open_questions` or a question, never invented prose.

## Inline or queued

Whoever changes code makes the **small, in-scope** wiki edits in the same change. Review roles make none — they report. The wiki-maintainer is manual only and takes the large or cross-page work.

- **Inline:** one ADR, one gotcha, the entity page you are working on, a single broken link you noticed, a stub for a missing link target.
- **Queued** as a `docs/wiki/wiki-todos.md` line (appended if that file is yours, otherwise under `Follow-ups:`): orphans across many sections; a contradiction between two pages (set `contradicts` on both, don't resolve it); a pattern recurring 3+ times (promote to `concepts/`); an ambiguous merge or a split that rewires many links; mass cross-link cleanup or legacy migration; anything needing 5+ pages read to do safely.

Discoveries route as: project pitfall → `gotchas.md`; design fork → ADR; repeated pattern → wiki-todo. The wiki-maintainer is never dispatched by another agent.
