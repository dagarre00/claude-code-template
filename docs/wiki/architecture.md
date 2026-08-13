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
updated: 2026-08-13
---

# Architecture

> [!abstract] Essence
> Stack, layout, and the constraints every technical choice is measured against — the how-built companion to [[requirements]].

> `/project:init` fills Stack, Prototype constraints, Layout, and Data by **choosing them**, not by asking. The human is never interviewed about this page (behavioral rule 6); they are told what was assumed and may overrule it.

## Prototype constraints

_(The envelope. Every choice on this page is measured against it first — see the `stack-assumption` skill.)_

- **Target:** one modest, always-on consumer machine — low-power CPU (possibly ARM), a few GB of RAM, no GPU, ordinary home network, a single operator.
- **Process model:** one long-lived process unless a slice genuinely needs a second.
- **Not in the critical path:** container orchestration, managed cloud services, message brokers, separate database servers, frontend build pipelines, GPU or large model weights, anything that stops working when a paid key lapses.
- **Networking:** the prototype binds a local port and stops there. Remote access, tunnels, TLS, and hostnames are the operator's concern, not a dependency of the code.
- **Consequence:** a feature that cannot fit this envelope is a `human-checkpoint` (behavioral rule 20), not a quiet exception.

## Stack

_(What was chosen, and in one clause why it fits the envelope.)_

- Language: `<TBD>`
- Framework: `<TBD>`
- Storage: `<TBD>`
- Key libraries: `<TBD>`
- Runtime / how it starts: `<TBD>` — see [[commands#run]]

## Layout

_(Top-level directories and what lives where. Add as the prototype grows.)_

`<TBD>`

## Data

_(Where state lives, and what survives a restart. A product answer as much as a technical one — the human is asked what must persist, never what stores it.)_

`<TBD>`

## External services

_(Third parties and infra dependencies. In this template the honest default is "none" — anything here needs a reason and should appear in the entity's `## Shortcuts` if the prototype leans on it to look finished.)_

`<TBD>`

## Assumed defaults

_(The things a rigorous project would specify and a prototype simply assumes. Each holds until a slice proves it can't — change the line, don't add a section.)_

- **Testing:** none. No suite exists; the evidence is the recorded demonstration on each entity page. Wanting a suite is the signal to run `/project:graduate`.
- **Security:** single trusted operator on a private network. No authentication, no authorization, no threat model. Secrets live in an uncommitted config file and nowhere else.
- **Observability:** log lines to stdout. No metrics, no tracing, no error reporting.
- **Environments:** one. The machine it runs on is dev, staging, and prod.
- **Deployment:** start the process on the box. No CI, no build artefacts, no release process.
- **Scale:** one operator, small data, no concurrency beyond what the runtime gives for free.
- **Reliability:** best effort. A crash is fixed by restarting it; data loss on crash is acceptable unless a slice says otherwise.

If any of these stops being true, it stops being an assumption — write the real answer here and note the change in [[log]].

## Conventions

_(Naming, error handling, logging, config — only what recurs. A prototype earns few of these; don't invent them up front.)_

- Naming: `<TBD>`
- Errors: `<TBD>` — the prototype default is to let them crash loudly rather than swallow them
- Logging: `<TBD>`
- Config: `<TBD>`

## Related

- [[requirements]]
- [[git-conventions]]
- [[commands]]
