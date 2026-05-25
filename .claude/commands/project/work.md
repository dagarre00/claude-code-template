---
name: work
description: Pick the top todo (or batch consecutive todos sharing context), open a feat/* branch, optionally dispatch the planner, then tester for Red, then implementer for Green + refactor, then update wiki and commit. The core development loop.
type: command
---

# /project:work

You orchestrate one TDD cycle (or a small batch). You do **not** write tests or production code directly — you dispatch the `planner` (when needed), `tester`, and `implementer` agents.

## Preconditions

**Starting fresh (on `main`):**

- Clean working tree.
- `docs/wiki/todos.md` has at least one item.
- `docs/wiki/commands.md` has a working test command.

If any precondition fails: stop and run `human-checkpoint`.

## Steps

0. **Scan for existing handoffs — always run this first, before picking any new work.**

   ```bash
   ls .claude/handoff/*.json 2>/dev/null
   ```

   **No files found** → skip to step 1.

   **Files found** → for each handoff file, read it and determine which case applies:

   ***

   **Case A — Current branch IS the handoff branch** (session restarted mid-cycle):

   a. Read the handoff. If `red_confirmed` is not `true`, run `human-checkpoint` — the tester did not confirm Red before the session ended.
   b. Run the test command from the handoff.
   - **All tests fail** → Red is intact; implementer did not start. Skip to step 8.
   - **All tests pass** → implementer finished before the session ended. Skip to step 9 (verify green).
   - **Mixed results** → implementer was mid-flight. Skip to step 8; it will pick up where it left off.
     c. **Plan recovery.** If this cycle was planned — the todo is tagged `[complex]` or it batches 2+ todos (same criteria as step 4) — the implementer expects `.claude/handoff/<slug>-plan.md`. That file is **gitignored and does not survive a container recycle**. If it is missing, re-dispatch the `planner` (step 4) to regenerate it from the same scope before continuing to step 8. The committed Red tests + JSON handoff remain the authoritative contract; the regenerated plan must cover the same `behavior_cases`.

   ***

   **Case B — Current branch is `main` (or other), but the handoff branch still exists in git:**

   ```bash
   git branch -a | grep "<branch-from-handoff>"
   ```

   Surface to the human:

   > Found unfinished work: `<slug>` on `<branch>` (handoff written `<timestamp>`, attempt `<attempt>`).
   > Resume this before starting new work?
   - **Human confirms resume** → `git checkout <branch>`, then apply Case A logic above.
   - **Human declines** → leave the handoff in place and continue to step 1 for fresh work. (The handoff will be detected again next session.)

   ***

   **Case C — Handoff branch no longer exists in git** (merged, abandoned, or force-deleted):

   The handoff is a ghost — the branch is gone but the file was never cleaned up. Warn and delete:

   > Removing orphaned handoff `<slug>` — branch `<branch>` no longer exists.

   ```bash
   git rm .claude/handoff/<slug>.json
   git commit -m "chore: remove orphaned handoff for <slug>"
   git push -u origin "$(git branch --show-current)"
   ```

   Repeat for any additional ghost files, then continue to step 1.

   ***

   **If multiple handoffs exist:** process each one (Case A / B / C) before moving on. Do not start new work while any Case A or B handoff is unresolved.

1. **Pick the work.**
   - Read `docs/wiki/todos.md`. Take the top item.
   - If the next 1–3 todos share an entity and context, propose a batch. Confirm with the human via `human-checkpoint` if batching is non-obvious.
   - Identify the matching `docs/wiki/entities/<slug>.md`. If it doesn't exist, **stop** and recommend `/project:interview` to define the entity first.

2. **Branch.** Follow `feature-branching` skill:

   ```bash
   git checkout main && git pull --ff-only
   git checkout -b feat/<slug>
   ```

3. **Verify Behavior cases exist.** Read the entity page's `## Behavior` section. If any case is `[ ]` and unimplemented, that's the test target. If the section is empty or vague, **stop** — `/project:interview` or the `spec-writing` skill must define them first.

4. **Decide if a plan is needed.**
   - If the todo line in `docs/wiki/todos.md` is tagged `[complex]`, dispatch the `planner` agent first.
   - If you are batching 2+ todos under this branch, dispatch the `planner` agent first.
   - Otherwise (single simple todo), skip to step 6 (tester dispatch).

   When dispatching `planner`, pass: entity slug, batch contents if any, the test command from `docs/wiki/commands.md`, and paths to the entity page(s), `requirements.md`, `architecture.md`, and `gotchas.md`. The planner writes `.claude/handoff/<slug>-plan.md`.

5. **Verify the plan if one was written.** Read `.claude/handoff/<slug>-plan.md` if it exists. Sanity-check that the steps cover the listed Behavior cases and the scope hasn't drifted. If the plan looks wrong, send back to `planner` with notes (one redo only — second failure means re-spec via `/project:interview`).

6. **Dispatch `tester`** with this scope:
   - The entity slug.
   - The branch name.
   - The Behavior case IDs to cover this cycle.
   - The test command from `docs/wiki/commands.md`.
   - Path to the plan at `.claude/handoff/<slug>-plan.md` (if one exists).

   Tester writes failing tests, confirms Red, writes `.claude/handoff/<slug>.json`.

7. **Verify Red yourself.** Run the test command. Confirm the failing tests in the handoff actually fail and fail for the right reason. If not, send back to `tester` with notes.

8. **Dispatch `implementer`** with the same scope plus the handoff path. The implementer follows `tdd-loop` skill — Green, then refactor, then wiki update. If a plan exists at `.claude/handoff/<slug>-plan.md`, the implementer follows its Step order unless reality forces a deviation (noted in the commit message).

9. **Verify Green yourself.** Run the test command. Full suite — confirm no regression.

10. **Wiki update check.** The implementer should have updated the entity page. Confirm:
    - Behavior cases ticked.
    - Implementation section reflects current files.
    - TODO moved to `docs/wiki/completed.md`.

11. **Append to log.** `docs/wiki/log.md` (do this before committing so the entry ships in the same commit):

    ```markdown
    ## [YYYY-MM-DD HH:MM] work — <slug>

    - TODO(s): <list>
    - Cases: B1, B2
    - Branch: feat/<slug>
    ```

12. **Commit and push.** Stage everything — implementation, wiki updates, and the log entry — in one conventional commit. Then push immediately — remote execution containers can be recycled between sessions, and an unpushed commit is effectively lost work:

    ```bash
    # Stage explicitly by path — never `git add -A` blindly, and never
    # `git add -p` (interactive patch mode hangs with no human at the prompt).
    # Include the handoff path so the implementer's `git rm` of the JSON is
    # staged too — otherwise the deleted handoff lingers and rides onto main.
    git add <impl-paths> docs/wiki/ .claude/handoff/<slug>.json
    git commit -m "feat(<slug>): <summary>"
    git push -u origin <branch>
    ```

    No uncommitted files should remain after this step.

13. **Report to human.** What was done, what's next. Suggest:
    - More todos in the same entity → keep going.
    - Cross-cutting work piling up → `/project:review` may be due.
    - Risky next change → `/project:checkpoint` first.

## Failure modes

- **Planner can't produce a coherent plan.** The spec is too ambiguous. Stop and run `/project:interview` to refine the Behavior cases.
- **Tester can't confirm Red.** Stop. The Behavior cases or the test environment is wrong. Use `human-checkpoint`.
- **Implementer fails twice on the same mechanism.** Two-strike rule. `/project:checkpoint` → `/project:rollback` → re-spec. If a plan exists, re-dispatch `planner` to overwrite with a fundamentally different approach before the next `tester` cycle. Re-dispatching the `tester` over the existing handoff is what bumps the `attempt` counter — the tester owns that field; this command does not increment it itself (see `docs/wiki/concepts/handoff-format.md`).
- **Test suite has pre-existing failures.** Stop. Don't add work on top of a broken main. Use `human-checkpoint`.
- **Hooks block.** Read the block message and resolve the underlying issue. Never `--no-verify`.

## What you do NOT do

- **No coding directly.** You dispatch `planner` (when needed), `tester`, and `implementer`. You can read files and run commands; you don't write tests or production code in this command.
- **No periodic review.** That's `/project:review`, dispatched separately in a worktree.
- **No PR creation.** That's a separate step the human chooses when ready.
- **No silent batching.** If you batch todos, name the batch in the commit message scope.
