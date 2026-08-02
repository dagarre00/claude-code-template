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

A lens never reaches the adversary as intent, rationale, or a summary of what the change is meant to do — that would leak exactly the context step 2 exists to withhold. If you cannot phrase it as a category to weight, drop it and say so. Empty argument means the working-tree diff and the standard sweep.

You run one adversarial review of the change in the working directory. Findings only — the adversary never edits. You triage, fix, and re-dispatch once. Follow the `adversarial-review` skill for the mailbox format, sweep order, severity vocabulary, and triage protocol.

## When to use

- A simple todo that `/project:work` did not gate (only `[complex]`/batched cycles are reviewed automatically).
- Any change you are about to call done and did not watch get written.
- Before promoting `develop` to `main`, over the release diff.

Not a substitute for `/project:review` (periodic, whole-repo, drift) or for writing the failing test first.

## Preconditions

- A diff exists: `git status --porcelain` is non-empty, or you were given a base ref.
- On a `feat`/`fix`/`chore` branch, not `develop` or `main` — fixes land on a branch.

Clean tree and no base ref: stop and say there is nothing to review. Do not dispatch.

## Steps

1. **Scope it.** If the argument named a base ref, use `git diff <ref>...HEAD`. Otherwise: uncommitted work → `git diff` + `git diff --staged`; a pushed branch → `git diff develop...HEAD`. Note the entity slug(s) the diff touches.

2. **Dispatch the `adversary`** with the diff scope, the entity slug(s) and Behavior case IDs, the mailbox path `.claude/handoff/<slug>-findings.md`, the test command from `docs/wiki/commands.md`, and the lens from the argument if there was one. Pass **nothing else** — no plan file, no rationale, no summary of intent. That independence is the whole product.

3. **Read the mailbox and triage** every finding to Fixed / Rejected-with-reason / Deferred-with-todo, annotating each in place (behavioral rule 20). Fixes follow the normal loop: failing test first for any behavior change; spec first if a finding contradicts the entity page.

4. **Re-dispatch once** with the new diff and the annotated mailbox. The adversary confirms fixes and contests rejections once. **Two rounds maximum** — surviving `critical`/`major` findings go to `human-checkpoint`, not to round three.

5. **Log it.** Append to `docs/wiki/log.md`:

   ```markdown
   ## [YYYY-MM-DD HH:MM] adversary — <slug>

   - Commit reviewed: <sha>
   - Findings: <N> (<C> critical, <M> major, <m> minor)
   - Disposition: <F> fixed, <R> rejected, <D> deferred
   ```

6. **Commit and push.** Stage the fixes, any inline gotcha/ADR, the deferred todos, and the log entry in one commit, then push (behavioral rule 19):

   ```bash
   git add <fix-paths> docs/wiki/
   git commit -m "fix(<slug>): address adversary findings — <N> fixed"
   git push -u origin "$(git branch --show-current)"
   ```

   Nothing to fix (all rejected or nits only) → commit just the log entry and any recorded invariant.

7. **Clean up.** Delete `.claude/handoff/<slug>-findings.md` — gitignored scratch; the commits and the log entry are the record.

8. **Report.** Findings by severity, what you fixed, what you rejected and why. Name any rejection the human might disagree with.

## Failure modes

- **Adversary reports no findings without saying what it checked.** Re-dispatch once demanding the `**Checked:**` line. An unexplained pass is a failed review.
- **Adversary tries to edit, commit, or push.** Stop and report it — the read-only invariant is broken and the round is void.
- **Findings contradict the entity spec.** The spec wins until the human changes it. Rejected — out of scope, with the Behavior case cited; or `/project:interview` if the spec is genuinely wrong.
- **Same finding survives two rounds.** `human-checkpoint` with both positions. Do not let two agents negotiate.
- **Diff too large to review meaningfully.** The cycle batched too much. Review per entity, one dispatch each.

## What you do NOT do

- **No adversary edits.** Findings only; you make the fixes.
- **No leaking author context into the dispatch.** The Behavior case IDs are the brief.
- **No whole-repo audit.** Out-of-diff problems go in the mailbox's `## Out of scope` list and, if they matter, into `docs/wiki/todos.md` for `/project:review`.
- **No merging, no PR.** `/project:work` owns the PR.
