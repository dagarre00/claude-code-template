---
name: work
description: Pick the top todo (or batch consecutive todos sharing context), open a feat/* branch from develop, dispatch the planner (Opus) for complex/batched work, then the developer through red→green→refactor→wiki-update, then commit, push, and (if the entity is fully done) open a PR to develop and return to develop. The core development loop.
argument-hint: [todo, entity, or scope — e.g. "the login endpoint" | "batch the auth todos"]
type: command
---

# /project:work

**Argument:** `$ARGUMENTS`

The argument **selects the work** and overrides the default "take the top todo" in step 1:

- **Names a todo or entity** (`the login endpoint`, `entities/auth`) → work that instead of the top item. Match it against `docs/wiki/todos.md` lines and entity slugs; if nothing matches, say what you looked for and stop rather than picking something adjacent.
- **Asks for a batch** (`batch the auth todos`, `next 3`) → batch those todos under one branch, subject to the same shared-entity/shared-context rule.
- **Adds a constraint** (`skip the planner`, `tests only`) → honour it and note the deviation in the report.

An argument never bypasses the preconditions, the Red phase, or the entity-page check — it only chooses *what* the cycle covers. If it's empty, take the top todo as usual.

You orchestrate one TDD cycle (or a small batch). You do **not** write tests or production code directly — you dispatch the `planner` (only for complex or batched work) and then the `developer`, which commits each Behavior case as it lands. You verify their output, add the log entry, and — once the entity's Behavior cases are all complete — open a PR back to `develop`.

## Preconditions

**Starting fresh (on `develop`):**

- Clean working tree.
- `docs/wiki/todos.md` has at least one item.
- `docs/wiki/commands.md ## Test` is not `<TBD>`, **and the command actually runs.** Execute it once before dispatching anything. A command that errors out (framework not installed, no manifest, no test dir) is not a test command — Red would fail for the wrong reason and the whole cycle thrashes. If it doesn't run, stop and run `human-checkpoint`: the fix is `/project:init` step 5a (bootstrap a runnable test command), not improvising a skeleton mid-cycle.

If any precondition fails: stop and run `human-checkpoint`.

**If you are on a `feat/*` branch when `/project:work` is invoked**, check whether there is in-progress work (uncommitted changes or commits not yet pushed). If yes, continue from where you left off (step 5). If the branch is clean and fully pushed, it is a leftover from a prior cycle — run `git checkout develop` to reset to the correct starting point, then proceed from step 1.

## Resuming an interrupted cycle

The `developer` commits and pushes after each green case, so a container recycle loses at most the case in flight. Re-run `/project:work`: `git fetch origin feat/<slug>` recovers everything already pushed, and the remaining Behavior cases are still `[ ]`/`[~]` on the entity page, which is the resume point.

If you find yourself **on a `feat/*` branch with uncommitted changes** (a rate-limit pause within the same container, tree intact), don't restart — re-dispatch the `developer` with the same scope; it reads the working tree and continues from where it stopped.

## Steps

1. **Pick the work.**
   - Read `docs/wiki/todos.md`. Take the top item — or, if the argument named a todo/entity/batch, take that instead. Skip any line tagged `[wiki]` — those belong to `/project:wiki-lint`, not here.
   - **If the argument steers you off P0, check saturation first.** Taking the top item already drains P0, so no check is needed on the default path. But when an argument selects work outside `## Now (P0 — next)`, count the open P0 items:

     ```bash
     awk '/^## Now \(P0/{f=1;next} /^## /{f=0} f && /^- \[ \]/' docs/wiki/todos.md | wc -l
     ```

     At or above `P0_MAX` (10 — `docs/wiki/todos.md § P0 saturation threshold`), stop and run `human-checkpoint` before starting: name the count, the oldest P0 entries, and the work the argument asked for, and let the human confirm they want to skip a saturated P0. They may well say yes — the point is that it is their call, not a silent bypass.
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

   The developer runs the loop **once per Behavior case**: Red (failing test, confirmed failing for the right reason) → Green (minimum code) → refactor → tick the case → commit → push, then the next case. It owns committing; you do not bundle its work afterwards (`docs/wiki/git-conventions.md`, Cadence).

6. **Verify Red, Green, and granularity yourself.** Run the full test command: the new tests exist and the whole suite is green with no regression. Then run `git log --oneline develop..HEAD` and confirm the commits are per-case, not one lump — a single commit covering several Behavior cases is a defect to send back, because it breaks bisect and inflates the review diff. If the developer's output doesn't hold up, send it back with notes (one redo; a second failure on the same mechanism is the two-strike rule — see Failure modes).

7. **Wiki update check.** The developer should have updated the entity page. Confirm:
   - Behavior cases ticked (`[~]` → `[x]`).
   - Implementation and Tests sections reflect the current files.
   - The todo is checked off / removed from `docs/wiki/todos.md` (shipped work lives in git history, not a separate file).

7a. **Adversarial review — `[complex]` and batched cycles only.** If you dispatched the `planner` in step 4, the change is risky enough to need a second reader. Dispatch the `adversary` (Opus, fresh context) and follow the `adversarial-review` skill. Pass it **only** a commit range, the entity slug(s) and Behavior case IDs it covers, the mailbox path `.claude/handoff/<slug>-findings.md`, and the test command. **Never pass the plan file or your own reasoning** — the independence is the product.

   **Scope it small — one case, or a few closely-related ones.** Reviewing a whole multi-case cycle at once is what makes these reviews run to round 5: a large diff yields many findings, the fixes enlarge it, and the next round finds more. Several small reviews beat one large one.

   **Findings become todos; they are not fixed here.** Triage every finding to Filed / Fixed / Rejected-with-reason and **record each disposition in the commit that answers it** (behavioral rule 20). The default is Filed: a line in `docs/wiki/todos.md` at the priority its severity maps to. The review does not gate the cycle — a cycle with open findings still completes, because the queue owns them now.

   **`critical` and `major` are the exception.** Do not fix them and do not silently file them: run one `human-checkpoint` covering all of them, with each finding's failure scenario and your recommendation, and let the human choose fix-now or queue. Approved → fix in its own commit, failing test first, then re-run the full suite. Declined or unreachable → file at P0/P1 and flag it prominently in your step 12 report.

   Close the round with a `docs(<slug>): adversary round N` commit listing every finding and its disposition. Re-dispatch the adversary only if a fix actually landed, and then **over the fix commits only** — with nothing fixed there is nothing to re-review. Two rounds maximum; findings surviving round two mean the unit was too big, so split it and review the pieces.

   For a single simple todo, **skip this step**; the human can run `/project:adversary` on demand.

8. **Append to log.** `docs/wiki/log.md` — this is the one commit `/project:work` makes itself:

   ```markdown
   ## [YYYY-MM-DD HH:MM] work — <slug>

   - TODO(s): <list>
   - Cases: B1, B2
   - Branch: feat/<slug>
   - Adversary: <N> findings — <Fi> filed, <Fx> fixed, <R> rejected   # omit if step 7a was skipped
   ```

   The counts are an index, not the record. The per-finding claims and rejection reasons are in the commits themselves — `git log --grep="adversary round"`.

9. **Commit the log entry and push.** The implementation is already committed and pushed, case by case, by the `developer`; the adversary dispositions likewise. All that is left is the log:

   ```bash
   git add docs/wiki/log.md
   git commit -m "docs(<slug>): log cycle"
   git push -u origin feat/<slug>
   ```

   Then delete the `.claude/handoff/<slug>-*.md` scratch — both files are gitignored and nothing needs saving from them. Confirm `git status --porcelain` prints nothing, and that `git log --oneline develop..HEAD` reads as a per-case sequence rather than one lump.

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

12. **Report to human.** What was done, what's next. If step 7a ran, lead with any `critical`/`major` that was filed rather than fixed — that is the one outcome the human most needs to see, and it is easy to lose among the cycle's other notes. Suggest:
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
