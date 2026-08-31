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

## One case at a time

You own the whole cycle — write the test, then implement, then commit. There is no separate tester and no handoff JSON.

Run Red → Green → Refactor → Commit for **one** Behavior case, then start the next. Don't batch: five tests then five implementations then one commit produces a diff that can't be bisected, can't be reverted case-by-case, and is too large for the `adversary` to review without manufacturing new findings every round.

## Red

1. For the Behavior case in hand, write **one** focused test, named after the behavior so it maps back to the case ID.
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

## Commit

Close each case before starting the next — this is the cadence `docs/wiki/git-conventions.md` specifies, and you own it, not `/project:work`.

1. Tick the case `[~]` → `[x]` on the entity page (see "Wiki update" below).
2. Stage that case's test, its implementation, and the entity-page edit — explicitly by path, never `git add -A`. If this case also produced a gotcha or an ADR (see *Wiki update* below), stage `docs/wiki/gotchas.md` / `docs/wiki/decisions/<slug>.md` here too — they ride in this commit and never get one of their own.
3. Commit: `feat(<slug>): <behavior in present tense>`, one case per commit.
4. Push (`git push -u origin "$(git branch --show-current)"`). An unpushed commit dies with the container — behavioral rule 19.
5. Refactor commits are separate (`refactor(<slug>): …`). Never commit half-green code.

Then start the next case at Red.

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

If your second attempt on the same mechanism fails (broken green, refactor explodes, unsolvable test), stop. Tag the state (`git tag checkpoint-$(date -u +%Y%m%dT%H%M%SZ)`), then run `human-checkpoint` with both failed attempts and let the human decide. Do **not** `git reset --hard` on your own initiative — it is the one unrecoverable step in this loop, and rule 21 requires `git status --porcelain` to account for every line before any tree-wide destructive git operation: uncommitted changes you did not write are another session's live work, and the checkpoint tag does not protect them. On an approved reset, re-spec via `/project:interview`.

## Anti-patterns

- **Modifying tests to make them pass.** Forbidden. Spec → test → code, in that order.
- **Bulk green.** Don't try to make 5 failing tests pass with one change. One test, one change.
- **Batching commits.** One commit at the end of the cycle instead of one per case. It breaks `git bisect`, makes a single case unrevertable, and inflates the review diff until the `adversary` can't converge on it.
- **Refactor before green.** Doesn't compile? Doesn't run? You're not at refactor yet.
- **Skipping the failure-reason check.** A "failing test" that fails on import is not Red — it's a broken test.
