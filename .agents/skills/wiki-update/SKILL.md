---
name: wiki-update
description: How to structure a wiki page under the Obsidian LLM-wiki standard — placement/dedup before creating, canonical templates, facet vocabulary, link ontology — and how to route discoveries (gotchas / ADRs / cross-page cleanup). Use when creating or restructuring any docs/wiki/ page, or deciding whether a discovery belongs inline or in the maintainer queue. Trigger on "new entity page", "new concept page", "wiki page structure", "frontmatter", "wikilink property", "aliases", "inline vs maintainer", "wiki-todos queue", "found a pattern", "found a contradiction".
type: skill
---

# Wiki Update — Standard, Templates, Routing

The wiki follows the **Obsidian LLM-wiki standard**. This skill is the **single source of truth** for that standard; the non-negotiable invariants are also restated as their own behavioral rule ("Obsidian LLM-wiki standard — hard rules"). Routine ticks on an entity page's Behavior cases are not structure and need nothing from here. This skill covers: **placement**, the **templates**, the **facet/ontology tables**, and **inline-vs-maintainer routing**.

## Placement — before creating any page

1. Derive the concept's essence (one or two sentences that stand alone).
2. Compare it against existing pages: walk the tree and `grep -r "aliases:" -A3 docs/wiki/` for matching names. Ask: "does this concept already exist under another name?"
3. **Exists** → update that page: merge the new information into the section where it belongs, add any new name to its `aliases`, extend `sources`, bump `updated`.
4. **Doesn't exist** → create it from the template below. Filename = canonical concept name, no illegal characters (`* " \ / < > : | ? # ^ [ ]`); symbol-bearing variants go in `aliases`.
5. If you link a page that doesn't exist yet, **stub it** (template frontmatter with `status: stub` + one-line placeholder) in the same change. Broken `[[wikilinks]]` are the #1 lint item — and a lint failure in CI. If the stub would sit outside the paths you may edit, don't add the link: record it as a wiki-todo instead.
6. **Merge** (two pages, one concept): fuse into the more canonical filename, preserving the **union** of links and provenance; add the discarded name to `aliases`; leave a note of what was merged. **Ask the human first if the contents are ambiguous.** **Split** (one page, two concepts): make two pages and rewire the links.

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
> One or two sentences that capture the concept. It's the first thing read **and**
> the semantic fingerprint used for dedup. Must be understandable out of context.

## Model
What it is, why it matters, when it applies. The mental model, not the mechanics.

## Detail
How it works, examples, variants, parameters. Depth lives here.

## Boundaries
Edge cases, when it does NOT apply, unresolved tensions, open contradictions,
*unverified* claims.

## Provenance
- Claim / datum ← source. Every non-trivial claim traces to a `docs/raw/` file.
- E.g.: "The loop re-evaluates after each action" ← `docs/raw/react-paper.md`.
```

The two axes coexist: *depth* (progressive disclosure) is the body sections (Essence → Model → Detail → Boundaries); the *semantic level* is the `abstraction` facet. They're independent — the same page has both. In frontmatter, wikilinks are quoted and solitary (one `"[[page]]"` per list element); in the body they're plain `[[wikilinks]]`.

**`[infra]` extension:** a concept page backing an `[infra]` todo (picked up at the start of a development cycle) additionally carries a `## Behavior` section of verifiable operational assertions, with the same `[ ]`/`[~]`/`[x]` states as an entity page. That section is valid there — the lint pass must not flag it as off-template.

## Entity page template (`docs/wiki/entities/<slug>.md`) — project extension

Entities are this project's spec pages; they keep the Behavior/TDD machinery, mapped onto the disclosure spine:

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
> One or two sentences: what this entity exists to do, in user-facing terms.

## Behavior

- [ ] B1: <observable behavior, no implementation detail>
- [ ] B2: ...

(States: `[ ]` not started · `[~]` test written and confirmed failing · `[x]` passing.)

## Implementation

- Files: [src/foo.py](../../../src/foo.py)
- Key functions: `do_thing()`, `parse_x()`
- Used by: [[consumer-entity]]

## Tests

- Files: [tests/test_foo.py](../../../tests/test_foo.py)
- Mapping: B1 → `test_does_thing`, B2 → `test_parses_x`

## Boundaries

- Edge cases, known limitations, unresolved tensions, unverified claims.

## Provenance

- Requirement / claim ← `docs/raw/...` (or [[decision-slug]] / requirements section).
```

Behavior plays the role of Model (the spec is the mental model); Implementation + Tests are the Detail. Related concepts/decisions link via the frontmatter relations (`depends_on`, `implements`, …) — that's what the graph and the gap queries read.

## Design-system page

**Only for projects with a UI surface** (web, mobile, desktop, TUI) — never created speculatively. Its template is the supporting file `design-system-template.md` beside this skill; open it only when creating or restructuring that page.

## Facet vocabulary (closed)

| Property | Allowed values | Use |
|---|---|---|
| `type` | `concept`, `procedure`, `reference`, `tutorial`, `entity`, `decision`, `summary` | Page role (what its reader needs). `entity`/`decision`/`summary` are project roles. |
| `abstraction` | `principle`, `pattern`, `technique`, `instance` | Rung on the generality ladder. |
| `domains` | free but controlled list (`agents`, `software`, `design`, …) | Application domains; a page can have several. |
| `status` | `stub`, `developing`, `stable` — decisions instead: `proposed`, `accepted`, `superseded`, `deprecated` | Maturity. `stub` = known gap pending compilation. |

Operational ledgers (`log.md`, `todos.md`, `wiki-todos.md`, `gotchas.md`, `commands.md`) are `type: reference` and keep their own body formats — the disclosure spine doesn't apply to them, but the frontmatter hard rules do.

**Navigational pages are exempt from the orphan rule.** The operational ledgers above, the root spec pages (`requirements.md`, `architecture.md`, `git-conventions.md`, and `design-system.md` where present), and the folder guides (`entities/README.md`, `concepts/README.md`, `decisions/README.md`, `summaries/README.md`) are reached through the directory tree and the agent workflow, not through the graph. They are expected to have zero inbound wikilinks. Never flag them as orphans and never delete them to satisfy the rule — the orphan check applies to **content** pages only (entities, concepts, decisions, summaries).

## Link ontology (fixed) — and the gap each type makes computable

| Relation | Semantic direction | Expected link (gap rule) |
|---|---|---|
| `implements` | technique/pattern → principle | Every `technique` should implement ≥1 `principle`. If not, it's a gap. |
| `specializes` | instance/pattern → more general concept | An `instance` without `specializes` is usually misclassified. |
| `contrasts_with` | ↔ comparable alternatives | Symmetric pairs: if A `contrasts_with` B, B should contrast with A. |
| `alternative_to` | ↔ same function, different approach | Symmetric, as above. |
| `depends_on` | concept → prerequisite | Prerequisites must exist as pages (else suggest a `stub`). |
| `contradicts` | ↔ explicit conflict | **Reconciliation flag.** Any unresolved `contradicts` goes to the decision queue. |
| `supersedes` / `superseded_by` | decision ↔ decision | Project extension: a superseded ADR must carry `status: superseded` and a `superseded_by` link. |

A gap is a hole in the graph relative to this schema — computable by the periodic wiki health pass as a Bases/Dataview query — never "what feels missing". Don't fill gaps with invented prose: `status: stub` + `open_questions`, or ask the human.

## Inline vs maintainer routing

Whoever changes code owns **small, in-scope** wiki edits and makes them in the same change as the code. Review roles do not: they are findings-only, and whoever dispatched them files what they raise. The wiki-maintainer is **manual only** and handles large or cross-page work.

**Inline** (same change, no dispatch): a single ADR in `docs/wiki/decisions/`; a single entry in `docs/wiki/gotchas.md`; an edit to the entity page you're working on; fixing a single broken `[[link]]` you happened to notice; stubbing a missing link target.

**Defer to maintainer** (a line for `docs/wiki/wiki-todos.md` — appended by you if that file is yours to edit, otherwise handed back under `Follow-ups:`):

- Orphan pages across many sections.
- Contradictions between two existing pages — set `contradicts` on both, flag, don't auto-resolve.
- A pattern recurring 3+ times — promote to `concepts/`.
- Merging two pages when content is ambiguous, or any split that rewires many links.
- Mass cross-link cleanup, migration of legacy pages to this standard.
- Any change that needs reading 5+ pages to do safely.

**Discovery quick routing**: project pitfall → `gotchas.md` entry. Design fork → ADR. Repeated pattern → wiki-todos line. **Never** dispatch the wiki-maintainer from another agent.
