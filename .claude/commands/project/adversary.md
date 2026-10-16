---
description: Point a read-only second model at the current change — dispatch the adversary over the diff with none of the author's context, dispose of every numbered finding in writing, and re-review only what was fixed. Per-change; /project:review is the periodic whole-repo audit.
argument-hint: '[fast | handoff] [base ref or lens — e.g. "develop" | "against main" | "fast concurrency only"]'
disable-model-invocation: true
---

# /project:adversary

**Argument:** `$ARGUMENTS`

The argument **sets what gets reviewed** (step 1):
- **Base ref** (`develop`, `against main`, `HEAD~3`) → review `<ref>...HEAD`.
- **Lens** (`concurrency only`, `error handling`) → an emphasis added to the full 8-category sweep (never a narrowing of it), noted in the report.

A leading `fast` or `handoff` sets the **dispatch mode** (`subagent-dispatch § Dispatch mode`) and is stripped first. Empty → standard sweep over the unshipped change.

## State at invocation

Branch: !`git branch --show-current`

```!
git status --short
```

You run an adversarial diff review using `finding-disposition § Diff round`. The read-only `adversary` raises findings using `adversarial-review`; you dispose of them.

## Preconditions

- A non-empty diff exists (dirty tree, unreviewed branch commits, or `<ref>...HEAD`).
- On a `feat/*`, `fix/*`, or `chore/*` branch — or on `develop` **only** for a release review (`against main`), whose approved fixes cut a `fix/<slug>` branch in step 3.

## Steps

1. **Scope the review to the whole cycle** — one review per cycle, never one per case:
   - **Base ref** → `<ref>...HEAD`.
   - **Dirty tree** → account for every path (rule 21), commit on the current branch (`wip: <what> — for adversary review` if not a finished case), and review `<sha-before>...HEAD`.
   - **Clean tree with unreviewed commits** → `<sha-before-cycle>..HEAD`, where `<sha-before-cycle>` is the commit just before the cycle's first case commit (its `docs(<slug>): plan review` commit when there is one).

2. **Dispatch `adversary`** per `subagent-dispatch` with the commit range, entity slug(s), case IDs, test command from `docs/wiki/commands.md`, and optional lens — never the plan, `.handoff/`, or intent summary. Verify `git diff --stat <range>` is non-empty first.

3. **Dispose of every finding** per `finding-disposition § Diff round`: **Filed** by default, **Fixed** only for human-approved `critical`/`major` items (via a single `human-checkpoint` and a `developer` dispatch per fix), or **Rejected** with a one-sentence reason. Optionally dispatch `triage` for a second opinion. Each round commits `docs(<slug>): adversary round N` with `--allow-empty`, staging `docs/wiki/todos.md`.
   - **Release review fix:** never commit code on `develop`. Cut `fix/<slug>` (`feature-branching § Starting work`) before dispatching `developer` for an approved fix, complete the review and round commits there, and open a PR to `develop` via `pr-create`.

4. **Re-review only if a fix landed**, over the fix commits alone (max 3 rounds).

5. **Log, commit and push** per [`log-and-commit.md`](../../skills/feature-branching/log-and-commit.md) — kind `adversary`, fields `Commit reviewed`, `Findings: <N> (<C> critical, <M> major, <m> minor)`, `Disposition: <Fi> filed, <Fx> fixed, <R> rejected`. Stage `docs/wiki/log.md` in the final round's commit (the round no re-review follows), never in an earlier one, so a re-review's range never carries it.

6. **Report** findings by severity (leading with any `critical`/`major` filed rather than fixed), queued todo locations, approved fixes, and rejections with reasons.

## Failure modes

- **No findings and no `Checked:` line** → re-dispatch once demanding it.
- **Adversary modifies files or git state** → void round, restore tree, report.
- **Finding contradicts the entity spec** → Reject citing the Behavior case, or recommend `/project:interview` if the spec is wrong.
- **Open findings at round 3 cap** → gate/file `critical`/`major`, list `minor`/`nit` as unfiled (`reason: round cap`), and stop.

## What you do NOT do

- **No adversary edits** and **no author context in the brief.**
- **No whole-repo audit** (out-of-diff issues go under `## Out of scope`).
- **No merging or PRs** (except a release review's `fix/*` PR in step 3).
