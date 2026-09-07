---
name: review
description: Thorough review of the codebase against the wiki. Runs the reviewer agent in a fresh session context with no developer baggage. Flags critical issues, warnings, drift, missing tests, security/perf concerns. Use periodically (~every 5 todos), never inside /project:work.
argument-hint: [scope — e.g. "the auth module" | "security only" | "src/api/"]
type: command
---

# /project:review

**Argument:** `$ARGUMENTS`

The argument **pins the review scope** — an area (`the auth module`, `src/api/`), a lens (`security only`, `test coverage`), or both. Pass it verbatim to the reviewer in step 2 so the agent inherits the same scope you were given. Empty argument means whole-repo review.

You dispatch the `reviewer` agent in a fresh session context. The reviewer audits code vs wiki with no developer baggage.

## When to use

- Roughly every 5 completed todos.
- After a non-trivial set of merges to `develop`.
- Before any release.
- When you suspect drift between the wiki and the code.

Do **not** use `/project:review` inside `/project:work`. They're different phases.

## Preconditions

- On `develop`, or your active `feat/*`/`fix/*` branch if running mid-cycle (behavioral rule 19; same as `feature-branching`'s table). Standing on `main` is corrected by step 1's guard — this command never runs from `main`.
- Working tree clean.
- `docs/wiki/` exists and has at least one entity page.

If any fails: run `human-checkpoint`.

## Steps

1. **Sync develop.** Run the guarded sync block in `.agents/skills/feature-branching/sync-develop.md` (read it; its stop conditions apply).

2. **Dispatch the `reviewer` agent** with:
   - The scope (whole repo or specific area from `$ARGUMENTS`).
   - The current `docs/wiki/wiki-todos.md` (so it sees outstanding queue items as input).
   - Explicit instruction: fresh context, no developer assumptions, verify claims independently.

3. **Reviewer writes** `docs/wiki/decisions/review-YYYY-MM-DD.md` with structured findings (see reviewer agent definition).

4. **Process findings in the wiki.**
   - Read the report.
   - For each Critical / Warning / Recommended new todo: file a TODO in `docs/wiki/todos.md` with priority.
   - For each Drift item: append to `docs/wiki/wiki-todos.md` for the maintainer.
   - For each Missing ADR: queue the ADR for the next `/project:work` cycle.

5. **Log, commit and push** per [`log-and-commit.md`](../skills/feature-branching/log-and-commit.md) — kind `review`, fields `Report: [[decisions/review-YYYY-MM-DD]]`, `Critical: <N>, Warnings: <M>, Drift: <K>`, `New todos: <list>`. Stage `docs/wiki/`; subject `docs(review): audit YYYY-MM-DD — <N critical, M warnings, K drift>`.

   Run `git status --porcelain` first and read it: dirt outside `docs/wiki/` is not automatically yours. If it matches the reviewer's report (suite-written files the reviewer missed), restore those paths; anything you cannot account for is another session's live work — stop and `human-checkpoint` naming the paths (rule 21).

6. **Report to the human.** Highlight critical items only. Recommend whether the next step is `/project:work` (fix critical), `/project:interview` (spec gap), or `/project:wiki` (heavy drift).

## What you do NOT do

- **No code edits.** Findings only. The next `/project:work` cycle fixes things.
- **No reviewer-in-`/project:work`.** This is the cardinal violation — the `developer` cannot audit its own work.
