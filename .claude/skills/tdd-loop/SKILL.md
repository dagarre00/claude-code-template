---
name: tdd-loop
description: Subagent-side, preloaded into the developer. Red-green-refactor procedure for implementing one Behavior case at a time before writing any production code.
user-invocable: false
---

# TDD Loop

## Read first

- `docs/wiki/commands.md` — test command and architecture check.
- `docs/wiki/architecture.md` — `## Testing strategy` and `## Layers`.
- `docs/wiki/gotchas.md` — known test pitfalls.
- The entity page (`docs/wiki/entities/<slug>.md` or `[infra]` `concepts/<slug>.md`) — `## Behavior` is the contract.

## One case at a time

Run Red → Green → Refactor → Finish for **one** Behavior case (`[ ]` not started → `[~]` failing test confirmed → `[x]` passing).

## Red

1. Write **one** focused test mapped to the case ID (`B3` in the test name or description).
2. Run the test command and confirm the new test fails.
3. Verify it fails for the **right reason**: missing behavior (assertion failure or not-yet-written target symbol), never a syntax error, broken fixture, or bad import of existing code.
4. Mark the case `[ ]` → `[~]`.
5. Quote the failing assertion line in your report (pass/fail counts alone are rejected).

The conductor re-proves Red after you return by restoring everything except your reported test paths to `HEAD~1` and running the focused test command over them. Keep all new test files, fixtures, and test helpers inside the test paths you report.

## Green

1. Climb `simplicity-ladder` and write the **smallest** code that makes the test pass.
2. Place files in the layer `architecture.md § Layers` assigns, respecting dependency direction.
3. Run the focused test command (`commands.md § Test (focused)`; the full test command while it is `<TBD>`) over the new test and every existing test file covering the code you changed, plus the architecture check, until they pass. Breaking another test means you over-reached: narrow the change and retry. The conductor runs the full suite once when the cycle's case loop closes.

## Refactor

Only while green: one small structural cleanup within the current entity's scope, re-running tests after each change.

## Finish

1. Tick `[~]` → `[x]` and update the entity page's `## Implementation` and `## Tests` sections.
2. Leave all changes uncommitted (you run no git).
3. Report: **test paths**, **implementation paths**, the existing test files you ran beside them, wiki paths, quoted Red assertion, final test output, and a one-line summary of any refactor.

## Stop and report instead of guessing

- The test or spec appears to encode wrong behavior (never alter the test to force a pass).
- Green requires out-of-scope files or a forbidden layer dependency.
- Unresolved design fork not settled by the wiki.
- Second failed attempt on the same mechanism (two-strike rule).

## Anti-patterns

- **Modifying tests to make them pass.**
- **Bulk green** (writing multiple cases before implementation).
- **Refactoring before green.**
- **Treating broken imports/fixtures as Red.**
