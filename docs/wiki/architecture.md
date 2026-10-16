---
aliases: []
type: reference
domains: [software]
status: stub
sources: []
depends_on:
  - "[[requirements]]"
contradicts: []
open_questions: []
created: 2026-04-08
updated: 2026-10-16
---

# Architecture

> [!abstract] Essence
> Stack, patterns, layout, testing strategy — the how-built companion to [[requirements]].

> `/project:init` fills the stack-detection sections; `/project:interview` fills the rest.

## Stack

_(Languages, frameworks, key libraries, runtime.)_

- Language: `<TBD>`
- Framework: `<TBD>`
- Key libraries: `<TBD>`
- Runtime: `<TBD>`

## Layout

_(Top-level directories and what lives where. Add as the project grows.)_

`<TBD>`

## Layers

_(The module boundaries this project enforces: its **shape**, and the dependency rule each boundary obeys. Every source file belongs to exactly one boundary; a boundary may import only those in its row. `/project:init` picks the shape that fits the project (`clean-architecture § Shapes`), fills the table, records the check that enforces it in [[commands#Architecture]], and allowlists it for the roles in `.claude/settings.json`. Changing the shape or a row is an ADR, never a side effect of making a test pass.)_

- **Shape:** `<TBD>` — `layered` (domain-rich services), `core/shell` (CLIs, parsers, compilers, SDKs), `slices` (feature-heavy apps and frontends) or `flat` (a script or tiny library: no boundaries, no check).

| Boundary | Holds | Lives in | May depend on |
| --- | --- | --- | --- |
| `<TBD>` | `<TBD>` | `<TBD>` | `<TBD>` |

_(For `layered`, the rows are `domain` (entities, rules; no I/O) → nothing; `application` (use cases and the ports they need) → `domain`; `adapters` (controllers, gateways, repositories) → `application`, `domain`; `infrastructure` (framework, database, SDKs, config) → all three. For `core/shell`: `core` (pure logic and the ports it needs) → nothing; `shell` (I/O, CLI or UI entry, adapters) → `core`. For `slices`: one row per feature slice → `shared` and other slices' public API only; `shared` (kernel, UI kit, utilities) → nothing. `flat` leaves the table empty.)_

- **Composition root:** `<TBD>` — the one place concrete adapters are constructed and wired (`layered`, `core/shell`); `none` for `slices` and `flat` unless one exists.
- **Enforced by:** `<TBD>` (the tool, its rule file, and the command — see [[commands#Architecture]]); `none — flat shape` for `flat`. A check that nothing runs is not enforcement.
- **Tests per boundary:** the inner boundaries (`domain` and `application`, or `core`) are unit-tested with fakes of their ports, never with the real database or network; the outer ones get integration tests against the real boundary. Slices test through their public API.
- **Exceptions:** `<TBD>` — each one names its ADR. A project adopting this over existing code lists its baselined violations here, with the todo that retires them.

## Data

_(Where state lives — DB, files, cache, queues. Persistence requirements.)_

`<TBD>`

## External services

_(Third parties, APIs, infra dependencies.)_

`<TBD>`

## Security

_(Threat model and trust boundaries. What we're protecting, who from, and how. If the project has no security surface — offline CLI, throwaway script — say so explicitly rather than leaving `<TBD>`.)_

- **Threat model:** `<TBD>` (who could attack, what they'd want)
- **Trust boundaries:** `<TBD>` (where unvalidated input becomes validated)
- **Authentication / authorization:** `<TBD>`
- **Secrets handling:** `<TBD>` (where they live, how they're loaded, never-committed list)
- **Data classification:** `<TBD>` (public / internal / sensitive / regulated — and how each tier is treated)
- **Dependencies policy:** `<TBD>` (allowed licenses, vuln-scanning, update cadence)

## Testing strategy

_(Unit vs integration vs e2e. Test framework. Fixture conventions. Coverage targets.)_

- Test framework: `<TBD>`
- Test command: see [[commands#Test]]
- Fixtures: `<TBD>`
- Coverage target: `<TBD>`

## Conventions

_(Naming, error handling, logging, config — patterns enforced project-wide. Promote each to a `docs/wiki/concepts/<pattern>.md` page, linked from here, when a pattern recurs three times.)_

- Naming: `<TBD>`
- Errors: `<TBD>`
- Logging: `<TBD>` (format only — see Observability for what we log and where it goes)
- Config: `<TBD>`

## Observability

_(How we see what's happening in production. Logging destinations, metrics, tracing, error reporting. Distinct from the logging **format** in Conventions — this section is about pipeline and tooling.)_

- **Logging pipeline:** `<TBD>` (where logs go, retention, search)
- **Metrics:** `<TBD>` (what we measure, what tool, what thresholds alert)
- **Tracing:** `<TBD>` (distributed tracing tool, sampling rate, span conventions)
- **Error reporting:** `<TBD>` (Sentry / Bugsnag / etc., grouping rules, on-call routing)
- **Dashboards:** `<TBD>` (links to the panes that matter)

## Deployment

_(How code reaches users. CI, build artefacts, release process.)_

`<TBD>`

## Environments

_(Dev / staging / prod parity. Where each runs, how config differs, how code is promoted between them. If single-environment, say so explicitly.)_

- **Dev:** `<TBD>` (local setup, mock services, seed data)
- **Staging:** `<TBD>` (closest to prod possible, used for pre-release verification)
- **Prod:** `<TBD>` (the live system)
- **Config-by-environment:** `<TBD>` (env vars, config files, secret stores per env)
- **Promotion process:** `<TBD>` (how a green build moves dev → staging → prod)
- **Data flow between envs:** `<TBD>` (e.g. prod → staging anonymization, never the reverse)

## Related

- [[requirements]]
- [[git-conventions]]
- [[commands]]
