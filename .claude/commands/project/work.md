---
description: The core development loop — pick the top todo (or a batch sharing context), branch feat/* from develop, plan complex work, put the brief through the plan-adversary, run the developer Red→Green→refactor→wiki one Behavior case at a time, review the diff on complex cycles, and open a PR to develop once the entity is done.
argument-hint: '[fast | handoff] [todo, entity, or scope — e.g. "the login endpoint" | "fast batch the auth todos"]'
disable-model-invocation: true
---

# /project:work

**Argument:** `$ARGUMENTS`

The argument **selects the work**, overriding step 1's default of the top todo:

- **Names a todo or entity** (`the login endpoint`, `entities/auth`) → match against `docs/wiki/todos.md` lines and entity/concept slugs; if nothing matches, report what you looked for and stop.
- **Asks for a batch** (`batch the auth todos`, `next 3`) → batch those todos on one branch per `feature-branching § Batching todos`.
- **Adds a constraint** (`skip the planner`, `skip the pre-flight`, `tests only`) → honour it and note the deviation in the report.

A leading `fast` or `handoff` sets the **dispatch mode** (`subagent-dispatch § Dispatch mode`) and is stripped before reading the rest. It never bypasses preconditions, Red, or the entity-page check. Empty → the top todo.

## State at invocation

Branch: !`git branch --show-current`

```!
git status --short
```

You orchestrate one TDD cycle (or batch). You write no tests or production code: you dispatch `planner` (`[complex]`/batched work), `plan-adversary`, `developer`, and (`[complex]`/batched cycles) `adversary`; verify and commit their output; log the cycle; and open the PR once the entity is complete.

## How you dispatch

Load and follow `subagent-dispatch` before the first dispatch:

- **Scoped briefs only:** each role carries its own skills and model; pass files by path (`.handoff/<slug>-plan.md`), never pasted.
- **Prove every developer case** (Green, architecture check, commit, Red proof, push) per `subagent-dispatch § Prove and commit a developer case`.
- **Roles run no git:** you stage, commit, and push.

## Preconditions

**Starting fresh on `develop`:**
- **Clean working tree:** account for every line in `git status --short` (rule 21 — foreign changes trigger `human-checkpoint`).
- `docs/wiki/todos.md` has at least one item.
- `docs/wiki/commands.md § Test` is not `<TBD>` and **executes cleanly** (run it once with an explicit timeout before dispatching; if missing or broken, run `/project:init` step 5a).
- The test command and architecture check are allowlisted in `.claude/settings.json` (`subagent-dispatch § Before the cycle's first dispatch`).

**On a `feat/*` (or `fix/*`) branch:**
- Uncommitted changes, unpushed commits, or cases still `[ ]`/`[~]` → account for every path (rule 21), commit any verified case, push unpushed commits, and resume at step 5.
- Every case `[x]` and pushed → verify the PR merged (`gh pr view <branch> --json state` or merge commit on `develop`), then `git checkout develop && git fetch origin develop && git merge --ff-only origin/develop && git branch -d <branch>`.

## Resuming an interrupted cycle

Pushed cases and the step-4a plan review commit survive container recycles. Re-run `/project:work`: `git fetch origin feat/<slug>` recovers pushed work, and `[ ]`/`[~]` cases on the entity page mark the resume point. If `.handoff/<slug>-plan.md` is missing on a `[complex]` cycle, re-dispatch `planner` for the remaining cases and re-apply the dispositions recorded in `docs/wiki/log.md`. Handle uncommitted developer files per `subagent-dispatch § Resuming after an interruption`.

## Steps

1. **Pick the work.**
   - **Fetch first:** `git fetch origin develop`. If the top todo line is already gone from `git show origin/develop:docs/wiki/todos.md` (or a commit on `origin/develop` shipped it), remove the stale line and pick the next.
   - Select the top item of `docs/wiki/todos.md`, or what `$ARGUMENTS` named.
   - **Steered off P0?** If `$ARGUMENTS` selects work outside `## Now (P0 — next)`, count open P0 items (`docs/wiki/todos.md § P0 saturation threshold`). At or above `P0_MAX`, run `human-checkpoint` first.
   - If the next 1–3 todos share an entity and sequential dependency (`feature-branching § Batching todos`), propose a batch (`human-checkpoint` if non-obvious).
   - Locate `docs/wiki/entities/<slug>.md` (or `docs/wiki/concepts/<slug>.md` for `[infra]` todos, whose `## Behavior` holds verifiable operational assertions). If missing → stop and recommend `/project:interview`.

2. **Fetch and branch.** Run `feature-branching § Starting work` for `feat/<slug>` (or `fix/<slug>`). Any `--ff-only` failure or diverged remote branch → `human-checkpoint`.

3. **Verify the Behavior cases.** Read `## Behavior` on the entity/concept page; its `[ ]` cases are the targets (if empty or vague, stop for `/project:interview` or `spec-writing`).
   - **Todo with no open `[ ]` case** (a filed `[adversary]` finding, `/project:review` item, or bug on an entity whose cases are all `[x]`): append a new `B<N>` case from the failure scenario (`spec-writing`), commit the entity page alone (`docs(<slug>): specify B<N> — <todo>`), and push before step 4. If the finding contradicts an existing case, escalate to `/project:interview`.

4. **Plan, if `[complex]` or batched (2+ todos).** Dispatch `planner` with entity slug(s), todo lines, case IDs, test command, and output path `.handoff/<slug>-plan.md`. Verify the plan covers all listed cases without scope drift (send back once if flawed; second failure → `/project:interview`). Simple single todos skip this step.

4a. **Review the brief — every cycle, before any test** (unless `$ARGUMENTS` says `skip the pre-flight`). Dispatch `plan-adversary` and run `finding-disposition § Brief round`:
   - Pass **only** the subject (`.handoff/<slug>-plan.md` or the verbatim todo line + `$ARGUMENTS`), entity slug(s), case IDs, test command, and branch name.
   - Dispose of every finding: **Applied** (default — edits `.handoff/<slug>-plan.md` on a planned cycle, or on a simple cycle records the refinement to pass in step 5's `Inputs:` brief and updates `docs/wiki/todos.md` if needed), **Escalated** (`human-checkpoint` → `/project:interview`), or **Rejected** (one sentence; contested `blocker` → `human-checkpoint`). Re-dispatch `planner` once only for a structural blocker.
   - **Commit the record before Red:** open this cycle's `work` entry in `docs/wiki/log.md` with `TODO(s)`, `Branch`, and the `Plan review` block, stage `docs/wiki/log.md` (plus `docs/wiki/todos.md` if edited), commit `docs(<slug>): plan review`, and push.

5. **Dispatch `developer`, one Behavior case per dispatch**, with:
   - entity slug, branch name, single case ID, and test command;
   - `.handoff/<slug>-plan.md` (if planned) or any Applied brief refinements from step 4a (if simple);
   - `Scope:` the case's source and test paths, the entity/concept page, `docs/wiki/gotchas.md`, and `docs/wiki/decisions/` (never `todos.md`, `wiki-todos.md`, `log.md`, `.claude/`, or architecture rule files);
   - instruction to report **test paths** and **implementation paths** separately.

6. **Prove and commit the case** per `subagent-dispatch § Prove and commit a developer case` (Green → architecture check → commit with any `Follow-ups:` appended to `todos.md`/`wiki-todos.md` → Red check with implementation restored to `HEAD~1` → restore `HEAD` → push). Send back once on failure; two failures on the same mechanism trigger rule 5.

7. **Wiki check.** Confirm the entity/concept page has the case ticked (`[x]`) and `## Implementation` / `## Tests` updated. Remove the completed todo from `docs/wiki/todos.md` in the final case's commit.

7a. **Adversarial review — `[complex]` and batched cycles only.** Dispatch `adversary` and run `finding-disposition § Diff round` over `<sha-before-cases>..HEAD`:
   - Optionally dispatch `triage` for a second opinion. Gate `critical`/`major` findings via one `human-checkpoint`, dispatch `developer` only for human-approved fixes, commit each round's dispositions to `docs/wiki/todos.md` (`docs(<slug>): adversary round N`), and re-review only fix commits (max 3 rounds).

8. **Log, commit and push** per [`log-and-commit.md`](../../skills/feature-branching/log-and-commit.md) — complete the `work` entry opened in step 4a (or open it now if step 4a was skipped): kind `work`, fields `TODO(s)`, `Cases: B1, B2`, `Branch: feat/<slug>`, `Plan review: ...`, and `Adversary: <N> findings — <Fi> filed, <Fx> fixed, <R> rejected` (if step 7a ran). Stage `docs/wiki/log.md` alone; subject `docs(<slug>): log cycle`. Delete `.handoff/<slug>-plan.md` and any `.handoff/<slug>-*-*.md` handoff files, and confirm `git status --porcelain` is empty.

9. **Feature complete?** Check `## Behavior` on the entity/concept page. All `[x]` → step 10; otherwise → step 11.

10. **Open the PR** per `pr-create` (pre-PR checks, PR body against `develop`, `pr` log entry, checkout `develop`).

11. **Report.** Lead with any `fast`-mode stopping checkpoint and defaults taken (`human-checkpoint § Fast mode`), any step-4a escalation, and any `critical`/`major` finding filed rather than fixed. Then run the **maintenance cadence check**:

    ```bash
    awk '/^## \[[^]]*\] review([[:space:]]|$)/{n=0;next} /^## \[[^]]*\] work/{n++} END{print n+0}' docs/wiki/log.md            # work cycles since /project:review
    awk '/^## \[[^]]*\] wiki-maintenance([[:space:]]|$)/{n=0;next} /^## \[[^]]*\] work/{n++} END{print n+0}' docs/wiki/log.md  # work cycles since /project:wiki
    grep -cE '^- \[ \] [0-9]{4}-' docs/wiki/wiki-todos.md 2>/dev/null || true   # maintainer queue depth
    grep -c '^- \[ \] .*\[adversary\]' docs/wiki/todos.md 2>/dev/null || true   # open filed findings
    ```

    Recommend (naming the count that fired):
    - Remaining todos on this entity → `/project:work`.
    - `/project:review` — 5+ `work` entries since last `review`.
    - `/project:wiki` — 10+ open `wiki-todos.md` items, 5+ `work` entries since last `wiki-maintenance`, or `[adversary]` todos at `FINDINGS_MAX`.
    - Missing skill (`update-toolkit`, rule 17), checkpoint tag before a risky change, or `/project:init` step 5b if `commands.md § Architecture` is still `<TBD>`.

## Failure modes

- **Missing role or un-allowlisted command** → fix per `subagent-dispatch § Before the cycle's first dispatch`.
- **Incoherent plan or escalated spec** → stop and run `/project:interview`.
- **Contested `plan-adversary` `blocker` or second plan disagreement** → `human-checkpoint` before Red.
- **Read-only role modified files** → void round, account for paths (rule 21), restore, and re-dispatch.
- **Adversary findings at round 3 cap** → gate/file `critical`/`major`, record `minor`/`nit` as unfiled (`reason: round cap`), never open round 4.
- **Developer cannot confirm Red** → `human-checkpoint`.
- **Green or architecture check fails before commit** → leave working tree intact (do **not** run `git reset HEAD~1`) and send `developer` back with the failure output (`subagent-dispatch`).
- **Red refuted after case commit** → `git restore --source=HEAD --staged --worktree -- . && git reset HEAD~1` and send `developer` back (`subagent-dispatch`).
- **Two failures on one mechanism** → rule 5: tag `checkpoint-<stamp>` and run `human-checkpoint`.
- **Pre-existing test failures on `develop` or merge conflicts** → `human-checkpoint` / `git-recovery`.

## What you do NOT do

- **No coding** (all tests and production code come from `developer`).
- **No periodic `reviewer` dispatch** inside `/project:work` (rule 12).
- **No merging PRs** and **no silent batching**.
