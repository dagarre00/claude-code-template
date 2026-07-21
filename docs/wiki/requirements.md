---
aliases: [Living spec]
type: reference
domains: [software]
status: stub
sources: []
contradicts: []
open_questions: []
created: 2026-04-15
updated: 2026-07-21
---

# Requirements

> [!abstract] Essence
> Living spec — what the project must do. Code that disagrees with this file is the bug.

> Run `/project:interview` to fill the gaps below. Update as the project evolves; never let this file go stale relative to the code.

## Vision

_(One paragraph. The problem this project solves and who it serves.)_

`<TBD via /project:interview>`

## Users

_(Who uses this — the roles the code needs to know about. Auth/permissions/db tables. One row in some `users` table per type.)_

`<TBD via /project:interview>`

## Personas

_(Optional. UX archetypes, not auth roles — keep if your project has multiple kinds of users with different mental models (B2B SaaS, consumer apps); delete this whole section for CLIs, libraries, and internal tools with one audience.)_

**Format:**

```
- **<Persona name>** — <role>, <context>
  - Goal: <what they're trying to do>
  - Constraint: <what limits them>
  - Pain: <current frustration this product addresses>
```

`<TBD via /project:interview>`

## User stories

_(Bridge between users and functional requirements. Each story names the user, the capability, and the benefit. Each story should be small enough to map to one or two entity pages and produce sharp Behavior cases.)_

**Format:**

```
- As a <user type>, I want <capability>, so that <benefit>.
  - Acceptance: <observable check that proves the story is delivered>.
  - Maps to: [[entities/<slug>]]
```

**Example:**

```
- As a returning user, I want to log in with email + password, so that my prior data is restored.
  - Acceptance: valid credentials produce a session cookie and access to /dashboard; invalid credentials produce 401.
  - Maps to: [[entities/auth-login]]
```

**Stories:**

`<TBD via /project:interview>`

## Functional requirements

_(What the system must do. Each item is an observable capability, not an implementation choice. Link to the entity page that owns it.)_

- `<TBD via /project:interview>` — see [[entities/<slug>]]

## Non-functional requirements

_(Performance, security, observability, compliance, deployment constraints. Specific numbers where possible.)_

- **Performance:** `<TBD>`
- **Security:** `<TBD>`
- **Reliability:** `<TBD>`
- **Observability:** `<TBD>`
- **Compliance / data:** `<TBD>`
- **Deployment target:** `<TBD>`

## Success metrics

_(How we know the project worked. Measurable where possible — numbers beat adjectives. Different from acceptance criteria: acceptance proves a story is delivered, metrics prove the project is succeeding.)_

- `<TBD>`

## Out of scope

_(Explicit non-goals. Things the project will not do, even if asked.)_

- `<TBD>`

## Risks

_(Events we can't fully resolve, only mitigate. Different from open questions, which are resolvable by asking. For each: likelihood, impact, mitigation.)_

- `<TBD>`

## Assumptions

_(Things we're treating as given. If any assumption breaks, the spec changes — so worth listing explicitly.)_

- `<TBD>`

## Open questions

_(Things the wiki doesn't answer yet. Resolve via `/project:interview` or `human-checkpoint`.)_

- `<TBD>`
