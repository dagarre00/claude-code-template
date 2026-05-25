---
name: work
description: Pick the top todo (or batch consecutive todos sharing context), open a feat/* branch, dispatch the developer agent through spec→red→green→refactor→wiki-update, then commit and push. The core development loop.
type: command
---

# /project:work

You orchestrate one TDD cycle (or a small batch). You do **not** write tests or production code directly — you dispatch the single `developer` agent, verify its output, then commit and push.

## Preconditions

**Starting fresh (on `main`):**

- Clean working tree.
- `docs/wiki/todos.md` has at least one item.
- `docs/wiki/commands.md` has a working test command.

If any precondition fails: stop and run `human-checkpoint`.

## Resuming an interrupted cycle

The `developer` does not commit mid-cycle — `/project:work` makes one bundled commit at the end (step 8). So a container recycle mid-cycle loses the uncommitted tree, and the branch (created locally, pushed only at the end) is gone too. There is no handoff file to scan: the todo is still open in `docs/wiki/todos.md`, so simply re-running `/project:work` picks it up cleanly from the top.

If you find yourself **on a `feat/*` branch with uncommitted changes** (a rate-limit pause within the same container, tree intact), don't restart — re-dispatch the `developer` with the same scope; it reads the working tree and continues from where it stopped.

## Steps

1. **Pick the work.**
   - Read `docs/wiki/todos.md`. Take the top item. Skip any line tagged `[wiki]` — those belong to `/project:wiki-lint`, not here.
   - If the next 1–3 todos share an entity and context, propose a batch. Confirm with the human via `human-checkpoint` if batching is non-obvious.
   - Identify the matching `docs/wiki/entities/<slug>.md`. If it doesn't exist, **stop** and recommend `/project:interview` to define the entity first.

2. **Branch.** Follow `feature-branching` skill:

   ```bash
   git checkout main && git pull --ff-only
   git checkout -b feat/<slug>
   ```

3. **Verify Behavior cases exist.** Read the entity page's `## Behavior` section. If any case is `[ ]` and unimplemented, that's the test target. If the section is empty or vague, **stop** — `/project:interview` or the `spec-writing` skill must define them first.

4. **Dispatch the `developer`** with this scope:
   - The entity slug and the branch name.
   - The Behavior case IDs to cover this cycle.
   - The test command from `docs/wiki/commands.md`.
   - Whether to plan first: if the todo line is tagged `[complex]` or you are batching 2+ todos, tell the developer to write a plan (`plan-writing` → `.claude/handoff/<slug>-plan.md`) before testing. Otherwise it goes straight to Red.

   The developer runs the full loop: optional plan → Red (writes failing tests, confirms they fail for the right reason) → Green (minimum code) → refactor → wiki update. It does **not** commit — you do that in step 8.

5. **Verify Red and Green yourself.** Run the full test command. Confirm the new tests exist and the whole suite is green with no regression. If the developer's output doesn't hold up, send it back with notes (one redo; a second failure on the same mechanism is the two-strike rule — see step under Failure modes).

6. **Wiki update check.** The developer should have updated the entity page. Confirm:
   - Behavior cases ticked (`[~]` → `[x]`).
   - Implementation and Tests sections reflect the current files.
   - The todo is checked off / removed from `docs/wiki/todos.md` (shipped work lives in git history, not a separate file).

7. **Append to log.** `docs/wiki/log.md` (do this before committing so the entry ships in the same commit):

   ```markdown
   ## [YYYY-MM-DD HH:MM] work — <slug>

   - TODO(s): <list>
   - Cases: B1, B2
   - Branch: feat/<slug>
   ```

8. **Commit and push.** Stage everything — implementation, wiki updates, and the log entry — in one conventional commit. Then push immediately — remote execution containers can be recycled between sessions, and an unpushed commit is effectively lost work:

   ```bash
   # Stage explicitly by path — never `git add -A` blindly, and never
   # `git add -p` (interactive patch mode hangs with no human at the prompt).
   git add <impl-paths> docs/wiki/
   git commit -m "feat(<slug>): <summary>"
   git push -u origin feat/<slug>
   ```

   The `*-plan.md` scratch is gitignored, so it never enters the commit; delete it once the cycle is done. No tracked uncommitted files should remain after this step.

9. **Report to human.** What was done, what's next. Suggest:
   - More todos in the same entity → keep going.
   - Cross-cutting work piling up → `/project:review` may be due.
   - Risky next change → tag a checkpoint first (`git tag checkpoint-$(date -u +%Y%m%dT%H%M%SZ)`).

## Failure modes

- **Developer can't produce a coherent plan.** The spec is too ambiguous. Stop and run `/project:interview` to refine the Behavior cases.
- **Developer can't confirm Red.** Stop. The Behavior cases or the test environment is wrong. Use `human-checkpoint`.
- **Developer fails twice on the same mechanism.** Two-strike rule (behavioral rule 5). Tag the state (`git tag checkpoint-<stamp>`), `git reset --hard` to a known-good commit, and re-spec via `/project:interview` before re-dispatching with a fundamentally different approach.
- **Test suite has pre-existing failures.** Stop. Don't add work on top of a broken main. Use `human-checkpoint`.
- **Hooks block.** Read the block message and resolve the underlying issue. Never `--no-verify`.

## What you do NOT do

- **No coding directly.** You dispatch the `developer`. You can read files and run commands to verify; you don't write tests or production code in this command.
- **No periodic review.** That's `/project:review`, dispatched separately in a worktree.
- **No PR creation.** That's a separate step the human chooses when ready.
- **No silent batching.** If you batch todos, name the batch in the commit message scope.
