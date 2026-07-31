---
name: work
description: Pick the top todo (or batch consecutive todos sharing context), open a feat/* branch from develop, dispatch the planner (Opus) for complex/batched work, then the developer through red→green→refactor→wiki-update, then commit, push, and (if the entity is fully done) open a PR to develop and return to develop. The core development loop.
type: command
---

# /project:work

You orchestrate one TDD cycle (or a small batch). You do **not** write tests or production code directly — you dispatch the `planner` (only for complex or batched work) and then the `developer`, verify their output, then commit, push, and — once the entity's Behavior cases are all complete — open a PR back to `develop`.

## Preconditions

**Starting fresh (on `develop`):**

- Clean working tree.
- `docs/wiki/todos.md` has at least one item.
- `docs/wiki/commands.md ## Test` is not `<TBD>`, **and the command actually runs.** Execute it once before dispatching anything. A command that errors out (framework not installed, no manifest, no test dir) is not a test command — Red would fail for the wrong reason and the whole cycle thrashes. If it doesn't run, stop and run `human-checkpoint`: the fix is `/project:init` step 5a (bootstrap a runnable test command), not improvising a skeleton mid-cycle.

If any precondition fails: stop and run `human-checkpoint`.

**If you are on a `feat/*` branch when `/project:work` is invoked**, check whether there is in-progress work (uncommitted changes or commits not yet pushed). If yes, continue from where you left off (step 5). If the branch is clean and fully pushed, it is a leftover from a prior cycle — run `git checkout develop` to reset to the correct starting point, then proceed from step 1.

## Resuming an interrupted cycle

The `developer` does not commit mid-cycle — `/project:work` makes one bundled commit at the end (step 9). So a container recycle mid-cycle loses the uncommitted tree, and the branch (created locally, pushed only at the end) is gone too. There is no handoff file to scan: the todo is still open in `docs/wiki/todos.md`, so simply re-running `/project:work` picks it up cleanly from the top.

If you find yourself **on a `feat/*` branch with uncommitted changes** (a rate-limit pause within the same container, tree intact), don't restart — re-dispatch the `developer` with the same scope; it reads the working tree and continues from where it stopped.

## Steps

1. **Pick the work.**
   - Read `docs/wiki/todos.md`. Take the top item. Skip any line tagged `[wiki]` — those belong to `/project:wiki-lint`, not here.
   - If the next 1–3 todos share an entity and context, propose a batch. Confirm with the human via `human-checkpoint` if batching is non-obvious.
   - Identify the matching `docs/wiki/entities/<slug>.md`. If it doesn't exist, **stop** and recommend `/project:interview` to define the entity first.

2. **Fetch and branch.** Follow `feature-branching` skill. Fetch first so the divergence check is against actual remote state, not a stale local mirror:

   ```bash
   git fetch origin develop
   git checkout develop && git merge --ff-only origin/develop
   git checkout -b feat/<slug>
   ```

   If `merge --ff-only` fails (develop has diverged in a non-fast-forward way), stop and use `human-checkpoint` — do not rebase or force develop.

   **No remote yet?** `/project:init` supports finishing without one. Check with `git remote` — if it prints nothing, skip the fetch/merge and branch straight off local `develop`. Every push step in this command is then skipped and noted in the report until the human adds a remote.

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

7a. **Adversarial review — `[complex]` and batched cycles only.** If you dispatched the `planner` in step 4, the change is risky enough to need a second reader before it is called done. Dispatch the `adversary` (Opus, fresh context) and follow the `adversarial-review` skill. Pass it **only** the diff scope (`git diff` + `git diff --staged`), the entity slug(s) and Behavior case IDs, the mailbox path `.claude/handoff/<slug>-findings.md`, and the test command. **Never pass the plan file or your own reasoning** — the independence is the product.

   Then triage every finding to Fixed / Rejected-with-reason / Deferred-with-todo in the mailbox (behavioral rule 20), re-dispatch the adversary once to confirm, and re-run the full test suite after any fix. Two rounds maximum: surviving `critical`/`major` findings go to `human-checkpoint`, not to a third round. Fixes ride along in step 9's bundled commit — no separate review commit.

   For a single simple todo, **skip this step**; the human can run `/project:adversary` on demand.

8. **Append to log.** `docs/wiki/log.md` (do this before committing so the entry ships in the same commit):

   ```markdown
   ## [YYYY-MM-DD HH:MM] work — <slug>

   - TODO(s): <list>
   - Cases: B1, B2
   - Branch: feat/<slug>
   - Adversary: <N> findings — <F> fixed, <R> rejected, <D> deferred   # omit if step 7a was skipped
   ```

9. **Commit and push.** Stage everything — implementation, wiki updates, and the log entry — in one conventional commit. Then push immediately — remote execution containers can be recycled between sessions, and an unpushed commit is effectively lost work:

   ```bash
   # Stage explicitly by path — never `git add -A` blindly, and never
   # `git add -p` (interactive patch mode hangs with no human at the prompt).
   git add <impl-paths> docs/wiki/
   git commit -m "feat(<slug>): <summary>"
   git push -u origin feat/<slug>
   ```

   The `*-plan.md` and `*-findings.md` scratch files are gitignored, so they never enter the commit; delete them once the cycle is done. No tracked uncommitted files should remain after this step.

10. **Check feature completion.** Re-read the entity page's `## Behavior` section.
    - **All cases are `[x]`** → the feature is finished. Proceed to step 11.
    - **Some cases remain `[ ]` or `[~]`** → skip to step 12 (no PR yet).

11. **Create PR and return to develop.** Feature is done — open the PR immediately:
    - Follow the `pr-create` skill to draft the body.
    - Open the PR using `mcp__github__create_pull_request` targeting `develop`.
    - Append the `pr — <slug>` entry to `docs/wiki/log.md` (the PR number only exists now, so it could not ship in step 9's commit), then commit and push it. Skipping this leaves the tree dirty and the next `git checkout` either drags the change along or fails:

      ```bash
      git add docs/wiki/log.md
      git commit -m "docs(<slug>): log PR #N"
      git push
      ```

    - Tell the human: "Feature `<slug>` is complete. I've opened PR #N targeting `develop` — please review and merge when ready."
    - Confirm the tree is clean (`git status --porcelain` prints nothing), then switch back to develop:

      ```bash
      git checkout develop
      ```

12. **Report to human.** What was done, what's next. Suggest:
    - More todos in the same entity → keep going (run `/project:work` again from `develop` or the existing branch if still open).
    - Cross-cutting work piling up → `/project:review` may be due.
    - Risky next change → tag a checkpoint first (`git tag checkpoint-$(date -u +%Y%m%dT%H%M%SZ)`).

## Failure modes

- **Planner can't produce a coherent plan.** The spec is too ambiguous. Stop and run `/project:interview` to refine the Behavior cases.
- **Adversary finding survives two rounds.** Don't open a third. `human-checkpoint` with both positions stated — the author's and the reviewer's.
- **Adversary edits, commits, or pushes.** The read-only invariant is broken and the round is void. Report it, `git diff` to see what it touched, and re-dispatch after restoring the tree.
- **Developer can't confirm Red.** Stop. The Behavior cases or the test environment is wrong. Use `human-checkpoint`.
- **Developer fails twice on the same mechanism.** Two-strike rule (behavioral rule 5). Tag the state (`git tag checkpoint-<stamp>`), `git reset --hard` to a known-good commit, and re-spec via `/project:interview`. For complex/batched work, re-dispatch the `planner` to overwrite the plan with a fundamentally different approach before the next `developer` attempt.
- **Test suite has pre-existing failures.** Stop. Don't add work on top of a broken develop. Use `human-checkpoint`.
- **Merge conflicts during branch sync.** Follow the `git-recovery` skill (Resolve merge / rebase / cherry-pick conflicts). If the conflicts are too broad or ambiguous, use `human-checkpoint` rather than guessing.
- **Lost work after a container recycle.** Commits pushed to remote survive; only unpushed local state is gone. Check `git reflog` on the remote via `git ls-remote` — if the branch was pushed, `git fetch origin feat/<slug> && git checkout feat/<slug>` recovers it. If unpushed, re-run from the last open todo.

## What you do NOT do

- **No coding directly.** You dispatch the `planner` (when needed), the `developer`, and the `adversary` (when gated). You can read files and run commands to verify; you don't write tests or production code in this command. Fixes for adversary findings are the exception you hand back to the `developer` if they are more than a line or two.
- **No periodic review.** That's `/project:review`, dispatched separately in a worktree. The `reviewer` never runs here — the in-loop second reader is the `adversary`, which is diff-scoped and read-only (behavioral rule 12).
- **No merging.** PR creation is automated (step 11); merging is always the human's call.
- **No silent batching.** If you batch todos, name the batch in the commit message scope.
