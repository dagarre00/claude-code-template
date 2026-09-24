---
name: tdd-loop
description: Red-green-refactor procedure for this project. Use when implementing any feature or bugfix, before writing any production code. Trigger on "TDD", "red phase", "green phase", "refactor", "failing test", "make test pass", "tdd loop".
type: skill
---

# TDD Loop

## Read first

- `docs/wiki/commands.md` — the test command, and the architecture check if the project has one.
- `docs/wiki/architecture.md` — `## Testing strategy`, and `## Layers` for where new code goes.
- `docs/wiki/gotchas.md` — known test pitfalls.
- The entity page — its `## Behavior` section is the contract.

## One case at a time

Run Red → Green → Refactor → Finish for **one** Behavior case, then start the next. Five tests then five implementations is a change that cannot be bisected, reverted per case, or reviewed without manufacturing findings.

Case states on the entity page: `[ ]` not started · `[~]` test written and confirmed failing · `[x]` passing.

## Red

1. Write **one** focused test for the case, named after the behavior so it maps back to the case ID (`B3` in the name or its description).
2. Run the test command. Confirm the new test fails.
3. Confirm it fails for the **right reason**: the behavior is missing — an assertion, or the not-yet-written function or module the case introduces. Not a typo, a fixture error, or an import of something that should already exist. Wrong reason → fix the test and re-run.
4. Mark the case `[ ]` → `[~]`.
5. Quote the failing assertion in your report, not a pass/fail count. "12 tests, 1 failed" is not Red evidence.

The conductor re-proves the case after you finish: your tests must pass with your changes in place, and fail once every non-test file you changed is reverted to the base commit. A test that passes against the unchanged code, or fails with your implementation, is rejected no matter what the report says — so keep every test file, fixture and test helper inside your test paths.

## Green

1. Write the **smallest** code that makes the test pass. No future-proofing, no helpers or abstractions the test does not force.
2. Place it in the layer `architecture.md § Layers` assigns, and depend only in the allowed direction.
3. Re-run the test command (and the architecture check, if the project has one). The new test passes; nothing else breaks.
4. Broke another test → you over-reached. Narrow the change and retry.

## Refactor

Only while green. One structural change at a time, re-running the tests after each. Stop at "good enough for this entity's current scope"; never refactor neighbours.

## Finish

1. Tick the case `[~]` → `[x]` and update the entity page's `## Implementation` and `## Tests` sections.
2. Leave everything as plain files — you run no git. The conductor stages exactly the paths you report and commits them as one case.
3. Report, for this case: **test paths**, **implementation paths**, any wiki paths, the Red assertion, and the final suite result. Call out a refactor separately so it can be committed separately.

Then start the next case at Red.

## Stop and report instead of guessing

- The test seems to encode wrong behavior. Never change the test to fit — report that the spec needs changing.
- Green needs code outside the current entity's scope, or a dependency the architecture forbids.
- A design fork the wiki doesn't pre-decide.
- A second attempt on the same mechanism has failed (broken green, refactor explodes, unsolvable test). Stop; describe both attempts and what each ran into. Recovery — a checkpoint, a reset, a re-spec — is the conductor's and the human's call.

## Anti-patterns

- **Modifying tests to make them pass.** Spec → test → code, in that order.
- **Bulk green.** One test, one change.
- **Refactor before green.**
- **Skipping the failure-reason check.** A test that fails on a broken import is not Red.
