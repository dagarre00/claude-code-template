---
name: work
description: Pick the top todo (or batch consecutive todos sharing context), open a feat/* branch from develop, dispatch the planner for complex/batched work, put the brief through the plan-adversary, then the developer through red→green→refactor→wiki-update, then commit, push, and (if the entity is fully done) open a PR to develop and return to develop. The core development loop.
argument-hint: [todo, entity, or scope — e.g. "the login endpoint" | "batch the auth todos"]
type: command
skills:
  planner: [plan-writing, spec-writing]
  plan-adversary: [plan-review]
  developer: [tdd-loop, clean-architecture, wiki-update, gotcha-recording, decision-recording]
  adversary: [adversarial-review]
---

# /project:work

**Argument:** `$ARGUMENTS`

The argument **selects the work** and overrides the default "take the top todo" in step 1:

- **Names a todo or entity** (`the login endpoint`, `entities/auth`) → work that instead of the top item. Match it against `docs/wiki/todos.md` lines and entity slugs; if nothing matches, say what you looked for and stop rather than picking something adjacent.
- **Asks for a batch** (`batch the auth todos`, `next 3`) → batch those todos under one branch, subject to the same shared-entity/shared-context rule.
- **Adds a constraint** (`skip the planner`, `skip the pre-flight`, `tests only`) → honour it and note the deviation in the report.

An argument never bypasses the preconditions, the Red phase, or the entity-page check — it only chooses *what* the cycle covers. If it's empty, take the top todo as usual.

You orchestrate one TDD cycle (or a small batch). You do **not** write tests or production code directly — you dispatch the `planner` (only for complex or batched work), the `plan-adversary` at the brief it produced, and then the `developer`. You verify their output, commit it, add the log entry, and — once the entity's Behavior cases are all complete — open a PR back to `develop`.

## How you dispatch

Every dispatch goes through the workflow MCP server and follows the **`worker-dispatch` skill** — read it before the first dispatch of the cycle: `check` once, then per dispatch prepare (and run its `setup_commands`) → compose → run → `inspect_dispatch` → `record_decision` → integrate → `remove_worktree`. You are the conductor, so you may dispatch as many times as the cycle needs; a dispatched worker never dispatches anything itself. This holds even when a role's configured engine is your own — dispatching the `developer` on Sonnet while you conduct on Claude Code is still a `prepare_worktree`/`build_worker_prompt` dispatch, never a shortcut through your own native Task/Agent tool.

What this cycle adds on top of the skill:

- **Narrow `skills`** only when a worker clearly needs less than its declared set — each role already receives only its own skills (developer ≈40KB, adversary ≈17KB composed).
- **Inputs outside the worktree.** If a task needs a file the worker cannot reach through its own worktree (a baseline outside it, a large fixture), inline its content in `instructions` or confirm the engine's read grant covers the path before dispatching. A denied read ends the run; a corrected resume once dropped 43KB → 27KB of prompt just from fixing this after the fact.
- **A developer's case is accepted only after its Red is proven.** Pass `test_paths` and `test_command` on every developer dispatch; `inspect_dispatch` stays `incomplete` until you run the returned `red_check_command` (step 6), and rejects the case if its tests pass with the implementation reverted. Then `record_decision`, then stage and merge as the skill says.
- **Removals.** A task that moves a file splits in two: the worker writes the new path and reports the old one as superseded, and you `git rm` the old path in the same commit, so git records a rename. A worker left to discover that it cannot delete files ends its run on a denied action.

## Preconditions

**Starting fresh (on `develop`):**

- **Clean working tree — and "clean" means *yours*.** Run `git status --porcelain` and account for every line. Changes you did not make are another session's live work, not stale dirt: never stash, reset, or check out over them (behavioral rule 21) — stop and run `human-checkpoint` naming the paths.
- `docs/wiki/todos.md` has at least one item.
- `docs/wiki/commands.md ## Test` is not `<TBD>`, **and the command actually runs.** Execute it once before dispatching anything. A command that errors out (framework not installed, no manifest, no test dir) is not a test command — Red would fail for the wrong reason and the whole cycle thrashes. If it doesn't run, stop and run `human-checkpoint`: the fix is `/project:init` step 5a (bootstrap a runnable test command), not improvising a skeleton mid-cycle.

If any precondition fails: stop and run `human-checkpoint`.

**If you are on a `feat/*` branch when `/project:work` is invoked**, check whether there is in-progress work:
- If there are uncommitted changes or commits not yet pushed, or if the current entity still has unticked Behavior cases (`[ ]` / `[~]`), stay on `feat/<slug>` and continue the feature (step 5).
- If all Behavior cases on the entity page are already `[x]` and pushed, confirm the PR was actually merged (`gh pr view <branch> --json state`, or check whether `develop`'s log already has the merge commit) before treating this as a finished cycle — `[x]`-and-pushed alone is also true of an open, unmerged PR. Once confirmed: check out `develop`, sync with `git fetch origin develop && git merge --ff-only origin/develop` (not bare `pull` — `feature-branching`'s convention, so a non-fast-forward fails safely instead of creating a merge commit), then delete the local branch with `git branch -d <branch>` — lowercase `-d`, which refuses if git itself doesn't consider the branch merged, as a second check on the confirmation above.

## Resuming an interrupted cycle

You commit and push after each green case, so a container recycle loses at most the case in flight — plus whatever sits uncommitted in a worker's worktree, which is why you commit between cases rather than at the end. Re-run `/project:work`: `git fetch origin feat/<slug>` recovers everything already pushed, and the remaining Behavior cases are still `[ ]`/`[~]` on the entity page, which is the resume point.

If you find yourself **on a `feat/*` branch with uncommitted changes** (a rate-limit pause within the same container, tree intact), don't restart — re-dispatch the `developer` with the same scope; it reads the working tree and continues from where it stopped.

## Steps

1. **Pick the work.**
   - **Fetch before you read.** `todos.md` on disk cannot know that another session merged a PR finishing the top item, so this runs before anything else in this step:

     ```bash
     git fetch origin develop
     ```

     Check the candidate against `origin/develop` rather than the local mirror: if the entity page there already has its Behavior cases ticked, or `git log origin/develop --oneline --grep='<slug>'` shows the work shipped, remove the stale line from `todos.md` and take the next one. This fetch is read-only — step 2 still does the fast-forward merge. It exists so that the pick, the spec read, and any checkpoint are not spent on work that is already done.
   - Read `docs/wiki/todos.md`. Take the top item — or, if the argument named a todo/entity/batch, take that instead. Skip any line tagged `[wiki]` — those belong to `/project:wiki`, not here.
   - **If the argument steers you off P0, check saturation first.** Taking the top item already drains P0, so no check is needed on the default path. But when an argument selects work outside `## Now (P0 — next)`, count the open P0 items with the snippet in `docs/wiki/todos.md § P0 saturation threshold`.

     At or above `P0_MAX` (10, defined in that same section), stop and run `human-checkpoint` before starting: name the count, the oldest P0 entries, and the work the argument asked for, and let the human confirm they want to skip a saturated P0. They may well say yes — the point is that it is their call, not a silent bypass.
   - If the next 1–3 todos share an entity and context, propose a batch. Confirm with the human via `human-checkpoint` if batching is non-obvious.
   - Identify the matching `docs/wiki/entities/<slug>.md`. If it doesn't exist, **stop** and recommend `/project:interview` to define the entity first.
   - **`[infra]` todos map to a concept page instead.** Deployment, CI, environment, and configuration work has no feature entity, and a loop that only accepts entity-backed todos locks it out entirely — which is how infrastructure ends up shipping outside the schema: untested, unreviewed, and unlogged. A todo tagged `[infra]` may name a `docs/wiki/concepts/<slug>.md` page, whose `## Behavior` section holds verifiable operational assertions ("a request without `X-Edge-Secret` gets 403", "CORS allows exactly these origins"). Everything else in this command is unchanged — infra work is still Red-first, still committed per case, still logged.

2. **Fetch and branch.** Run the "Starting work" blocks from the `feature-branching` skill (read them), with `<type>/<slug>` = `feat/<slug>`: guarded checkout of `develop`, fetch, `merge --ff-only`, then create or resume the branch. Any `--ff-only` failure or a diverged `origin/feat/<slug>` (another session pushed here) → stop and `human-checkpoint`; never rebase or force-push over it. No remote yet? The skill's guard skips the fetch and merge, and every push step in this command is then skipped and noted in the report (git-conventions § Cadence).

3. **Verify Behavior cases exist.** Read the `## Behavior` section of the entity page — or, for an `[infra]` todo, of the concept page named in step 1. If any case is `[ ]` and unimplemented, that's the test target. If the section is empty or vague, **stop** — `/project:interview` or the `spec-writing` skill must define them first.

   **Config and deploy changes are behavior.** Middleware, an auth header, a CORS rule, a routing change — each alters what the system does with a request, so each takes a failing test first like any other case (behavioral rule 2). "It's just config" is the sentence that ships an untested authentication gate.

4. **Plan first if the work is complex or batched.** If the todo line is tagged `[complex]`, or you are batching 2+ todos under this branch, **dispatch the `planner`** (runs on the engine and model pinned for it in `.agents/config.json`) before any testing. Pass it:
   - The entity slug(s) and the batch contents, if any.
   - The Behavior case IDs to cover this cycle.
   - The test command from `docs/wiki/commands.md`.

   The planner is a **read-only** role: it writes no files at all and returns the complete plan in its report. **Save that report to `.handoff/<slug>-plan.md`** (gitignored scratch) — then pass that path as `instructions_file` in steps 4a and 5 rather than re-typing the plan into the tool call twice. The MCP reads it in *your* checkout and inlines the content, so the worker still receives text: worktrees do not share scratch, and a path is never something a worker can open. Re-emitting a plan verbatim through two tool calls was measured as the largest single token cost in this loop. **Sanity-check the plan:** confirm the steps cover the listed Behavior cases and the scope hasn't drifted. If it's wrong, send it back once (a second failure means re-spec via `/project:interview`). For a single simple todo, **skip planning** — go straight to step 4a.

4a. **Review the brief — every cycle, before any test.** Dispatch the `plan-adversary` (read-only, on its own pinned engine) and run the brief round of the `finding-disposition` skill — subject selection, what to send, and the disposition of each finding live there; the reviewer's own sweep is `plan-review`, which only it receives. The command-level division of labour:

   - The subject is **exactly one** of: the step 4 plan (`[complex]`/batched — pass `instructions_file: .handoff/<slug>-plan.md`), or the todo line plus the `$ARGUMENTS` instruction verbatim (simple cycle, no plan). Send the entity slug(s), the Behavior case IDs, the test command and the branch name with it — **and nothing else**. Your own reading of the plan is precisely the framing that turns a review into agreement.
   - Dispose of every finding before dispatching the developer. **Applied is the default** — you edit the plan file you will send in step 5, or the todo line. Editing the file is what makes an applied finding real: step 5 sends whatever that file now says. **Escalated** means the *spec* is what is wrong: `human-checkpoint` recommending `/project:interview`, and the cycle stops there rather than starting Red on an ambiguous case. **Rejected** takes one sentence of reason. A `blocker` you disagree with is a checkpoint, never a rejection.
   - Re-dispatch the `planner` only for a **structural** blocker — wrong decomposition, an impossible step order — and only once. Everything smaller you apply yourself.

   Unlike step 7a, this is **not** gated on `[complex]`: a one-line todo is where an unstated assumption travels furthest, and the pass is cheap. `skip the pre-flight` in the argument turns it off; say so in the report.

5. **Dispatch the `developer`** with this scope:
   - The entity slug and the branch name.
   - The Behavior case IDs to cover this cycle.
   - The test command from `docs/wiki/commands.md`.
   - The plan from step 4 **if one was made**, **as revised by step 4a** — pass `instructions_file: .handoff/<slug>-plan.md`, the same file you edited when applying findings. The developer follows its step order unless reality forces a noted deviation. Never a pre-review copy: the findings you applied exist only in that file.
   - `owned_paths`: the source and test paths for the case, the entity page, `docs/wiki/gotchas.md` and `docs/wiki/decisions` — the wiki edits its skills make inline. **Never** `docs/wiki/todos.md`, `wiki-todos.md` or `log.md`: those are yours, and the developer hands lines for them back under `Follow-ups:`. Never a path listed in `.agents/config.json` `protectedPaths` or `architecture.rules` — composition refuses it.
   - `test_paths` (the test files or directory for this case, inside `owned_paths`) and `test_command` (verbatim from `docs/wiki/commands.md`) — what step 6's Red check re-runs.
   - a `commit_message` for the case.

   The developer runs the loop **once per Behavior case**: Red (failing test, confirmed failing for the right reason) → Green (minimum code) → refactor → tick the case. It leaves the result as files and runs no git at all.

   **You commit, once per Behavior case** (`docs/wiki/git-conventions.md`, Cadence). Dispatch one case at a time and commit between them: that is what keeps the history per-case rather than one lump, and it is now your job because the worker cannot do it. Anything the worker changed outside its `owned_paths` is a defect — read it before deciding, and never widen ownership after the fact to make it commit cleanly.

6. **Verify Red, Green, and architecture yourself — before accepting the case.**
   - **Red, mechanically.** Run the `red_check_command` the dispatch returned (also in `inspect_dispatch` → `red.command`). It reverts every non-test file the developer changed to the base commit, runs the test command, and restores the files byte for byte. Exit 0 = Red proven; exit 1 = **refuted** — the tests pass without the implementation, and the case is rejected no matter what the report says. Read its output tail: the failure must be the missing behavior (an assertion, or the not-yet-written symbol the case introduces), not a broken fixture. Interrupted → run it again with `--restore` before anything else.
   - **Green and architecture.** In the worktree, run the full test command and `docs/wiki/commands.md § Architecture`. Both pass, with no regression.
   - **Granularity.** One dispatch, one case, one commit — you commit it, so keep that cadence yourself.
   - **Follow-ups.** Lines the developer handed back for `todos.md` or `wiki-todos.md` are yours to append in the case commit.

   If the output doesn't hold up, send it back with notes (one redo; a second failure on the same mechanism is the two-strike rule — see Failure modes).

   **A case the worker could not verify is yours to run before its commit claims anything.** Its allowlist is narrower than your shell: a GUI application, a hardware- or machine-specific runner, a service it has no credentials for. The developer is required to name such a case in its first report on it rather than at the end, so you have it in time — but the check itself is yours, and it is not optional bookkeeping. Measured: a case whose real runner no worker could invoke passed its unit test and reached commit-ready with a defect that only the real runner exposed, because the unit harness supplied an environment the runner does not. Worse, the substitute can fail *as a pass* — a script the harness silently never executes prints nothing and exits 0, which reads exactly like green. So run it, read the output, and only then let the commit message say the case is done. If you cannot run it either, the case stays `[~]` and the report says so; a green suite is evidence about what it actually executed and nothing more.

7. **Wiki update check.** The developer should have updated the entity page. Confirm:
   - Behavior cases ticked (`[~]` → `[x]`).
   - Implementation and Tests sections reflect the current files.
   - Then remove the finished todo from `docs/wiki/todos.md` yourself, in the last case's commit — the developer does not own that file (shipped work lives in git history, not a separate file).

7a. **Adversarial review — `[complex]` and batched cycles only.** If you dispatched the `planner` in step 4, dispatch the `adversary` (fresh context, its own pinned engine) and run the diff round of the `finding-disposition` skill — dispatch contents, triage, dispositions, round commit, re-review, stop conditions, and recording the finding counts with `reviewed_task_ids` all live there. The adversary's own sweep is `adversarial-review`, which only it receives. The command-level division of labour:

   - Pass **only** `diff_range` for a small commit range (one case or a few closely-related ones) — the MCP computes the diff and embeds it in the prompt, because the adversary's allowlist has no ranged `git diff`: a range carries a per-dispatch SHA no exact-match allowlist can express, and a reviewer that cannot run it reviews whole post-change files instead and says so in a disclaimer. Send the entity slug(s) and Behavior case IDs, and the test command. Findings come back in the adversary's report; it writes no files. Never the plan file or your own reasoning — the independence is the product.
   - For a technical second opinion before disposing of findings, dispatch the read-only **`triage`** role with the same `diff_range`, the entity slug and case IDs, and the adversary's findings verbatim — not the `developer`, whose TDD skills and write access a judgement call does not need. It recommends a disposition and says what a fix would touch; **you** own the severity, the `human-checkpoint` for `critical`/`major`, the todo lines, and the round-closing commit. Never accept a severity downgrade on the sole ground that a failure was not reproduced live. The `developer` is dispatched only for a fix the human approved. Declined-or-unreachable criticals get flagged prominently in your step 11 report.
   - The review does not gate the cycle — a cycle with open filed findings still completes; the queue owns them now.

   For a single simple todo, **skip this step**; the human can run `/project:adversary` on demand.

8. **Log, commit and push** per [`log-and-commit.md`](../skills/feature-branching/log-and-commit.md) — kind `work`, fields `TODO(s): <list>`, `Cases: B1, B2`, `Branch: feat/<slug>`, `Plan review: <N> findings — <A> applied, <E> escalated, <R> rejected` followed by one line per finding (`plan-review` § step 6 — the log is that review's only committed record, so the reasons go here, not just the counts), and `Adversary: <N> findings — <Fi> filed, <Fx> fixed, <R> rejected` (omit that line if step 7a was skipped; omit the plan-review lines only if the argument skipped step 4a). Stage `docs/wiki/log.md` alone; subject `docs(<slug>): log cycle`.

   This is the **one commit `/project:work` makes itself** — the log's own commit, which is the documented exception to shipping the entry alongside its work. The implementation was already committed case by case in step 5, and the adversary dispositions likewise, so the log is genuinely all that is left.

   Then delete any `.handoff/<slug>-plan.md` scratch — it is gitignored and nothing needs saving from it. Confirm `git status --porcelain` prints nothing, and that `git log --oneline develop..HEAD` reads as a per-case sequence rather than one lump.

9. **Check feature completion.** Re-read the entity page's `## Behavior` section.
    - **All cases are `[x]`** → the feature is finished. Proceed to step 11.
    - **Some cases remain `[ ]` or `[~]`** → skip to step 12 (no PR yet).

10. **Create PR and return to develop.** Feature is done — open the PR immediately:
    - Run `node tools/workflow-mcp/verify.mjs --base origin/develop` and fix every `FAIL` first — CI runs the same checks on the PR.
    - Follow the `pr-create` skill to draft the body.
    - Open the PR targeting `develop` with `mcp__github__create_pull_request`. **If that tool is not available here** — many environments run without the GitHub MCP server — fall back to `gh pr create --base develop --title "<title>" --body-file <path>`. Don't invent a third route: if neither works, push the branch, hand the human the drafted body, and say the PR is theirs to open.
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

11. **Report to human.** What was done, what's next. If step 4a escalated anything, say so first — a spec question you routed to `/project:interview` outlives this cycle. Then, if step 7a ran, lead with any `critical`/`major` that was filed rather than fixed — that is the one outcome the human most needs to see, and it is easy to lose among the cycle's other notes.
    Then run the **maintenance cadence check**. This is the only place the periodic commands are ever surfaced, so it runs even when the cycle went perfectly — especially then, because a clean cycle is exactly when nobody thinks to lint:

    ```bash
    # Count each cadence independently — never one grep piped to `tail -N` over a
    # combined match set, which drops whichever kind did not run most recently.
    awk '/^## \[[^]]*\] review[[:space:]]*$/{n=0;next} /^## \[[^]]*\] work/{n++} END{print n+0}' docs/wiki/log.md            # work cycles since /project:review
    awk '/^## \[[^]]*\] wiki-maintenance[[:space:]]*$/{n=0;next} /^## \[[^]]*\] work/{n++} END{print n+0}' docs/wiki/log.md  # work cycles since /project:wiki
    grep -cE '^- \[ \] [0-9]{4}-' docs/wiki/wiki-todos.md 2>/dev/null || true                 # maintainer queue depth (dated entries only — the file's own format example is not one)
    grep -c '^- \[ \] .*\[adversary\]' docs/wiki/todos.md 2>/dev/null || true                 # filed findings never triaged
    ```

    Each `awk` resets its counter at the last entry of its own kind and counts the `work` entries after it, so it answers the trigger as written ("5+ work cycles since…") rather than handing you two line numbers to eyeball. A log with no `review` entry yet counts every cycle, which is the right answer.

    Suggest, naming the number that fired:
    - More todos in the same entity → keep going (run `/project:work` again from `develop` or the existing branch if still open).
    - **`/project:review` is due** — 5+ `work` entries in `log.md` since the last `review` entry, or cross-cutting work piling up.
    - **`/project:wiki` is due** — 10+ unticked entries in `wiki-todos.md`, 5+ work cycles since the last `wiki-maintenance` entry, or the `[adversary]` count at or above `FINDINGS_MAX` (`docs/wiki/todos.md § Filed-findings backlog`). Its own trigger heuristics are written inside `wiki.md`, which nobody opens unless they have already decided to run it — this line is what makes them reachable.
    - **A skill is missing** — you hand-rolled a multi-step procedure this cycle that no skill covers, or the stack gained a service. A gap you improvise twice is a missing skill (behavioral rule 17); say which procedure you improvised and point at the `update-toolkit` skill, which is where a gap becomes a real skill.
    - Risky next change → tag a checkpoint first (`git tag checkpoint-$(date -u +%Y%m%dT%H%M%SZ)`).
    - **Every 10th `work` entry**, call `dispatch_stats` and put one line in front of the human: per review role, findings raised vs. acted on, and per developer engine, `red_refuted` and `findings_against`. That is the evidence for keeping the plan-adversary on simple todos, or moving a role to another engine — not an impression.
    - `check` reports `architecture.enforced: false` on a project whose `architecture.md § Layers` is filled → recommend `/project:init` step 5b.

    A due command is a **recommendation, not an interruption** — say it in one line and let the human decide. But say it: an unsurfaced cadence is a dead command, and a health pass nobody runs is a `gotchas.md` that every future session reads and no session prunes.

## Failure modes

- **`inspect_dispatch` rejects a dispatch.** Its reasons say what failed. Fix that cause and re-dispatch into the same task (the failed attempt is archived and counted), or `human-checkpoint` — never accept around it, and never re-send the unchanged brief. Two rejections for the same cause is the two-strike rule.
- **`check` reports a missing grant or an unavailable engine** for a role this cycle needs. Stop before composing anything: `human-checkpoint` naming what is missing.
- **A worktree setup command fails.** Do not dispatch into that worktree. `human-checkpoint` with the command and its output.
- **Planner can't produce a coherent plan.** The spec is too ambiguous. Stop and run `/project:interview` to refine the Behavior cases.
- **Plan-adversary raises a `blocker` you think is wrong.** Not a rejection. `human-checkpoint` with both positions — the brief's and the reviewer's — and let the human settle it before Red.
- **Plan-adversary and planner disagree after a re-plan.** That is round three, which is a decision rather than a review. `human-checkpoint`.
- **Plan-adversary escalates the spec.** Stop the cycle and run `/project:interview`. Do not start Red on a Behavior case with two live readings — that is the exact cost step 4a exists to avoid.
- **Plan-adversary writes anything.** It is read-only and has no owned paths, so any file it touched voids the round. Report it, restore the tree, re-dispatch.
- **Adversary finding survives three rounds.** Don't open a fourth. File the `critical`/`major` ones as todos (the human gate still applies) and let `minor`/`nit` ones go unfiled; for a `critical`/`major` you think is wrong, `human-checkpoint` with both positions stated — the author's and the reviewer's.
- **Adversary edits, commits, or pushes.** The read-only invariant is broken and the round is void. Report it, `git diff` to see what it touched, and re-dispatch after restoring the tree.
- **Developer can't confirm Red.** Stop. The Behavior cases or the test environment is wrong. Use `human-checkpoint`.
- **The red check refutes Red.** The tests pass without the implementation: they test existing behavior, or nothing. Reject the dispatch (`record_decision`) and re-dispatch with the output tail in the brief — never accept around it. The one legitimate exception is a stack whose unit tests live inside the source file (Rust `#[cfg(test)]` modules), where reverting the implementation reverts the test too: brief the case's test into the separate test directory (`tests/`), or accept with `override_mechanical` and a reason naming that layout.
- **The architecture check fails on a case.** Send it back with the check's output: move the code or add a port. A developer asking to loosen a rule is a `human-checkpoint` and, if approved, an ADR in the same commit as the rule change.
- **Developer fails twice on the same mechanism.** Two-strike rule (behavioral rule 5). Tag the state (`git tag checkpoint-<stamp>`), then run `human-checkpoint` with both failed attempts — the `git reset --hard` is the human's call, and `git status --porcelain` must account for every line before it runs (rule 21). On an approved reset, re-spec via `/project:interview`. For complex/batched work, re-dispatch the `planner` to overwrite the plan with a fundamentally different approach before the next `developer` attempt.
- **Test suite has pre-existing failures.** Stop. Don't add work on top of a broken develop. Use `human-checkpoint`.
- **Merge conflicts during branch sync.** Follow the `git-recovery` skill (Resolve merge / rebase / cherry-pick conflicts). If the conflicts are too broad or ambiguous, use `human-checkpoint` rather than guessing.
- **Lost work after a container recycle.** Commits pushed to remote survive; only unpushed local state is gone. Check `git reflog` on the remote via `git ls-remote` — if the branch was pushed, `git fetch origin feat/<slug> && git checkout feat/<slug>` recovers it. If unpushed, re-run from the last open todo.

## What you do NOT do

- **No coding directly.** You dispatch the `planner` (when needed), the `plan-adversary` (every cycle), the `developer`, and the `adversary` (when gated). You can read files and run commands to verify; you don't write tests or production code in this command. Fixes for adversary findings are the exception you hand back to the `developer` if they are more than a line or two.
- **No periodic review.** That's `/project:review`, dispatched separately in a fresh session context. The `reviewer` never runs here — the in-loop second readers are the `plan-adversary` before Red and the `adversary` after it, both read-only (behavioral rule 12).
- **No merging.** PR creation is automated (step 11); merging is always the human's call.
- **No silent batching.** If you batch todos, name the batch in the commit message scope.
