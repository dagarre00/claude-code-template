---
name: "project-review"
description: "Thorough review of the codebase against the wiki. Runs the reviewer agent in a fresh session context with no developer baggage. Flags critical issues, warnings, drift, missing tests, security/perf concerns. Use periodically (~every 5 todos), never inside project-work."
---

<!-- Generated from .harness/commands/project/review.md; DO NOT EDIT. Run node scripts/sync-harness.mjs. -->

# project-review

**Conductor only.** Follow `mcp-coordination` for every worker dispatch, status
check, cancellation, and local integration. A worker must return a result or
blocker instead of invoking this command. Never substitute native delegation.

**Argument:** `user-provided context following this skill invocation (empty if omitted)`

The argument **pins the review scope** — an area (`the auth module`, `src/api/`), a lens (`security only`, `test coverage`), or both. Pass it verbatim to the reviewer in step 2 so the agent inherits the same scope you were given. Empty argument means whole-repo review.

You dispatch the `reviewer` agent in a fresh session context. The reviewer audits code vs wiki with no developer baggage.

## When to use

- Roughly every 5 completed todos.
- After a non-trivial set of merges to `develop`.
- Before any release.
- When you suspect drift between the wiki and the code.

Do **not** use `project-review` inside `project-work`. They're different phases.

## Preconditions

- On `develop`, or your active `feat/*`/`fix/*` branch if running mid-cycle (behavioral rule 19; same as `feature-branching`'s table). Standing on `main` is corrected by step 1's guard — this command never runs from `main`.
- Working tree clean.
- `docs/wiki/` exists and has at least one entity page.

If any fails: run `human-checkpoint`.

## Steps

1. **Sync develop.** Run the guarded sync block in `.harness/skills/feature-branching/sync-develop.md` (read it; its stop conditions apply).

2. **Call `spawn_worker` for the read-only `reviewer`** with:
   - The scope (whole repo or specific area from `user-provided context following this skill invocation (empty if omitted)`).
   - The current `docs/wiki/wiki-todos.md` (so it sees outstanding queue items as input).
   - Explicit instruction: fresh context, no developer assumptions, verify claims independently.

3. **Collect the complete report.** Poll `check_worker_status`, inspect the final
   report/log rather than only its tail, and verify the worktree stayed unchanged.
   Run any mutating test reproduction requested by the reviewer as conductor,
   preserving and accounting for test residue. Collect the report before normal
   MCP read-only cleanup. **Persist the reviewer's response** to `docs/wiki/decisions/review-YYYY-MM-DD.md`
   using its structured report format. The reviewer itself remains read-only.

4. **Process findings in the wiki.**
   - Read the report.
   - For each Critical / Warning / Recommended new todo: file a TODO in `docs/wiki/todos.md` with priority.
   - For each Drift item: append to `docs/wiki/wiki-todos.md` for the maintainer.
   - For each Missing ADR: queue the ADR for the next `project-work` cycle.

5. **Log it.** Append to `docs/wiki/log.md`:

   ```markdown
   ## [YYYY-MM-DD HH:MM] review

   - Report: [[decisions/review-YYYY-MM-DD]]
   - Critical: <N>, Warnings: <M>, Drift: <K>
   - New todos: <list>
   ```

6. **Commit and push.** Living wiki updates commit directly on `develop` (or your active branch, behavioral rule 19):

   ```bash
   git status --porcelain   # any dirt outside docs/wiki/ must be accounted for, never blindly restored (behavioral rule 21)
   git add docs/wiki/
   git commit -m "docs(review): audit YYYY-MM-DD — <N critical, M warnings, K drift>"
   git push -u origin "$(git branch --show-current)"   # no remote → skip and note (git-conventions § Cadence)
   ```

   Dirt outside `docs/wiki/` is not automatically yours. Preserve unexpected
   residue, account for exact paths and ownership, and use `human-checkpoint`
   before any recovery that would discard work. Read-only worker residue
   invalidates the affected review; do not hide it with automatic restoration.

7. **Report to the human.** Highlight critical items only. Recommend whether the next step is `project-work` (fix critical), `project-interview` (spec gap), or `project-wiki-lint` (heavy drift).

## What you do NOT do

- **No code edits.** Findings only. The next `project-work` cycle fixes things.
- **No reviewer-in-`project-work`.** This is the cardinal violation — the `developer` cannot audit its own work.
