---
name: wiki-update
description: How to structure a wiki page under the Obsidian LLM-wiki standard — placement/dedup before creating, canonical templates, facet vocabulary, link ontology — and how to route discoveries (gotchas / ADRs / cross-page cleanup). Use when creating or restructuring any docs/wiki/ page, or deciding whether a discovery belongs inline or in the maintainer queue. Trigger on "new entity page", "new concept page", "wiki page structure", "frontmatter", "wikilink property", "aliases", "inline vs maintainer", "wiki-todos queue", "found a pattern", "found a contradiction".
type: skill
---

# Wiki Update — Standard, Templates, Routing

The wiki follows the **Obsidian LLM-wiki standard**. This skill is the **single source of truth** for that standard; the non-negotiable invariants are also stated as behavioral rule 18. Routine ticks (`[ ]` → `[~]` → `[x]`, checking off a todo, appending a log line) are documented in `tdd-loop`. This skill covers: **placement**, the **templates**, the **facet/ontology tables**, and **inline-vs-maintainer routing**.

## Placement — before creating any page

1. Derive the concept's essence (one or two sentences that stand alone).
2. Compare it against existing pages: walk the tree and `grep -r "aliases:" -A3 docs/wiki/` for matching names. Ask: "does this concept already exist under another name?"
3. **Exists** → update that page: merge the new information into the section where it belongs, add any new name to its `aliases`, extend `sources`, bump `updated`.
4. **Doesn't exist** → create it from the template below. Filename = canonical concept name, no illegal characters (`* " \ / < > : | ? # ^ [ ]`); symbol-bearing variants go in `aliases`.
5. If you link a page that doesn't exist yet, **stub it** (template frontmatter with `status: stub` + one-line placeholder) before committing. Broken `[[wikilinks]]` are the #1 lint item.
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

(States `[ ]` / `[~]` / `[x]` defined in `spec-writing` skill → "Behavior case states".)

## Implementation

- Files: [src/foo.py](../../src/foo.py)
- Key functions: `do_thing()`, `parse_x()`
- Used by: [[consumer-entity]]

## Tests

- Files: [tests/test_foo.py](../../tests/test_foo.py)
- Mapping: B1 → `test_does_thing`, B2 → `test_parses_x`

## Boundaries

- Edge cases, known limitations, unresolved tensions, unverified claims.

## Provenance

- Requirement / claim ← `docs/raw/...` (or [[decision-slug]] / requirements section).
```

Behavior plays the role of Model (the spec is the mental model); Implementation + Tests are the Detail. Related concepts/decisions link via the frontmatter relations (`depends_on`, `implements`, …) — that's what the graph and the gap queries read.

## Design-system page template (`docs/wiki/design-system.md`) — project extension, conditional

**Only for projects with a UI surface.** `/project:init` creates this page when it detects one (web, mobile, desktop, TUI); a library, CLI, or service project never gets it. Do not create it speculatively — an empty design system on a backend project is the noise progressive disclosure exists to prevent.

**The page asserts; the code holds the values.** Literal hex/px/ms live in the project's token file — this page owns the *role names*, the *step counts*, and the *checkable constraints* every UI commit must satisfy. That split is deliberate: token tables hand-maintained in markdown rot within weeks, but "`text` on `bg` is ≥ 7:1" and "there are exactly seven type steps" are assertions a test can verify against the code. Write constraints, not copies.

```markdown
---
aliases: [Design system, Frontend specs, Style guide, Design tokens]
type: reference
domains: [design, software]
status: stub
sources: []
depends_on:
  - "[[requirements]]"
  - "[[architecture]]"
contradicts: []
open_questions: []
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# Design System

> [!abstract] Essence
> The visual and interaction contract for this project's UI — intention, token roles, and the
> constraints every UI commit must satisfy. Values live in code; this page says what must be
> true of them.

## Design intention

_(Three to five sentences. The section that settles subjective calls without a human — so the
anti-goals matter more than the goals.)_

- **Feels like:** `<three adjectives>`
- **Never:** `<explicit anti-goals — "not playful", "not enterprise-grey">`
- **Reference points:** `<products whose feel we're aiming at>`

## Token binding

_(Where the literal values live. Every row names a real file, or this page is decorative.)_

| Token group       | Code location |
| ----------------- | ------------- |
| Color             | `<TBD>`       |
| Typography        | `<TBD>`       |
| Spacing           | `<TBD>`       |
| Shape / elevation | `<TBD>`       |
| Motion            | `<TBD>`       |

**Rule:** a UI commit that hard-codes a raw value instead of referencing a token is the bug.

## Color

_(Semantic roles, not colour names. `blue-500` is a value; `accent` is a role. Code references
roles only.)_

| Role                    | Used for                             |
| ----------------------- | ------------------------------------ |
| `bg`                    | page ground                          |
| `surface`               | cards, panels, raised areas          |
| `text`                  | primary copy                         |
| `text-muted`            | secondary copy, captions             |
| `border`                | dividers, input outlines             |
| `accent`                | primary action, focus ring           |
| `accent-fg`             | text on `accent`                     |
| `success` `warn` `danger` `info` | state feedback              |

**Contrast assertions** — measured, never assumed:

| Pair                   | Required           | Measured |
| ---------------------- | ------------------ | -------- |
| `text` on `bg`         | ≥ `<4.5:1 \| 7:1>` | `<TBD>`  |
| `text-muted` on `bg`   | ≥ 4.5:1            | `<TBD>`  |
| `accent-fg` on `accent`| ≥ 4.5:1            | `<TBD>`  |
| `border` on `bg`       | ≥ 3:1              | `<TBD>`  |

Themes supported: `<light | dark | both>`. Every role resolves in every theme.

## Typography

- **Families:** `<TBD>` (+ fallback stack, + loading strategy)
- **Scale:** `<N>` steps. Nothing outside the scale.

| Step    | Size / line-height | Weight  | Tracking | Role                          |
| ------- | ------------------ | ------- | -------- | ----------------------------- |
| `<TBD>` | `<TBD>`            | `<TBD>` | `<TBD>`  | page title / heading / body / caption / code |

## Spacing & layout

- **Base unit:** `<TBD>` — every spacing value is a multiple of it
- **Scale:** `<TBD>`
- **Container widths:** `<TBD>`
- **Breakpoints:** `<TBD>` (name → min-width, and what changes at each)

## Shape & elevation

- **Radii:** `<TBD>` (named steps; which component uses which)
- **Border widths:** `<TBD>`
- **Elevation:** `<TBD>` (steps and their meaning — resting, hover, overlay, modal)

## Motion

- **Durations:** `<TBD>` (named steps)
- **Easing:** `<TBD>` (curve per intent — enter, exit, move)
- **Animates:** `<TBD>`
- **Never animates:** `<TBD>`
- **`prefers-reduced-motion`:** `<TBD>` — a stated behavior, not an omission

## Iconography & imagery

- **Icon set:** `<TBD>` (source, licence)
- **Stroke weight / sizes:** `<TBD>`
- **Imagery:** `<TBD>` (aspect ratios, treatment, placeholder behavior)

## Component inventory

_(Manifest, not specs — Behavior cases live on each component's entity page. A component absent
from this table does not exist yet; spec it as an entity before building it.)_

| Component | Entity page          | Status                    |
| --------- | -------------------- | ------------------------- |
| `<TBD>`   | `[[entities/<slug>]]`| stub / developing / stable |

## State & feedback patterns

_(Where UI inconsistency actually starts — one screen invents a spinner, the next a skeleton.)_

- **Loading:** `<TBD>`
- **Empty:** `<TBD>` (copy, illustration, primary action)
- **Error:** `<TBD>` (inline vs toast vs page; retry affordance)
- **Success:** `<TBD>`
- **Disabled:** `<TBD>` (and when an explained error must be used instead)

## Accessibility contract

_(Targets live in [[requirements#Non-functional requirements]]; this is what follows from them
at the UI level.)_

- **WCAG target:** `<TBD>`
- **Focus visible:** `<TBD>` (token, offset — never removed without a replacement)
- **Minimum hit target:** `<TBD>`
- **Keyboard:** `<TBD>` (tab order, escape/enter conventions, focus trapping in overlays)
- **Screen reader:** `<TBD>` (labelling conventions, live-region use)

## Content & voice

- **Capitalization:** `<TBD>` (sentence vs title case, per surface)
- **Tone:** `<TBD>`
- **Button labels:** `<TBD>` (verb-first? "Save" vs "Save changes")
- **Error messages:** `<TBD>` (shape: what happened + what to do about it)
- **Dates / numbers / currency:** `<TBD>` (locale, format)

## Boundaries

- Surfaces this system does NOT cover (marketing site, transactional email, third-party embeds),
  known inconsistencies, unverified claims.

## Provenance

- Token / choice ← `docs/raw/...` or [[decisions/<slug>]].
```

Like `requirements.md` and `architecture.md`, this page keeps its own body format — the Essence → Model → Detail → Boundaries spine does not apply, but the frontmatter hard rules do. Route the neighbouring frontend material to its existing home rather than restating it here: stack and styling approach → `architecture.md § Stack / Conventions`; a11y level, browser matrix, and perf budgets → `requirements.md § Non-functional`; per-component specs → `entities/`; an interaction pattern recurring 3+ times → `concepts/`; "why this palette / framework" → `decisions/`.

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

A gap is a hole in the graph relative to this schema — computable by `/project:wiki-lint` as a Bases/Dataview query — never "what feels missing". Don't fill gaps with invented prose: `status: stub` + `open_questions`, or ask the human.

## Inline vs maintainer routing

You — the `developer` or `reviewer` — own **small, in-scope** wiki edits and make them in the same commit as the code. The wiki-maintainer is **manual only** and handles large or cross-page work.

**Inline** (same commit, no dispatch): single ADR via `decision-recording`; single gotcha via `gotcha-recording`; entity-page edit on the entity you're working on; fixing a single broken `[[link]]` you happened to notice; stubbing a missing link target.

**Defer to maintainer** (append a line to `docs/wiki/wiki-todos.md`):

- Orphan pages across many sections.
- Contradictions between two existing pages — set `contradicts` on both, flag, don't auto-resolve.
- A pattern recurring 3+ times — promote to `concepts/`.
- Merging two pages when content is ambiguous, or any split that rewires many links.
- Mass cross-link cleanup, migration of legacy pages to this standard.
- Any change that needs reading 5+ pages to do safely.

**Discovery quick routing**: project pitfall → `gotcha-recording`. Design fork → `decision-recording`. Repeated pattern → wiki-todos line. **Never** dispatch the wiki-maintainer from another agent.
