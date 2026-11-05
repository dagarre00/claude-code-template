---
description: Periodic whole-repo audit of the code against the wiki by the reviewer, in a fresh context with no developer baggage — critical issues, drift, missing tests, security and performance. Run about every 5 todos, before a release, or on suspected drift; never inside /project:work.
argument-hint: '[fast | handoff] [scope — e.g. "the auth module" | "security only" | "handoff src/api/"]'
disable-model-invocation: true
---

# /project:review

**Argument:** `$ARGUMENTS`

The argument **pins the scope** (an area, lens, or both) and is passed verbatim to `reviewer`. A leading `fast` or `handoff` sets the **dispatch mode** (`subagent-dispatch § Dispatch mode`) and is stripped first. Empty → whole repository.

## State at invocation

Branch: !`git branch --show-current`

```!
git status --short
```

Dispatch the read-only `reviewer` to audit the repository against `docs/wiki/` in a fresh context (run roughly every 5 completed todos, before a release, or on suspected drift — never inside `/project:work`, rule 12).

## Preconditions

- On `develop` or the active `feat/*`/`fix/*` branch (never `main` — step 1 switches to `develop`).
- Clean working tree, and at least one entity page in `docs/wiki/`.

Any failure → `human-checkpoint`.

## Steps

1. **Sync develop** via [`sync-develop.md`](../../skills/feature-branching/sync-develop.md).
2. **Dispatch `reviewer`** per `subagent-dispatch` with the scope, instruction to verify every claim independently, and today's date (`YYYY-MM-DD`). Include no recent work framing.
3. **Save report** verbatim to `docs/wiki/reviews/review-YYYY-MM-DD.md` (if `reviewer` modified any tracked file, reject the round; if its test run left untracked residue, list it and file a `.gitignore` todo).
4. **Distribute findings:**
   - `Critical`, `Warnings`, and `Recommended new todos` → `docs/wiki/todos.md` at matching priority.
   - `Drift` items → `docs/wiki/wiki-todos.md`.
   - Missing ADRs → todo for next `/project:work`.
   - `Todos to close` → remove from `docs/wiki/todos.md` after verifying the cited evidence yourself.
5. **Log, commit and push** per [`log-and-commit.md`](../../skills/feature-branching/log-and-commit.md) — kind `review`, fields `Report: [[reviews/review-YYYY-MM-DD]]`, `Critical: <N>, Warnings: <M>, Drift: <K>`, `New todos: <list>`, `Closed todos: <list with evidence>`. Stage `docs/wiki/reviews/review-YYYY-MM-DD.md`, `todos.md`, `wiki-todos.md`, and `log.md`; subject `docs(review): audit YYYY-MM-DD — <N critical, M warnings, K drift>`.
6. **Report** critical items and recommend the next step (`/project:work`, `/project:interview`, or `/project:wiki`).

## What you do NOT do

- **No code edits** (findings are queued for `/project:work`).
- **No running inside `/project:work`.**
