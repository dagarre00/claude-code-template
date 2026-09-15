# Design-system page template (`docs/wiki/design-system.md`)

**Only for projects with a UI surface.** The project-init command creates this page when it detects one (web, mobile, desktop, TUI); a library, CLI, or service project never gets it. Do not create it speculatively — an empty design system on a backend project is the noise progressive disclosure exists to prevent.

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

Like `requirements.md` and `architecture.md`, this page keeps its own body format — the Essence → Model → Detail → Boundaries spine does not apply, but the frontmatter hard rules do. Route the neighbouring frontend material to its existing home rather than restating it here: stack and styling approach → `architecture.md § Stack` and `architecture.md § Conventions`; a11y level, browser matrix, and perf budgets → `requirements.md § Non-functional requirements`; per-component specs → `entities/`; an interaction pattern recurring 3+ times → `concepts/`; "why this palette / framework" → `decisions/`.
