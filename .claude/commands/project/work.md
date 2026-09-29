---
description: The core development loop — pick the top todo (or a batch sharing context), branch feat/* from develop, plan complex work, put the brief through the plan-adversary, run the developer Red→Green→refactor→wiki one Behavior case at a time, review the diff on complex cycles, and open a PR to develop once the entity is done.
argument-hint: '[fast | handoff] [todo, entity, or scope — e.g. "the login endpoint" | "fast batch the auth todos"]'
disable-model-invocation: true
---

# /project:work

**Argument:** `$ARGUMENTS`

The argument **selects the work**, overriding step 1's default of the top todo:

- **Names a todo or entity** (`the login endpoint`, `entities/auth`) → work that. Match it against `docs/wiki/todos.md` lines and entity slugs; if nothing matches, say what you looked for and stop — never pick something adjacent.
- **Asks for a batch** (`batch the auth todos`, `next 3`) → batch those todos on one branch, subject to the batching rule in `feature-branching`.
- **Adds a constraint** (`skip the planner`, `skip the pre-flight`, `tests only`) → honour it and note the deviation in the report.

A leading `fast` or `handoff` is the **dispatch mode**, stripped before the rest is read (`subagent-dispatch` § Dispatch mode). It never bypasses the preconditions, the Red phase or the entity-page check. Empty → the top todo.

## State at invocation

Branch: !`git branch --show-current`

```!
git status --short
```

You orchestrate one TDD cycle (or a small batch). You write no tests or production code: you dispatch the `planner` (complex or batched work only), the `plan-adversary`, the `developer` and, on complex cycles, the `adversary`; you verify their output, commit it, log the cycle, and open the PR once the entity is complete.

## How you dispatch

Every dispatch follows the `subagent-dispatch` skill — load it before the cycle's first dispatch; it runs each one natively or as a handoff file, per the dispatch mode. On top of it:

- **Each role already carries its own skills** and model; the brief carries only the task.
- **Inputs are paths in this checkout or text in the brief.** The plan travels as `.handoff/<slug>-plan.md`; nothing is pasted that a role can read.
- **A developer case is accepted only after Green, architecture and Red are proven** — the commit-first check in `subagent-dispatch` (step 6).
- **Roles run no git.** You commit, push, and stage any files a developer reported moved or deleted.

## Preconditions

**Starting fresh, on `develop`:**

- **Clean working tree — clean *and yours*.** The state block above, every line accounted for. Changes you did not make are another session's live work: never stash, reset or check out over them (rule 21) — `human-checkpoint`, naming the paths.
- `docs/wiki/todos.md` has at least one item.
- `docs/wiki/commands.md § Test` is not `<TBD>` **and actually runs** — execute it once before dispatching anything, with an explicit shell timeout. A command that errors (framework missing, no manifest, no test directory) makes every Red fail for the wrong reason. The fix is `/project:init` step 5a, never a skeleton improvised mid-cycle.
- The test command (and the architecture check, if any) is allowlisted for the roles — `subagent-dispatch` § Before the cycle's first dispatch.

Any failure → stop and `human-checkpoint`.

**On a `feat/*` branch:**

- Uncommitted changes, unpushed commits, or entity cases still `[ ]`/`[~]` → stay and continue the feature (step 5). Uncommitted changes first: every dispatch needs a clean tree. Account for every path (rule 21) — a case you verified but had not committed is yours to commit, anything else is a `human-checkpoint` — then push what is unpushed.
- Every case `[x]` and pushed → first confirm the PR actually merged (`gh pr view <branch> --json state`, or the merge commit on `develop`) — `[x]`-and-pushed is also true of an open PR. Then `git checkout develop`, `git fetch origin develop && git merge --ff-only origin/develop`, and `git branch -d <branch>` (lowercase `-d` refuses an unmerged branch — a second check).

## Resuming an interrupted cycle

You commit and push after each proven case, and the plan review's record before the first one (step 4a), so a recycled container loses at most the case in flight. Re-run `/project:work`: `git fetch origin feat/<slug>` recovers what was pushed, and the cases still `[ ]`/`[~]` on the entity page are the resume point. The plan itself is scratch: if `.handoff/<slug>-plan.md` is gone on a `[complex]` cycle, re-dispatch the `planner` for the remaining cases and re-apply the dispositions the log entry records rather than re-reviewing from scratch. A developer's uncommitted files from an interrupted dispatch: `subagent-dispatch` § Resuming after an interruption.

## Steps

1. **Pick the work.**
   - **Fetch first**, so the pick is not already shipped: `git fetch origin develop`. Treat a todo as shipped only on evidence: its line is gone from `git show origin/develop:docs/wiki/todos.md` (a cycle's last case commit removes it — step 7), or you can name the commit on `origin/develop` that did its work. Then drop the stale line and take the next one. An entity with every case ticked is no evidence on its own: filed findings and review todos target shipped entities. (Read-only; step 2 does the merge.)
   - Take the top item of `docs/wiki/todos.md`, or what the argument named.
   - **Steered off P0?** When the argument selects work outside `## Now (P0 — next)`, count the open P0 items (`docs/wiki/todos.md § P0 saturation threshold`). At or above `P0_MAX`, `human-checkpoint` first — the count, the oldest P0 entries, and what the argument asked for: skipping a saturated P0 is the human's call. The default path drains P0 and needs no check.
   - If the next 1–3 todos share an entity and context, propose a batch; `human-checkpoint` if the batch is not obvious.
   - Find the matching `docs/wiki/entities/<slug>.md`. Missing → stop and recommend `/project:interview`.
   - **`[infra]` todos** (deployment, CI, environment, configuration) name a `docs/wiki/concepts/<slug>.md` page instead, whose `## Behavior` holds verifiable operational assertions ("a request without `X-Edge-Secret` gets 403"). Everything else is unchanged — Red first, committed per case, logged.

2. **Fetch and branch.** Run the "Starting work" blocks of the `feature-branching` skill with `<type>/<slug>` = `feat/<slug>`. Any `--ff-only` failure or a diverged `origin/feat/<slug>` → stop and `human-checkpoint`; never rebase or force-push over it. No remote → the skill's guard skips fetch and merge, and every push in this command is skipped and noted in the report.

3. **Verify the Behavior cases.** Read `## Behavior` on the entity page (or the `[infra]` concept page). Its unimplemented `[ ]` cases are the test target. Empty or vague → stop: `/project:interview` or the `spec-writing` skill defines them first. **Config and deploy changes are behavior** — middleware, an auth header, a CORS rule each takes a failing test first like any other case.
   - **A todo with no open case to work** — a filed `[adversary]` finding, a `/project:review` todo or a bug against an entity whose cases are all `[x]` — gets its case before anything else: append the next `B<N>` from the finding's failure scenario (`spec-writing`), stated as the behavior the code must show, then commit the entity page alone (`docs(<slug>): specify B<N> — <todo>`) and push. The plan-adversary reviews it with the brief in step 4a. A finding that disagrees with an existing case is a spec question → `/project:interview`.

4. **Plan, if complex or batched.** A `[complex]` todo or a batch of 2+ → dispatch the `planner` with the entity slug(s), the batch contents, this cycle's case IDs, the test command from `docs/wiki/commands.md`, and the path to write: `.handoff/<slug>-plan.md` (gitignored scratch). Read the plan it wrote and sanity-check it: the steps cover the listed cases and the scope has not drifted. Wrong → send it back once; a second failure means re-spec via `/project:interview`. A single simple todo skips this step.

4a. **Review the brief — every cycle, before any test.** Dispatch the `plan-adversary` and run the brief round of the `finding-disposition` skill.
   - The subject is exactly one of: the step 4 plan (by path), or on a simple cycle the todo line plus the `$ARGUMENTS` instruction verbatim. Add the entity slug(s), case IDs, test command and branch name — **nothing else**. Your own reading of the plan is the framing that turns a review into agreement.
   - Dispose of every finding before the developer runs. **Applied** (the default) edits `.handoff/<slug>-plan.md`, or the todo line. **Escalated** — the spec is what is wrong — is a `human-checkpoint` recommending `/project:interview`, and the cycle stops. **Rejected** takes one sentence. A `blocker` you disagree with is a checkpoint, never a rejection.
   - Re-dispatch the `planner` only for a structural blocker (wrong decomposition, impossible order), once. Apply everything smaller yourself.
   - **Commit the record before any test.** Open this cycle's `work` entry in `docs/wiki/log.md` now (`log-and-commit.md`), with `TODO(s)`, `Branch` and the `Plan review` block (step 8's format), and commit it alone on the branch — `docs(<slug>): plan review` — and push. The plan is gitignored scratch and the dispositions exist nowhere else, so a recycled container would otherwise lose them (rule 20). Step 8 completes the same entry.
   - Unlike step 7a this is not gated on `[complex]`: a one-line todo is where an unstated assumption travels furthest. `skip the pre-flight` turns it off; say so in the report.

5. **Dispatch the `developer`, one Behavior case per dispatch,** with:
   - the entity slug, the branch name, the case ID and the test command;
   - the plan **as revised in step 4a**, by path, if there is one;
   - the scope: the case's source and test paths, the entity page, `docs/wiki/gotchas.md` and `docs/wiki/decisions/` (its skills edit those inline). **Never** `todos.md`, `wiki-todos.md` or `log.md` — the developer hands lines for those back under `Follow-ups:` — and never `.claude/` or the architecture rule files;
   - the instruction to report test paths and implementation paths separately — step 6 re-proves Red from them.

   The developer runs Red → Green → refactor → tick and leaves the result as files. **You commit once per case** (`docs/wiki/git-conventions.md` § Cadence), before dispatching the next — that keeps the history per case. Anything changed outside the scope is a defect: read it before deciding, and never widen the scope after the fact.

6. **Prove and commit the case** — `subagent-dispatch` § Prove and commit a developer case: Green (the full suite), the architecture check, the case commit, then Red against it (everything but the test paths restored from the parent commit; the tests must fail), and only then the push. On a proven case, read the Red output: it must show the missing behavior (an assertion, or the not-yet-written symbol), not a broken fixture.
   - **Follow-ups** the developer handed back for `todos.md`/`wiki-todos.md` are yours to append in the case commit.
   - **A case the developer could not verify** is yours to run before the commit claims it done (`subagent-dispatch`). If you cannot run it either, the case stays `[~]` and the report says so.

   Output that doesn't hold up goes back with notes, once; a second failure on the same mechanism is the two-strike rule (Failure modes).

7. **Wiki check.** The entity page has the case ticked (`[~]` → `[x]`) and `## Implementation`/`## Tests` match the files. Remove the finished todo from `docs/wiki/todos.md` yourself, in the last case's commit.

7a. **Adversarial review — `[complex]` and batched cycles only.** Dispatch the `adversary` and run the diff round of the `finding-disposition` skill (what to send, triage, dispositions, round commit, re-review, stop conditions).
   - Pass the commit range for a small unit (one case or a few closely related), with the entity slug(s), case IDs and test command. **Never** the plan file or your reasoning — the independence is the product.
   - For a second opinion before disposing, dispatch the read-only `triage` role with the same range, slug, case IDs and the findings verbatim — not the `developer`. You own the severity, the `human-checkpoint` for `critical`/`major`, the todo lines and the round commit. The `developer` is dispatched only for a fix the human approved.
   - The review does not gate the cycle: open filed findings belong to the queue.

   A simple single todo skips this step; the human can run `/project:adversary`.

8. **Log, commit and push** per [`log-and-commit.md`](../../skills/feature-branching/log-and-commit.md) — complete the `work` entry step 4a opened (open it now if the argument skipped step 4a): kind `work`, fields `TODO(s)`, `Cases: B1, B2`, `Branch: feat/<slug>`, `Plan review: <N> findings — <A> applied, <E> escalated, <R> rejected` followed by one line per finding (the log is that review's only committed record), and `Adversary: <N> findings — <Fi> filed, <Fx> fixed, <R> rejected` (omit it if step 7a did not run). Stage `docs/wiki/log.md` alone; subject `docs(<slug>): log cycle`. With step 4a's, these are the commits `/project:work` makes on its own account — the cases and review records are already committed.

   Delete `.handoff/<slug>-plan.md`, and any handoff pair the cycle left behind (`dispatch-handoff` step 8). Confirm `git status --porcelain` is empty and `git log --oneline develop..HEAD` reads as one commit per case, plus the review and log records.

9. **Feature complete?** Re-read the entity's `## Behavior`. All `[x]` → step 10. Otherwise → step 11, no PR yet.

10. **Open the PR** — the `pr-create` skill: its pre-PR checks, the body, the PR against `develop`, the `pr` log entry, and the return to `develop`.

11. **Report.** What was done and what is next. Lead with the checkpoint that ended a fast-mode run and the defaults it took (`human-checkpoint` § Fast mode), then anything step 4a escalated, then any `critical`/`major` from step 7a that was filed rather than fixed. Then run the **maintenance cadence check** — the only place the periodic commands are surfaced, so run it even after a perfect cycle:

    ```bash
    # Each counter resets at the last entry of its own kind.
    awk '/^## \[[^]]*\] review([[:space:]]|$)/{n=0;next} /^## \[[^]]*\] work/{n++} END{print n+0}' docs/wiki/log.md            # work cycles since /project:review
    awk '/^## \[[^]]*\] wiki-maintenance([[:space:]]|$)/{n=0;next} /^## \[[^]]*\] work/{n++} END{print n+0}' docs/wiki/log.md  # work cycles since /project:wiki
    grep -cE '^- \[ \] [0-9]{4}-' docs/wiki/wiki-todos.md 2>/dev/null || true   # maintainer queue depth
    grep -c '^- \[ \] .*\[adversary\]' docs/wiki/todos.md 2>/dev/null || true   # open filed findings
    ```

    Recommend, one line each and naming the number that fired — the human decides:
    - More todos in this entity → `/project:work` again.
    - `/project:review` — 5+ `work` entries since the last `review`, or cross-cutting work piling up.
    - `/project:wiki` — 10+ open `wiki-todos.md` entries, 5+ `work` entries since the last `wiki-maintenance`, or the `[adversary]` count at `FINDINGS_MAX` (`docs/wiki/todos.md § Filed-findings backlog`).
    - A missing skill — a multi-step procedure you hand-rolled this cycle, or a new service in the stack → the `update-toolkit` skill (rule 17).
    - A risky next change → `git tag checkpoint-$(date -u +%Y%m%dT%H%M%SZ)` first.
    - `docs/wiki/commands.md § Architecture` still `<TBD>` while `architecture.md § Layers` is filled → `/project:init` step 5b.

## Failure modes

- **A role missing from the Agent tool's list**, or the test command not allowlisted for the roles → fix it (`subagent-dispatch` § Before the cycle's first dispatch) before briefing anything.
- **The planner cannot produce a coherent plan** → the spec is too ambiguous: `/project:interview`.
- **The plan-adversary raises a `blocker` you think is wrong**, or it and the planner still disagree after a re-plan → `human-checkpoint` with both positions, before Red.
- **The plan-adversary escalates the spec** → stop the cycle and run `/project:interview`. Never start Red on a case with two live readings.
- **A read-only reviewer changes anything** (plan-adversary or adversary) → the round is void: report it, restore the tree, re-dispatch.
- **Adversary findings survive three rounds** → no fourth: file the `critical`/`major` ones (the human gate still applies), list the `minor`/`nit` ones unfiled in the round commit, and `human-checkpoint` any `critical`/`major` you think is wrong, with both positions.
- **The developer cannot confirm Red** → the cases or the test environment are wrong: `human-checkpoint`.
- **Green fails, the architecture check fails, or Red is refuted** → roll the case back to uncommitted (`subagent-dispatch`) and send it back with the deciding output tail. The one exception is tests that live inside the source file (Rust `#[cfg(test)]`): brief the test into its own file, or `human-checkpoint` an exception naming that layout.
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
