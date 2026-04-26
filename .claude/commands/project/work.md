---
name: project-work
description: Pull the top pending TODO and run spec→red→green→refactor→wiki loop. Reviewer does NOT run here — use /project:review periodically.
type: command
---

Run the **TDD work loop** for the top pending TODO in `docs/wiki/todos.md`.

## Classify first

Read the top 3 Pending `P0`/`P1` rows from `docs/wiki/todos.md` and classify each:

- **Simple** — touches ≤2 files, <50 lines of change, no new dependencies, no ADR-worthy design decision.
- **Complex** — multiple files, new patterns, external dependencies, or ADR-worthy decisions.

Then check for **batch eligibility**: if 2–3 consecutive Simple TODOs share the same entity slug or overlapping files, propose batching them. State your classification (and batch proposal if applicable) before proceeding. **Wait for user confirmation.**

## Shared setup

1. **Pick** — select the TODO(s) to work on (single or batch).
2. **Query** — load `docs/wiki/requirements.md`, `docs/wiki/entities/<slug>.md`, `docs/wiki/architecture.md`, `docs/wiki/gotchas.md` once — shared across all TODOs in the batch. Create entity stubs if missing.
3. **Spec** — for each TODO, verify entity `## Behavior` has concrete Given/When/Then cases. Expand if vague.
4. **Plan** — invoke `superpowers:writing-plans` to produce the implementation plan. Present to user. **Wait for confirmation.**
5. **Branch** — `feat/<slug>` (use the primary slug for batches). Mark all picked TODOs as `In Progress`.

## Simple path (main agent, all phases)

6. **Red** — invoke `superpowers:test-driven-development`. Write all failing tests for all TODOs in the batch at once. Run them, confirm all RED.
7. **Green** — implement all TODOs. Run tests, confirm all GREEN. If tests fail unexpectedly, invoke `superpowers:systematic-debugging`. If one TODO's implementation breaks another's tests, isolate and fix before moving on.
8. **Refactor** — clean up across all touched files. Run tests, confirm still GREEN.
9. **Verify** — invoke `superpowers:verification-before-completion`. Confirm test suite passes with 0 failures before proceeding.
10. **Commit** — one commit per logical unit. Batched TODOs with a single coherent change → one commit. Unrelated changes within a batch → one commit each.
11. **Wiki** — update entity page(s) inline (behavior/interface). Dispatch **wiki-maintainer** for the full update (todos, completed, log) only every **3 simple TODOs completed**. Track the pending count in a comment at the top of `docs/wiki/todos.md`.

## Complex path (multi-agent dispatch)

6. **Red** — dispatch **tester** agent. Tester follows `superpowers:test-driven-development` iron law: each test must fail for the right reason (feature missing, not a typo). Tester writes `.claude/handoff/<slug>.json` on completion:
   ```json
   { "slug": "<slug>", "branch": "<branch>", "test_files": ["<path>", ...], "todo_title": "<title>" }
   ```
   Confirm all tests RED before continuing.
7. **Green** — dispatch **implementer** agent with the slug. It reads `.claude/handoff/<slug>.json` to locate tests. If tests still fail after two attempts, invoke `superpowers:systematic-debugging`. Confirm all tests GREEN.
8. **Refactor** — dispatch **implementer** agent again. Confirm still GREEN. Implementer deletes the handoff file on success.
9. **Verify** — invoke `superpowers:verification-before-completion`. Full test suite must pass with 0 failures.
10. **Update wiki** — dispatch **wiki-maintainer**: update entity page, add ADRs, move TODO to `completed.md`, update `commands.md`, append to `log.md`.
11. **Commit** — `feat(<area>): <desc>` referencing the TODO slug.

## Rules

- Never skip the Red phase. No tests → no implementation.
- Never modify tests to make them pass. Fix code instead.
- If tests disagree with the entity page: update the spec first, regenerate tests, then implement.
- Reviewer does NOT run here. Use `/project:review` every ~5 TODOs.
- Rollback over fix-forward: two failed implementations → `/project:rollback` and retry from step 3.
