---
name: review
description: Periodic whole-repo audit of the code against the wiki by the reviewer, in a fresh context with no developer baggage — critical issues, drift, missing tests, security and performance. Run about every 5 todos, before a release, or on suspected drift; never inside /project:work.
argument-hint: [scope — e.g. "the auth module" | "security only" | "src/api/"]
type: command
---

# /project:review

**Argument:** `$ARGUMENTS`

The argument **pins the scope** — an area (`the auth module`, `src/api/`), a lens (`security only`, `test coverage`), or both — and is passed verbatim to the reviewer. Empty → the whole repository.

You dispatch the `reviewer`, which audits code against the wiki in a fresh context. Run it roughly every 5 completed todos, after a batch of merges to `develop`, before a release, or on suspected drift — never inside `/project:work` (rule 12).

## Preconditions

- On `develop`, or the active `feat/*`/`fix/*` branch mid-cycle (rule 19). Never `main` — step 1 moves off it.
- A clean working tree, and at least one entity page in `docs/wiki/`.

Any failure → `human-checkpoint`.

## Steps

1. **Sync develop** with the guarded block in `.agents/skills/feature-branching/sync-develop.md` (its stop conditions apply).

2. **Dispatch the `reviewer`** per `worker-dispatch`, with the scope, the current `docs/wiki/wiki-todos.md` as input, and the instruction to verify every claim independently.

3. **Save its report** verbatim to `docs/wiki/reviews/review-YYYY-MM-DD.md`. The reviewer is read-only and returns the report already shaped for that file; a review file appearing in its worktree is a read-only violation, not a delivery. If the report's audit shows reads outside its workspace (another worker's report, the dispatch files), it lost the fresh context this command exists for — say so in the log entry.

4. **Distribute the findings:** each Critical, Warning and recommended todo → a line in `docs/wiki/todos.md` at its priority; each Drift item → `docs/wiki/wiki-todos.md`; each missing ADR → a todo for the next `/project:work` cycle.

5. **Log, commit and push** per [`log-and-commit.md`](../skills/feature-branching/log-and-commit.md) — kind `review`, fields `Report: [[reviews/review-YYYY-MM-DD]]`, `Critical: <N>, Warnings: <M>, Drift: <K>`, `New todos: <list>`. Stage `docs/wiki/`; subject `docs(review): audit YYYY-MM-DD — <N critical, M warnings, K drift>`. Read `git status --porcelain` first: the reviewer ran in its own worktree, so anything here you did not write is another session's work — `human-checkpoint`, naming the paths (rule 21).

6. **Report** critical items only, and recommend the next step: `/project:work` (fix a critical), `/project:interview` (a spec gap) or `/project:wiki` (heavy drift).

## What you do NOT do

- **No code edits.** Findings only; the next `/project:work` cycle fixes them.
- **No reviewer inside `/project:work`** — the developer never audits its own work.
