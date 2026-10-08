---
description: Periodic whole-repo audit of the code against the wiki by the reviewer, in a fresh context with no developer baggage — critical issues, drift, missing tests, security and performance. Run about every 5 todos, before a release, or on suspected drift; never inside /project:work.
argument-hint: '[fast | handoff] [scope — e.g. "the auth module" | "security only" | "handoff src/api/"]'
disable-model-invocation: true
---

# /project:review

**Argument:** `$ARGUMENTS`

The argument **pins the scope** — an area (`the auth module`, `src/api/`), a lens (`security only`, `test coverage`), or both — and is passed verbatim to the reviewer. A leading `fast` or `handoff` is the **dispatch mode** instead, stripped first and never passed on (`subagent-dispatch` § Dispatch mode). Empty → the whole repository.

## State at invocation

Branch: !`git branch --show-current`

```!
git status --short
```

You dispatch the `reviewer`, which audits code against the wiki in a fresh context. Run it roughly every 5 completed todos, after a batch of merges to `develop`, before a release, or on suspected drift — never inside `/project:work` (rule 12).

## Preconditions

- On `develop`, or the active `feat/*`/`fix/*` branch mid-cycle (rule 19). Never `main` — step 1 moves off it.
- A clean working tree, and at least one entity page in `docs/wiki/`.

Any failure → `human-checkpoint`.

## Steps

1. **Sync develop** with the guarded block in [`sync-develop.md`](../../skills/feature-branching/sync-develop.md) (its stop conditions apply).

2. **Dispatch the `reviewer`** per `subagent-dispatch`, with the scope, the instruction to verify every claim independently, and today's date for the report. Nothing about recent work — its fresh context is the point.

3. **Save its report** verbatim to `docs/wiki/reviews/review-YYYY-MM-DD.md`. The reviewer is read-only and returns the report already shaped for that file; a tracked file it changed is a read-only violation, not a delivery. New untracked files its test run left behind are residue: list them, and file a todo for a `.gitignore` line.

4. **Distribute the findings:** each Critical, Warning and recommended todo → a line in `docs/wiki/todos.md` at its priority; each Drift item → `docs/wiki/wiki-todos.md`; each missing ADR → a todo for the next `/project:work` cycle; each todo to close → remove its line from `todos.md` once you have checked the cited evidence yourself.

5. **Log, commit and push** per [`log-and-commit.md`](../../skills/feature-branching/log-and-commit.md) — kind `review`, fields `Report: [[reviews/review-YYYY-MM-DD]]`, `Critical: <N>, Warnings: <M>, Drift: <K>`, `New todos: <list>`, `Closed todos: <list, each with its evidence>`. Stage the review file, `todos.md`, `wiki-todos.md` and `log.md` by path; subject `docs(review): audit YYYY-MM-DD — <N critical, M warnings, K drift>`. Read `git status --porcelain` first: anything you did not write is another session's work — `human-checkpoint`, naming the paths (rule 21).

6. **Report** critical items only, and recommend the next step: `/project:work` (fix a critical), `/project:interview` (a spec gap) or `/project:wiki` (heavy drift).

## What you do NOT do

- **No code edits.** Findings only; the next `/project:work` cycle fixes them.
- **No reviewer inside `/project:work`** — the developer never audits its own work.
