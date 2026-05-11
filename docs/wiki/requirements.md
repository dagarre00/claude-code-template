---
name: requirements
description: Living spec — what the project must do. Code that disagrees with this file is the bug.
type: wiki-spec
updated: 2026-05-11
status: draft
---

# Requirements

> Living spec. Run `/interview` to fill the gaps below. Update as the project evolves; never let this file go stale relative to the code.

## Vision
*(One paragraph. The problem this project solves and who it serves.)*

`<TBD via /interview>`

## Users
*(Who uses this. Multiple user types if applicable. For each: their goal and their constraints.)*

`<TBD via /interview>`

## User stories
*(Bridge between users and functional requirements. Each story names the user, the capability, and the benefit. Each story should be small enough to map to one or two entity pages and produce sharp Behavior cases.)*

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

`<TBD via /interview>`

## Functional requirements
*(What the system must do. Each item is an observable capability, not an implementation choice. Link to the entity page that owns it.)*

- `<TBD via /interview>` — see [[entities/<slug>]]

## Non-functional requirements
*(Performance, security, observability, compliance, deployment constraints. Specific numbers where possible.)*

- **Performance:** `<TBD>`
- **Security:** `<TBD>`
- **Reliability:** `<TBD>`
- **Observability:** `<TBD>`
- **Compliance / data:** `<TBD>`
- **Deployment target:** `<TBD>`

## Out of scope
*(Explicit non-goals. Things the project will not do, even if asked.)*

- `<TBD>`

## Open questions
*(Things the wiki doesn't answer yet. Resolve via `/interview` or `human-checkpoint`.)*

- `<TBD>`
