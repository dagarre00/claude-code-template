---
name: git-conventions
description: Branching and commit conventions for this project. Mirrors the feature-branching skill.
type: wiki-spec
updated: 2026-05-11
status: draft
---

# Git Conventions

> Project conventions. Updated when the team adopts a new flow; mirror changes into the [feature-branching skill](../../.claude/skills/feature-branching.md).

## Default branch

`main` — protected. No direct commits.

## Branch naming

`<type>/<short-slug>`, where `<type>` ∈:

- `feat` — new capability
- `fix` — bug fix
- `chore` — tooling, deps, CI, non-functional housekeeping
- `docs` — documentation only
- `refactor` — code restructuring with no behavior change
- `test` — test-only additions
- `perf` — performance work

Slug: kebab-case, ≤ 4 words, matches the entity slug when applicable.

Examples: `feat/auth-login`, `fix/race-on-double-submit`, `chore/upgrade-pytest`.

## Commit format

Conventional commits, present tense:

```
<type>(<scope>): <one-line summary>

<optional body — what and why, not how>

<optional footer — refs to wiki pages, breaking changes>
```

- `type` matches the branch type vocabulary.
- `scope` is the entity slug or affected area.
- Subject ≤ 72 characters, no trailing period.
- Body wraps at 72.

## Cadence

- One commit per green TDD cycle (test + impl + entity-page update).
- Refactor commits are separate from feat commits.
- Don't commit half-green code.
- **Always push after committing** (`git push -u origin <branch>`). An unpushed commit is lost when the execution container recycles — see `.claude/rules/behavioral.md` #19. Read-only commands (those that don't mutate tracked files) are the only exception.

## PRs

- Open from `<type>/<slug>` to `main`.
- Title mirrors the lead commit.
- Description references the entity page and the Behavior cases covered.
- Squash on merge unless preserving the TDD trace adds value.

## Tags

- `checkpoint-<UTC-timestamp>` — tag HEAD with plain git (`git tag checkpoint-$(date -u +%Y%m%dT%H%M%SZ)`) before risky operations, so you can `git reset --hard` back if needed.
- Other tags reserved for releases (format defined later).
