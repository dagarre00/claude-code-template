---
name: project-tdd-check
description: Audit TDD coverage — list every entity page whose `## Behavior` cases lack matching test files. Run before /project:review and after large work batches.
type: command
---

Audit TDD coverage across the project. Produce a report of entities whose `## Behavior` test contract is not yet realized in test files.

## Procedure

1. List every `docs/wiki/entities/*.md` (skip `README.md`).
2. For each entity, parse the `## Behavior` section and count Given/When/Then bullets, Error bullets, and Edge bullets.
3. Search the repo for matching test files (`<slug>.test.*`, `<slug>.spec.*`, `test_<slug>.*`, `<slug>_test.*`, or any test file referencing the slug).
4. For each entity, classify:
   - **Missing** — no test file at all.
   - **Stub** — test file exists but `it/test/describe` count is below the behavior bullet count.
   - **Covered** — at least one test per behavior bullet.

## Output

```
## TDD Coverage Report

### Missing (no tests)
- entities/<slug>.md — N behavior cases, 0 tests

### Stub (under-tested)
- entities/<slug>.md — N behavior cases, M tests

### Covered
- entities/<slug>.md — N behavior cases, M tests ✓
```

## Rules

- Do NOT generate tests in this command — only audit. Use `/project:work` to actually write tests.
- If the entity is `status: shipped` but lands in **Missing**, flag it as a Critical drift item — code shipped without spec-driven tests.
- Append `## [YYYY-MM-DD] tdd-check | <missing>/<stub>/<covered>` to `docs/wiki/log.md`.
