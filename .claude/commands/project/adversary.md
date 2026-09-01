---
name: adversary
description: Point a read-only second model at the current change. Dispatches the adversary agent (Opus, fresh context) over the diff, collects numbered findings in a mailbox file, triages each one, and re-reviews once. Diff-scoped and per-change — unlike /project:review, which is periodic and whole-repo.
argument-hint: [base ref or lens — e.g. "develop" | "against main" | "concurrency only"]
type: command
---

# /project:adversary

**Argument:** `$ARGUMENTS`

The argument **sets what gets reviewed**, resolved in step 1:

- **A base ref** (`develop`, `against main`, `HEAD~3`) → diff against it (`git diff <ref>...HEAD`) instead of the working tree. This is the "or you were given a base ref" case in the preconditions — with a ref, a clean tree is reviewable rather than a stop condition.
- **A lens** (`concurrency only`, `error handling`) → pass it to the adversary as an emphasis on top of the six-category sweep. It **narrows nothing**: the full sweep still runs, because a sweep the author gets to shrink is one the author gets to steer. Say in the report that a lens was applied.

A lens never reaches the adversary as intent, rationale, or a summary of what the change is meant to do — that would leak exactly the context step 2 exists to withhold. If you cannot phrase it as a category to weight, drop it and say so. Empty argument means the standard sweep over the unshipped change, resolved in step 1.

You run one adversarial review of the change in the working directory. Findings only — the adversary never edits. You triage, fix, and re-dispatch once. Follow the `adversarial-review` skill for the mailbox format, sweep order, severity vocabulary, and triage protocol.

## When to use

- A simple todo that `/project:work` did not gate (only `[complex]`/batched cycles are reviewed automatically).
- Any change you are about to call done and did not watch get written.
- Before promoting `develop` to `main`, over the release diff.

Not a substitute for `/project:review` (periodic, whole-repo, drift) or for writing the failing test first.

## Preconditions

- A diff exists: a dirty tree, unreviewed commits on the current branch, or a given base ref.
- On a `feat`/`fix`/`chore` branch, not `main` — any fix the human approves has to land somewhere, and it is never `main`.
- **`develop` is allowed for exactly one case:** the release review named above (`/project:adversary against main`), which is diff-scoped and read-only by construction. If that round yields an approved `critical`/`major`, cut a `fix/*` branch for the fix rather than committing it to `develop`; the round-closing todo and log lines are living documentation and may land on `develop` directly (behavioral rule 19).

Clean tree, nothing unshipped, and no base ref: stop and say there is nothing to review. Do not dispatch.

## Steps

1. **Scope it, and keep it small.** Resolve the scope in this order:
   - **Argument named a base ref** → `git diff <ref>...HEAD`.
   - **Dirty tree** → the uncommitted change (`git diff HEAD`, naming any untracked files). If it builds on unpushed commits from the same task, widen to `git diff <sha-before-them>...HEAD` so the review sees the whole unshipped change.
   - **Clean tree with unreviewed commits** → the commits for one Behavior case, or a few closely-related ones — `git diff <sha-before-them>...HEAD`.

   Note the entity slug(s) touched. A whole-branch range is the usual reason a review runs past two rounds; prefer several small reviews to one large one.

2. **Dispatch the `adversary`** with the diff scope, the entity slug(s) and Behavior case IDs, the mailbox path `.claude/handoff/<slug>-findings.md`, the test command from `docs/wiki/commands.md`, and the lens from the argument if there was one. Pass **nothing else** — no plan file, no rationale, no summary of intent. That independence is the whole product.

3. **Read the mailbox and triage** every finding to Filed / Fixed / Rejected-with-reason (behavioral rule 20). **Filed is the default** — a line in `docs/wiki/todos.md` at the priority its severity maps to, not a fix. For every `critical` and `major`, run one `human-checkpoint` with the failure scenarios and your recommendation, and let the human choose fix-now or queue; only an approved finding gets fixed, and then by the normal loop (failing test first; spec first if the finding contradicts the entity page).

4. **Re-dispatch only if a fix landed** — and then over the fix commits only (`git diff <sha-before-fixes>...HEAD`), never the original range: re-reading the whole thing is what makes each round surface new findings instead of converging. If everything was filed or rejected, no code changed and the review is already done. **Two rounds maximum** — findings surviving round two mean the unit was too big, so split it and review the pieces.

5. **Log it.** Append to `docs/wiki/log.md`:

   ```markdown
   ## [YYYY-MM-DD HH:MM] adversary — <slug>

   - Commit reviewed: <sha> (append "+ dirty tree" if the working tree was in scope)
   - Findings: <N> (<C> critical, <M> major, <m> minor)
   - Disposition: <Fi> filed, <Fx> fixed, <R> rejected
   ```

   The counts are an index. The per-finding reasons are in the commits — `git log --grep="adversary round"`.

6. **Commit the dispositions and push.** Each fix is its own commit naming the finding it closes; one commit then closes the round with every finding's disposition in its body (behavioral rule 19, and rule 20's record):

   ```bash
   git add <fixed-files>                                              # approved criticals/majors only
   git commit -m "fix(<slug>): <what changed> — adversary F1"
   git add docs/wiki/todos.md docs/wiki/log.md
   git commit -m "docs(<slug>): adversary round 1 — <N> findings, …"   # body: one line per finding
   git push -u origin "$(git branch --show-current)"                   # no remote → skip and note (git-conventions § Cadence)
   ```

   Most rounds have no `fix` commit at all — that is the expected shape, not a failed review. If a round produced neither a fix nor a todo (everything rejected), make the round-closing commit `--allow-empty`: its written rejections are the only thing that has to survive.

7. **Clean up.** Delete `.claude/handoff/<slug>-findings.md` — gitignored scratch, and the dispositions are already in the commits.

8. **Report.** Findings by severity, what you filed and where it sits in the queue, what you fixed under approval, and what you rejected and why. Lead with any `critical`/`major` that was filed rather than fixed. Name any rejection the human might disagree with.

## Failure modes

- **Adversary reports no findings without saying what it checked.** Re-dispatch once demanding the `**Checked:**` line. An unexplained pass is a failed review.
- **Adversary tries to edit, commit, or push.** Stop and report it — the read-only invariant is broken and the round is void.
- **Findings contradict the entity spec.** The spec wins until the human changes it. Rejected — out of scope, with the Behavior case cited; or `/project:interview` if the spec is genuinely wrong.
- **Findings keep coming, round after round.** The scope is too large — each round's fixes add surface the next round reads as new. Stop, split the range into single cases, and review those. Do not raise the round cap.
- **Diff too large to review meaningfully.** The cycle batched too much. Review per entity, one dispatch each.

## What you do NOT do

- **No adversary edits.** Findings only; you make the fixes.
- **No leaking author context into the dispatch.** The Behavior case IDs are the brief.
- **No whole-repo audit.** Out-of-diff problems go in the mailbox's `## Out of scope` list and, if they matter, into `docs/wiki/todos.md` for `/project:review`.
- **No merging, no PR.** `/project:work` owns the PR.
