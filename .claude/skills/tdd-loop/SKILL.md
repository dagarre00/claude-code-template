---
name: tdd-loop
description: Red-green-refactor procedure for this project. Use when implementing any feature or bugfix, before writing any production code. Trigger on "TDD", "red phase", "green phase", "refactor", "failing test", "make test pass", "tdd loop".
type: skill
---

# TDD Loop

Use this every time you implement code on a `feat/*` or `fix/*` branch. Nothing enforces test-first automatically — keeping the discipline is on you.

## Read first

- `docs/wiki/commands.md` — the canonical test command for this project.
- `docs/wiki/architecture.md` — testing strategy (unit vs integration, fixtures, isolation).
- `docs/wiki/gotchas.md` — known test pitfalls.
- The relevant `docs/wiki/entities/<slug>.md` — its `## Behavior` section is the contract.

## Red

You own the whole cycle — write the tests, then implement. There is no separate tester and no handoff JSON.

1. For each Behavior case in scope, write **one** focused test, named after the behavior so it maps back to the case ID.
2. Run the canonical `test command` from `docs/wiki/commands.md`. Confirm the new tests actually fail.
3. Confirm the failure reason matches "missing implementation" — not a typo, import error, or fixture issue. If it's the wrong reason, fix the test and re-run until the failure is genuine.
4. Mark each covered case `[ ]` → `[~]` on the entity page once its test is confirmed failing.

## Green

1. Write the **smallest** code that makes the failing test pass. No future-proofing, no extra helpers, no abstractions for cases the test doesn't cover.
2. Re-run the test command. The previously-failing tests must pass; no previously-passing test may now fail.
3. If you broke another test, you over-reached. Revert, narrow your change, retry.

## Refactor

Only after green. Goal: improve structure without changing behavior.

1. Make one structural change at a time (extract method, rename, collapse duplication).
2. Re-run the test command after each change. Stay green.
3. Stop when the code is "good enough for this entity's current scope." Don't refactor neighboring code.

## When to stop and ask

Use `human-checkpoint` if:

- The test seems to encode wrong behavior. Don't change the test — change the spec first.
- Green requires touching code outside the current entity's scope.
- You hit a design fork (two reasonable implementations) the wiki doesn't pre-decide.

## Wiki update — same change

After green + any refactor:

- Tick the Behavior cases on the entity page from `[~]` to `[x]`. The three states (`[ ]` / `[~]` / `[x]`) and their transitions are defined in the `spec-writing` skill — see its "Behavior case states" section.
- Update the entity page's "Implementation" section with the files now touched.
- If you discovered a project-specific pitfall, follow `gotcha-recording`.
- Follow `wiki-update` for the link/format details.

## Two-strike rule

If your second attempt on the same mechanism fails (broken green, refactor explodes, unsolvable test), stop. Tag the state (`git tag checkpoint-$(date -u +%Y%m%dT%H%M%SZ)`), `git reset --hard` to a known-good commit, then re-spec via `/project:interview` or pause with `human-checkpoint`.

## Anti-patterns

- **Modifying tests to make them pass.** Forbidden. Spec → test → code, in that order.
- **Bulk green.** Don't try to make 5 failing tests pass with one change. One test, one change.
- **Refactor before green.** Doesn't compile? Doesn't run? You're not at refactor yet.
- **Skipping the failure-reason check.** A "failing test" that fails on import is not Red — it's a broken test.
