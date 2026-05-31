---
name: work
description: Pick the top todo (or batch consecutive todos sharing context), open a feat/* branch, dispatch the planner (Opus) for complex/batched work, then the developer through red→green→refactor→wiki-update, then commit and push. The core development loop.
type: command
---

# /project:work

You orchestrate one TDD cycle (or a small batch). You do **not** write tests or production code directly — you dispatch the `planner` (only for complex or batched work) and then the `developer`, verify their output, then commit and push.

## Preconditions

**Starting fresh (on `main`):**

- Clean working tree.
- `docs/wiki/todos.md` has at least one item.
- `docs/wiki/commands.md` has a working test command.

If any precondition fails: stop and run `human-checkpoint`.

## Resuming an interrupted cycle

The `developer` does not commit mid-cycle — `/project:work` makes one bundled commit at the end (step 9). So a container recycle mid-cycle loses the uncommitted tree, and the branch (created locally, pushed only at the end) is gone too. There is no handoff file to scan: the todo is still open in `docs/wiki/todos.md`, so simply re-running `/project:work` picks it up cleanly from the top.

If you find yourself **on a `feat/*` branch with uncommitted changes** (a rate-limit pause within the same container, tree intact), don't restart — re-dispatch the `developer` with the same scope; it reads the working tree and continues from where it stopped.

## Steps

1. **Pick the work.**
   - Read `docs/wiki/todos.md`. Take the top item. Skip any line tagged `[wiki]` — those belong to `/project:wiki-lint`, not here.
   - If the next 1–3 todos share an entity and context, propose a batch. Confirm with the human via `human-checkpoint` if batching is non-obvious.
   - Identify the matching `docs/wiki/entities/<slug>.md`. If it doesn't exist, **stop** and recommend `/project:interview` to define the entity first.

2. **Fetch and branch from `develop`.** Follow `feature-branching` skill. `develop` is the base branch — never branch from or commit to `main`. Fetch first so the divergence check is against actual remote state, not a stale local mirror:

   ```bash
   git fetch origin develop
   git checkout develop && git merge --ff-only origin/develop
   git checkout -b feat/<slug>
   ```

   If `merge --ff-only` fails (develop has diverged in a non-fast-forward way), stop and use `human-checkpoint` — do not rebase or force develop.

3. **Verify Behavior cases exist.** Read the entity page's `## Behavior` section. If any case is `[ ]` and unimplemented, that's the test target. If the section is empty or vague, **stop** — `/project:interview` or the `spec-writing` skill must define them first.

4. **Plan first if the work is complex or batched.** If the todo line is tagged `[complex]`, or you are batching 2+ todos under this branch, **dispatch the `planner`** (runs on Opus) before any testing. Pass it:
   - The entity slug(s) and the batch contents, if any.
   - The Behavior case IDs to cover this cycle.
   - The test command from `docs/wiki/commands.md`.

   The planner writes `.claude/handoff/<slug>-plan.md` (gitignored scratch) and does nothing else — no branch, no tests, no code. **Sanity-check the plan it produces:** confirm the steps cover the listed Behavior cases and the scope hasn't drifted. If it's wrong, send it back once (a second failure means re-spec via `/project:interview`). For a single simple todo, **skip planning** — go straight to step 5.

5. **Dispatch the `developer`** with this scope:
   - The entity slug and the branch name.
   - The Behavior case IDs to cover this cycle.
   - The test command from `docs/wiki/commands.md`.
   - The path to the plan at `.claude/handoff/<slug>-plan.md` **if one was written** in step 4 — the developer follows its step order unless reality forces a noted deviation.

   The developer runs the loop: Red (writes failing tests, confirms they fail for the right reason) → Green (minimum code) → refactor → wiki update. It does **not** commit — you do that in step 9.

6. **Verify Red and Green yourself.** Run the full test command. Confirm the new tests exist and the whole suite is green with no regression. If the developer's output doesn't hold up, send it back with notes (one redo; a second failure on the same mechanism is the two-strike rule — see Failure modes).

7. **Wiki update check.** The developer should have updated the entity page. Confirm:
   - Behavior cases ticked (`[~]` → `[x]`).
   - Implementation and Tests sections reflect the current files.
   - The todo is checked off / removed from `docs/wiki/todos.md` (shipped work lives in git history, not a separate file).

8. **Append to log.** `docs/wiki/log.md` (do this before committing so the entry ships in the same commit):

   ```markdown
   ## [YYYY-MM-DD HH:MM] work — <slug>

   - TODO(s): <list>
   - Cases: B1, B2
   - Branch: feat/<slug>
   ```

9. **Commit and push.** Stage everything — implementation, wiki updates, and the log entry — in one conventional commit. Then push immediately — remote execution containers can be recycled between sessions, and an unpushed commit is effectively lost work:

   ```bash
   # Stage explicitly by path — never `git add -A` blindly, and never
   # `git add -p` (interactive patch mode hangs with no human at the prompt).
   git add <impl-paths> docs/wiki/
   git commit -m "feat(<slug>): <summary>"
   git push -u origin feat/<slug>
   ```

   The `*-plan.md` scratch is gitignored, so it never enters the commit; delete it once the cycle is done. No tracked uncommitted files should remain after this step.

10. **Merge into `develop` (human-approved).** The cycle isn't done until the work is integrated — the agent owns the merge; the human approves it. Propose the merge via `human-checkpoint` (cycle summary, Behavior cases ticked, suite green, develop fast-forward clean), and **wait for explicit go-ahead**. On approval, follow the `branch-merge` skill: sync `develop`, `git merge --no-ff feat/<slug>`, re-run the full suite on `develop`, push `develop`, then delete the feature branch (local + remote).

    If the human says hold, stop here — the branch stays pushed and unmerged for later. Never merge into `develop` without approval, and never push a red `develop`. (A PR to `develop` via `pr-create` is the alternative only when the human explicitly asks for review instead of a direct merge.)

11. **Report to human.** What was done (and whether it merged into `develop` or is held), what's next. Suggest:
    - More todos in the same entity → keep going.
    - Cross-cutting work piling up → `/project:review` may be due.
    - `develop` has shippable work → `/project:release` to cut a tagged release to `main`.
    - Risky next change → tag a checkpoint first (`git tag checkpoint-$(date -u +%Y%m%dT%H%M%SZ)`).

## Failure modes

- **Planner can't produce a coherent plan.** The spec is too ambiguous. Stop and run `/project:interview` to refine the Behavior cases.
- **Developer can't confirm Red.** Stop. The Behavior cases or the test environment is wrong. Use `human-checkpoint`.
- **Developer fails twice on the same mechanism.** Two-strike rule (behavioral rule 5). Tag the state (`git tag checkpoint-<stamp>`), `git reset --hard` to a known-good commit, and re-spec via `/project:interview`. For complex/batched work, re-dispatch the `planner` to overwrite the plan with a fundamentally different approach before the next `developer` attempt.
- **Test suite has pre-existing failures.** Stop. Don't add work on top of a broken main. Use `human-checkpoint`.
- **Merge conflicts during branch sync.** Follow the `conflict-resolution` skill. If the conflicts are too broad or ambiguous, use `human-checkpoint` rather than guessing.
- **Lost work after a container recycle.** Commits pushed to remote survive; only unpushed local state is gone. Check `git reflog` on the remote via `git ls-remote` — if the branch was pushed, `git fetch origin feat/<slug> && git checkout feat/<slug>` recovers it. If unpushed, re-run from the last open todo.
- **Hooks block.** Read the block message and resolve the underlying issue. Never `--no-verify`.

## What you do NOT do

- **No coding directly.** You dispatch the `planner` (when needed) and the `developer`. You can read files and run commands to verify; you don't write tests or production code in this command.
- **No periodic review.** That's `/project:review`, dispatched separately in a worktree.
- **No releasing.** Merging `develop → main` is `/project:release`, not this command. `/project:work` integrates into `develop` only.
- **No unapproved merge.** The `develop` merge in step 10 requires explicit human go-ahead; never merge or push `develop` without it.
- **No silent batching.** If you batch todos, name the batch in the commit message scope.
