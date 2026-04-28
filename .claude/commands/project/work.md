---
name: project-work
description: Pull the top pending TODO and run spec→red→green→refactor→wiki loop. Reviewer does NOT run here — use /project:review periodically.
type: command
---

Run the **TDD work loop** for the top pending TODO in `docs/wiki/todos.md`.

> **TDD iron law:** no production code without a failing test first. The Red phase is mandatory. The harness blocks code edits without a matching test on `feat/*` and `fix/*` branches via `.claude/hooks/test-first-check.sh`. Don't try to bypass it — write the test.

## Classify first

Read the top 3 Pending `P0`/`P1` rows from `docs/wiki/todos.md` and classify each:

- **Simple** — touches ≤2 files, <50 lines of change, no new dependencies, no ADR-worthy design decision.
- **Complex** — multiple files, new patterns, external dependencies, or ADR-worthy decisions.

Then check for **batch eligibility**: if 2–3 consecutive Simple TODOs share the same entity slug or overlapping files, propose batching them. State your classification (and batch proposal if applicable) before proceeding. **Wait for user confirmation.**

## Shared setup

1. **Pick** — select the TODO(s) to work on (single or batch).
2. **Query** — load `docs/wiki/requirements.md`, `docs/wiki/entities/<slug>.md`, `docs/wiki/architecture.md`, `docs/wiki/gotchas.md` once — shared across all TODOs in the batch. Create entity stubs if missing.
3. **Spec** — for each TODO, verify entity `## Behavior` has concrete Given/When/Then cases. Each bullet must be specific enough to become ≥1 test. Vague bullets block the Red phase — expand them now.
4. **Plan** — invoke `superpowers:writing-plans` to produce the implementation plan. Output must be structured as a Kanban board (Backlog / To Do / In Progress / Done) with one card per task. Present to user. **Wait for confirmation.**
5. **Branch** — `feat/<slug>` (use the primary slug for batches). Mark all picked TODOs as `In Progress`.

## Simple path (main agent, all phases)

6. **Red** — invoke `superpowers:test-driven-development`. Write all failing tests for all TODOs in the batch.
   - **Run tests now.** Confirm every new test FAILS for the right reason (missing feature, not a typo / import error / fixture bug).
   - Print the exact failure count and the test command you ran.
   - If any new test passes before implementation: it isn't testing the new behavior — fix the test or delete it.
7. **Green** — implement the minimum code to make all the failing tests pass. The `test-first-check.sh` hook will block code edits with no matching test — that's by design. If tests fail unexpectedly, invoke `superpowers:systematic-debugging`. Two-strike rule: two failed attempts → stop and report.
   - **Run tests now.** Confirm 0 failures.
8. **Refactor** — clean up across all touched files. **Run tests again.** Confirm still 0 failures.
9. **Verify** — invoke `superpowers:verification-before-completion`. Run the full suite fresh, confirm 0 failures, copy the passing output into the report.
10. **Commit** — one commit per logical unit. Test additions and their implementation may be in the same commit (or split into `test:` then `feat:` — both are acceptable). Never commit if tests are red.
11. **Wiki** — update entity page(s) inline (behavior/interface/code-references). Dispatch **wiki-maintainer** for the full update (todos, completed, log) every **3 simple TODOs completed**. Track the pending count in a comment at the top of `docs/wiki/todos.md`.

## Complex path (multi-agent dispatch)

6. **Red** — dispatch **tester** agent. Tester follows `superpowers:test-driven-development`: each test must fail for the right reason. Tester writes `.claude/handoff/<slug>.json` with `red_confirmed: true`, `red_command`, `red_failure_count`, and the list of test files. **Do not proceed if `red_confirmed` is missing or false** — re-dispatch tester.
7. **Green** — dispatch **implementer** agent with the slug. It re-runs the `red_command` first to verify the failures still reproduce, then implements. If tests still fail after two attempts, invoke `superpowers:systematic-debugging`. Confirm all tests GREEN.
8. **Refactor** — dispatch **implementer** agent again. Confirm still GREEN. Implementer deletes the handoff file on success.
9. **Verify** — invoke `superpowers:verification-before-completion`. Full test suite must pass with 0 failures.
10. **Update wiki** — dispatch **wiki-maintainer**: update entity page (Behavior + Code References), add ADRs, move TODO to `completed.md`, update `commands.md`, append to `log.md`.
11. **Commit** — `feat(<area>): <desc>` referencing the TODO slug.

## Hard rules

- **No code without a failing test.** The hook enforces this; don't try to disable it.
- **Never modify tests to make them pass.** Fix the code instead. If the test is wrong, update the entity page first, regenerate the test, then implement.
- **Tests and entity page disagree → spec wins.** Update spec, regenerate tests, then code.
- **Two-strike pivot.** Two failed implementations → `/project:rollback` and retry from step 3.
- **Reviewer does NOT run here.** Use `/project:review` every ~5 TODOs.
- **Run `/project:tdd-check`** after every batch and before `/project:review` — surfaces entities whose behavior cases lack tests.
