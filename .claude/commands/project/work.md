---
name: work
description: Pick the top todo (or batch consecutive todos sharing context), open a feat/* branch, dispatch tester for Red, then implementer for Green + refactor, then update wiki and commit. The core development loop.
type: command
---

# /work

You orchestrate one TDD cycle (or a small batch). You do **not** write tests or production code directly — you dispatch the `tester` and `implementer` agents.

## Preconditions

- Clean working tree on `main`.
- `docs/wiki/todos.md` has at least one item.
- `docs/wiki/commands.md` has a working test command.

If any fails: stop and run `human-checkpoint`.

## Steps

1. **Pick the work.**
   - Read `docs/wiki/todos.md`. Take the top item.
   - If the next 1–3 todos share an entity and context, propose a batch. Confirm with the human via `human-checkpoint` if batching is non-obvious.
   - Identify the matching `docs/wiki/entities/<slug>.md`. If it doesn't exist, **stop** and recommend `/interview` to define the entity first.

2. **Branch.** Follow `feature-branching` skill:
   ```bash
   git checkout main && git pull --ff-only
   git checkout -b feat/<slug>
   ```

3. **Verify Behavior cases exist.** Read the entity page's `## Behavior` section. If any case is `[ ]` and unimplemented, that's the test target. If the section is empty or vague, **stop** — `/interview` or the `spec-writing` skill must define them first.

4. **Dispatch `tester`** with this scope:
   - The entity slug.
   - The branch name.
   - The Behavior case IDs to cover this cycle.
   - The test command from `docs/wiki/commands.md`.

   Tester writes failing tests, confirms Red, writes `.claude/handoff/<slug>.json`.

5. **Verify Red yourself.** Run the test command. Confirm the failing tests in the handoff actually fail and fail for the right reason. If not, send back to `tester` with notes.

6. **Dispatch `implementer`** with the same scope plus the handoff path. The implementer follows `tdd-loop` skill — Green, then refactor, then wiki update.

7. **Verify Green yourself.** Run the test command. Full suite — confirm no regression.

8. **Wiki update check.** The implementer should have updated the entity page. Confirm:
   - Behavior cases ticked.
   - Implementation section reflects current files.
   - TODO moved to `docs/wiki/completed.md`.

9. **Commit.** Follow `feature-branching` skill. Conventional commit, one commit per cycle.

10. **Append to log.** `docs/wiki/log.md`:
    ```markdown
    ## [YYYY-MM-DD HH:MM] work — <slug>
    - TODO(s): <list>
    - Cases: B1, B2
    - Branch: feat/<slug>
    - Commits: <hashes>
    ```

11. **Report to human.** What was done, what's next. Suggest:
    - More todos in the same entity → keep going.
    - Cross-cutting work piling up → `/review` may be due.
    - Risky next change → `/checkpoint` first.

## Failure modes

- **Tester can't confirm Red.** Stop. The Behavior cases or the test environment is wrong. Use `human-checkpoint`.
- **Implementer fails twice on the same mechanism.** Two-strike rule. `/checkpoint` → `/rollback` → re-spec.
- **Test suite has pre-existing failures.** Stop. Don't add work on top of a broken main. Use `human-checkpoint`.
- **Hooks block.** Read the block message and resolve the underlying issue. Never `--no-verify`.

## What you do NOT do

- **No coding directly.** You dispatch `tester` and `implementer`. You can read files and run commands; you don't write tests or production code in this command.
- **No periodic review.** That's `/review`, dispatched separately in a worktree.
- **No PR creation.** That's a separate step the human chooses when ready.
- **No silent batching.** If you batch todos, name the batch in the commit message scope.
