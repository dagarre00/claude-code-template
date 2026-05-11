---
name: architecture
description: Stack, patterns, layout, testing strategy. The how-built companion to requirements.md.
type: wiki-spec
updated: 2026-05-11
status: draft
---

# Architecture

> How the project is built. `/init` fills the stack-detection sections; `/interview` fills the rest.

## Stack
*(Languages, frameworks, key libraries, runtime.)*

- Language: `<TBD>`
- Framework: `<TBD>`
- Key libraries: `<TBD>`
- Runtime: `<TBD>`

## Layout
*(Top-level directories and what lives where. Add as the project grows.)*

```
<TBD>
```

## Data
*(Where state lives — DB, files, cache, queues. Persistence requirements.)*

`<TBD>`

## External services
*(Third parties, APIs, infra dependencies.)*

`<TBD>`

## Testing strategy
*(Unit vs integration vs e2e. Test framework. Fixture conventions. Coverage targets.)*

- Test framework: `<TBD>`
- Test command: see [[commands#test]]
- Fixtures: `<TBD>`
- Coverage target: `<TBD>`

## Conventions
*(Naming, error handling, logging, config — patterns enforced project-wide. Promote each to [[concepts/<pattern>]] when a pattern recurs three times.)*

- Naming: `<TBD>`
- Errors: `<TBD>`
- Logging: `<TBD>`
- Config: `<TBD>`

## Deployment
*(How code reaches users. CI, build artefacts, release process.)*

`<TBD>`

## Related
- [[requirements]]
- [[git-conventions]]
- [[commands]]
