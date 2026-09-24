---
name: work
description: The core development loop — pick the top todo (or a batch sharing context), branch feat/* from develop, plan complex work, put the brief through the plan-adversary, run the developer Red→Green→refactor→wiki one Behavior case at a time, review the diff on complex cycles, and open a PR to develop once the entity is done.
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

The argument **selects the work**, overriding step 1's default of the top todo:

- **Names a todo or entity** (`the login endpoint`, `entities/auth`) → work that. Match it against `docs/wiki/todos.md` lines and entity slugs; if nothing matches, say what you looked for and stop — never pick something adjacent.
- **Asks for a batch** (`batch the auth todos`, `next 3`) → batch those todos on one branch, subject to the batching rule in `feature-branching`.
- **Adds a constraint** (`skip the planner`, `skip the pre-flight`, `tests only`) → honour it and note the deviation in the report.

It never bypasses the preconditions, the Red phase or the entity-page check. Empty → the top todo.

You orchestrate one TDD cycle (or a small batch). You write no tests or production code: you dispatch the `planner` (complex or batched work only), the `plan-adversary`, the `developer` and, on complex cycles, the `adversary`; you verify their output, commit it, log the cycle, and open the PR once the entity is complete.

## How you dispatch

Every dispatch follows the `worker-dispatch` skill — read it before the cycle's first dispatch. On top of it:

- **Each role already receives only its own skills.** Narrow `skills` only when a worker clearly needs less.
- **Inputs outside the worktree** (a baseline, a large fixture) are inlined in `instructions`, or covered by the engine's read grant before dispatch. A denied read ends the run.
- **A developer case is accepted only after Green, architecture and Red are proven.** Pass `test_paths` and `test_command` on every developer dispatch; `inspect_dispatch` stays `incomplete` until you run the returned `red_check_command` (step 6). Prefer the case's test directory to a single file for `test_paths`: a fixture or helper the developer adds beside the test is then kept, not reverted with the implementation.
- **Removals.** Workers cannot delete files. A moved file splits: the worker writes the new path and reports the old one as superseded, and you `git rm` it in the same commit, so git records a rename.

## Preconditions

**Starting fresh, on `develop`:**

- **Clean working tree — clean *and yours*.** Run `git status --porcelain` and account for every line. Changes you did not make are another session's live work: never stash, reset or check out over them (rule 21) — `human-checkpoint`, naming the paths.
- `docs/wiki/todos.md` has at least one item.
- `docs/wiki/commands.md § Test` is not `<TBD>` **and actually runs** — execute it once before dispatching anything. A command that errors (framework missing, no manifest, no test directory) makes every Red fail for the wrong reason. The fix is `/project:init` step 5a, never a skeleton improvised mid-cycle.

Any failure → stop and `human-checkpoint`.

**On a `feat/*` branch:**

- Uncommitted changes, unpushed commits, or entity cases still `[ ]`/`[~]` → stay and continue the feature (step 5).
- Every case `[x]` and pushed → first confirm the PR actually merged (`gh pr view <branch> --json state`, or the merge commit on `develop`) — `[x]`-and-pushed is also true of an open PR. Then `git checkout develop`, `git fetch origin develop && git merge --ff-only origin/develop`, and `git branch -d <branch>` (lowercase `-d` refuses an unmerged branch — a second check).

## Resuming an interrupted cycle

You commit and push after each green case, so a recycled container loses at most the case in flight. Re-run `/project:work`: `git fetch origin feat/<slug>` recovers what was pushed, and the cases still `[ ]`/`[~]` on the entity page are the resume point. A dispatch interrupted with its worktree intact (a rate-limit pause) resumes from its recorded state — `worker-dispatch` § Resuming an interrupted dispatch.

## Steps

1. **Pick the work.**
   - **Fetch first**, so the pick is not already shipped: `git fetch origin develop`. If the candidate's entity page on `origin/develop` has its cases ticked, or `git log origin/develop --oneline --grep='<slug>'` shows it shipped, remove the stale todo line and take the next one. (Read-only; step 2 does the merge.)
   - Take the top item of `docs/wiki/todos.md`, or what the argument named. Skip `[wiki]` lines — they belong to `/project:wiki`.
   - **Steered off P0?** When the argument selects work outside `## Now (P0 — next)`, count the open P0 items (`docs/wiki/todos.md § P0 saturation threshold`). At or above `P0_MAX`, `human-checkpoint` first — the count, the oldest P0 entries, and what the argument asked for: skipping a saturated P0 is the human's call. The default path drains P0 and needs no check.
   - If the next 1–3 todos share an entity and context, propose a batch; `human-checkpoint` if the batch is not obvious.
   - Find the matching `docs/wiki/entities/<slug>.md`. Missing → stop and recommend `/project:interview`.
   - **`[infra]` todos** (deployment, CI, environment, configuration) name a `docs/wiki/concepts/<slug>.md` page instead, whose `## Behavior` holds verifiable operational assertions ("a request without `X-Edge-Secret` gets 403"). Everything else is unchanged — Red first, committed per case, logged.

2. **Fetch and branch.** Run the "Starting work" blocks of the `feature-branching` skill with `<type>/<slug>` = `feat/<slug>`. Any `--ff-only` failure or a diverged `origin/feat/<slug>` → stop and `human-checkpoint`; never rebase or force-push over it. No remote → the skill's guard skips fetch and merge, and every push in this command is skipped and noted in the report.

3. **Verify the Behavior cases.** Read `## Behavior` on the entity page (or the `[infra]` concept page). Its unimplemented `[ ]` cases are the test target. Empty or vague → stop: `/project:interview` or the `spec-writing` skill defines them first. **Config and deploy changes are behavior** — middleware, an auth header, a CORS rule each takes a failing test first like any other case.

4. **Plan, if complex or batched.** A `[complex]` todo or a batch of 2+ → dispatch the `planner` with the entity slug(s), the batch contents, this cycle's case IDs and the test command from `docs/wiki/commands.md`. It is read-only and returns the plan in its report: **save it to `.handoff/<slug>-plan.md`** (gitignored scratch) and pass that path as `instructions_file` in steps 4a and 5 — the MCP inlines the file's text, so the plan never passes through a tool call twice and no worker is handed a path. Sanity-check it: the steps cover the listed cases and the scope has not drifted. Wrong → send it back once; a second failure means re-spec via `/project:interview`. A single simple todo skips this step.

4a. **Review the brief — every cycle, before any test.** Dispatch the `plan-adversary` and run the brief round of the `finding-disposition` skill.
   - The subject is exactly one of: the step 4 plan (`instructions_file: .handoff/<slug>-plan.md`), or on a simple cycle the todo line plus the `$ARGUMENTS` instruction verbatim. Add the entity slug(s), case IDs, test command and branch name — **nothing else**. Your own reading of the plan is the framing that turns a review into agreement.
   - Dispose of every finding before the developer runs. **Applied** (the default) edits the plan file step 5 sends, or the todo line. **Escalated** — the spec is what is wrong — is a `human-checkpoint` recommending `/project:interview`, and the cycle stops. **Rejected** takes one sentence. A `blocker` you disagree with is a checkpoint, never a rejection.
   - Re-dispatch the `planner` only for a structural blocker (wrong decomposition, impossible order), once. Apply everything smaller yourself.
   - Unlike step 7a this is not gated on `[complex]`: a one-line todo is where an unstated assumption travels furthest. `skip the pre-flight` turns it off; say so in the report.

5. **Dispatch the `developer`, one Behavior case per dispatch,** with:
   - the entity slug, the branch name, the case ID and the test command;
   - the plan **as revised in step 4a**, if there is one — `instructions_file: .handoff/<slug>-plan.md`, never a pre-review copy;
   - `owned_paths`: the case's source and test paths, the entity page, `docs/wiki/gotchas.md` and `docs/wiki/decisions` (its skills edit those inline). **Never** `todos.md`, `wiki-todos.md` or `log.md` — the developer hands lines for those back under `Follow-ups:` — and never a path under `protectedPaths` or `architecture.rules` (composition refuses it);
   - `test_paths` (inside `owned_paths`) and `test_command` (verbatim from `commands.md`) — what step 6 re-runs;
   - a `commit_message` for the case.

   The developer runs Red → Green → refactor → tick, leaves the result as files and runs no git. **You commit once per case** (`docs/wiki/git-conventions.md` § Cadence), before dispatching the next — that keeps the history per case. Anything changed outside `owned_paths` is a defect: read it before deciding, and never widen ownership after the fact.

6. **Verify Green, architecture and Red before accepting the case** — one command, the `red_check_command` (also in `inspect_dispatch` → `red.command`). It runs the test command with the developer's files in place (**Green**, the full suite, no regression), then the architecture check if `config.json` has one, then reverts every non-test file the developer changed and runs the tests again (**Red**: they must now fail), restoring the files byte for byte. It prints a verdict line per phase and only the output tail of the run that decided. Exit 0 = proven; exit 1 = not green, architecture failing, **refuted** (the tests pass without the implementation) or timed out — `inspect_dispatch` rejects the first three whatever the report says; 2 = a phase could not run. On a proven case, read the red tail: it must show the missing behavior (an assertion, or the not-yet-written symbol), not a broken fixture. Interrupted → re-run it with `--restore` first. Don't re-run the suite by hand to confirm what it recorded.
   - **Follow-ups** the developer handed back for `todos.md`/`wiki-todos.md` are yours to append in the case commit.
   - **A case the worker could not verify** — its check needs a command outside the allowlist (a GUI application, a machine-specific runner, a service without credentials) — is yours to run before the commit claims it done. The developer names such a case in its first report on it. A substitute harness can fail *as a pass* (a script it never executes exits 0), so run the real thing and read its output. If you cannot run it either, the case stays `[~]` and the report says so.

   Output that doesn't hold up goes back with notes, once; a second failure on the same mechanism is the two-strike rule (Failure modes).

7. **Wiki check.** The entity page has the case ticked (`[~]` → `[x]`) and `## Implementation`/`## Tests` match the files. Remove the finished todo from `docs/wiki/todos.md` yourself, in the last case's commit.

7a. **Adversarial review — `[complex]` and batched cycles only.** Dispatch the `adversary` and run the diff round of the `finding-disposition` skill (what to send, triage, dispositions, round commit, re-review, stop conditions, recording the counts).
   - Pass `diff_range` for a small commit range (one case or a few closely related), with the entity slug(s), case IDs and test command. **Never** the plan file or your reasoning — the independence is the product.
   - For a second opinion before disposing, dispatch the read-only `triage` role with the same `diff_range`, slug, case IDs and the findings verbatim — not the `developer`. You own the severity, the `human-checkpoint` for `critical`/`major`, the todo lines and the round commit. The `developer` is dispatched only for a fix the human approved.
   - The review does not gate the cycle: open filed findings belong to the queue.

   A simple single todo skips this step; the human can run `/project:adversary`.

8. **Log, commit and push** per [`log-and-commit.md`](../skills/feature-branching/log-and-commit.md) — kind `work`, fields `TODO(s)`, `Cases: B1, B2`, `Branch: feat/<slug>`, `Plan review: <N> findings — <A> applied, <E> escalated, <R> rejected` followed by one line per finding (the log is that review's only committed record), and `Adversary: <N> findings — <Fi> filed, <Fx> fixed, <R> rejected` (omit it if step 7a did not run; omit the plan review only if the argument skipped step 4a). Stage `docs/wiki/log.md` alone; subject `docs(<slug>): log cycle`. This is the one commit `/project:work` makes on its own account — the cases and review records are already committed.

   Delete `.handoff/<slug>-plan.md`. Confirm `git status --porcelain` is empty and `git log --oneline develop..HEAD` reads as one commit per case.

9. **Feature complete?** Re-read the entity's `## Behavior`. All `[x]` → step 10. Otherwise → step 11, no PR yet.

10. **Open the PR.** Run `node tools/workflow-mcp/verify.mjs --base origin/develop` and fix every `FAIL` — CI runs the same checks. Then follow the `pr-create` skill: it drafts the body, opens the PR against `develop`, commits the `pr` log entry, and returns to `develop`.

11. **Report.** What was done and what is next. Lead with anything step 4a escalated, then any `critical`/`major` from step 7a that was filed rather than fixed. Then run the **maintenance cadence check** — the only place the periodic commands are surfaced, so run it even after a perfect cycle:

    ```bash
    # Each counter resets at the last entry of its own kind.
    awk '/^## \[[^]]*\] review[[:space:]]*$/{n=0;next} /^## \[[^]]*\] work/{n++} END{print n+0}' docs/wiki/log.md            # work cycles since /project:review
    awk '/^## \[[^]]*\] wiki-maintenance[[:space:]]*$/{n=0;next} /^## \[[^]]*\] work/{n++} END{print n+0}' docs/wiki/log.md  # work cycles since /project:wiki
    grep -cE '^- \[ \] [0-9]{4}-' docs/wiki/wiki-todos.md 2>/dev/null || true   # maintainer queue depth
    grep -c '^- \[ \] .*\[adversary\]' docs/wiki/todos.md 2>/dev/null || true   # open filed findings
    ```

    Recommend, one line each and naming the number that fired — the human decides:
    - More todos in this entity → `/project:work` again.
    - `/project:review` — 5+ `work` entries since the last `review`, or cross-cutting work piling up.
    - `/project:wiki` — 10+ open `wiki-todos.md` entries, 5+ `work` entries since the last `wiki-maintenance`, or the `[adversary]` count at `FINDINGS_MAX` (`docs/wiki/todos.md § Filed-findings backlog`).
    - A missing skill — a multi-step procedure you hand-rolled this cycle, or a new service in the stack → the `update-toolkit` skill (rule 17).
    - A risky next change → `git tag checkpoint-$(date -u +%Y%m%dT%H%M%SZ)` first.
    - Every 10th `work` entry: `dispatch_stats`, reduced to one line per review role (findings raised vs. acted on) and per developer engine (`red_refuted`, `green_failed`, `findings_against`) — the evidence for keeping the plan-adversary on simple todos, or moving a role to another engine.
    - `check` reports `architecture.enforced: false` while `architecture.md § Layers` is filled → `/project:init` step 5b.

## Failure modes

- **`inspect_dispatch` rejects.** Fix the named cause and re-dispatch into the same task, or `human-checkpoint` — never accept around it or re-send an unchanged brief. Two rejections for one cause is the two-strike rule.
- **`check` reports a missing grant or engine** for a role this cycle needs → `human-checkpoint` before composing anything.
- **A worktree setup command fails** → never dispatch into that worktree; `human-checkpoint` with the command and its output.
- **The planner cannot produce a coherent plan** → the spec is too ambiguous: `/project:interview`.
- **The plan-adversary raises a `blocker` you think is wrong**, or it and the planner still disagree after a re-plan → `human-checkpoint` with both positions, before Red.
- **The plan-adversary escalates the spec** → stop the cycle and run `/project:interview`. Never start Red on a case with two live readings.
- **A read-only reviewer changes anything** (plan-adversary or adversary) → the round is void: report it, restore the tree, re-dispatch.
- **Adversary findings survive three rounds** → no fourth: file the `critical`/`major` ones (the human gate still applies), list the `minor`/`nit` ones unfiled in the round commit, and `human-checkpoint` any `critical`/`major` you think is wrong, with both positions.
- **The developer cannot confirm Red** → the cases or the test environment are wrong: `human-checkpoint`.
- **The red check is not green, fails the architecture check, or refutes Red** → reject (`record_decision`) and re-dispatch with the deciding output tail in the brief. The one exception is tests that live inside the source file (Rust `#[cfg(test)]`), where reverting the code reverts the test: brief the test into `tests/`, or accept with `override_mechanical` and a reason naming that layout.
- **The architecture check fails** → send it back with the check's output: move the code or add a port. A request to loosen a rule is a `human-checkpoint` and, if approved, an ADR in the same commit as the rule change.
- **Two failures on one mechanism** → rule 5: tag `checkpoint-<stamp>` and `human-checkpoint` with both attempts; the `git reset --hard` is the human's call, after `git status --porcelain` accounts for every line. On an approved reset, re-spec via `/project:interview`; for complex work, re-dispatch the `planner` for a fundamentally different approach first.
- **Pre-existing test failures on `develop`** → stop; `human-checkpoint`. Never build on a broken base.
- **Merge conflicts during a sync** → the `git-recovery` skill; `human-checkpoint` if they are broad or ambiguous.
- **Work lost to a container recycle** → pushed commits survive (`git fetch origin feat/<slug> && git checkout feat/<slug>`); unpushed work re-runs from the open todo.

## What you do NOT do

- **No coding.** You read files and run commands to verify; tests and code come from the `developer`, including fixes for approved findings.
- **No periodic review.** The `reviewer` runs only under `/project:review`; the in-loop readers are the `plan-adversary` and the `adversary` (rule 12).
- **No merging.** Merging the PR is always the human's call.
- **No silent batching.** A batch is named in the branch, the commit scope and the PR.
