---
name: review
description: Throughout review of the codebase against the wiki. Runs the reviewer agent in a fresh git worktree with no implementer context. Flags critical issues, warnings, drift, missing tests, security/perf concerns. Use periodically (~every 5 todos), never inside /work.
type: command
---

# /review

You dispatch the `reviewer` agent in a worktree-isolated context. The reviewer audits code vs wiki with no implementer baggage.

## When to use

- Roughly every 5 completed todos.
- After a non-trivial set of merges to `main`.
- Before any release.
- When you suspect drift between the wiki and the code.

Do **not** use `/review` inside `/work`. They're different phases.

## Preconditions

- On `main` (or any non-feat branch).
- Working tree clean.
- `docs/wiki/` exists and has at least one entity page.

If any fails: run `human-checkpoint`.

## Steps

1. **Optionally pin the scope.** If the human gave a specific area to review, write it down in one line. Otherwise the review is whole-repo.

2. **Create the worktree.** Outside the main checkout:
   ```bash
   git worktree add ../<repo>-review-YYYY-MM-DD HEAD
   ```
   The reviewer works there; no risk of polluting the main checkout.

3. **Dispatch the `reviewer` agent** with:
   - The worktree path.
   - The scope (whole repo or specific area).
   - The current `docs/wiki/wiki-todos.md` (so it sees outstanding queue items as input).
   - Explicit instruction: no implementer context, fresh read.

4. **Reviewer writes** `docs/wiki/decisions/review-YYYY-MM-DD.md` with structured findings (see reviewer agent definition).

5. **Process findings back in the main checkout.**
   - Read the report.
   - For each Critical / Warning: file a TODO in `docs/wiki/todos.md` with priority.
   - For each Drift item: append to `docs/wiki/wiki-todos.md` for the maintainer.
   - For each Missing ADR: queue the ADR for the next `/work` cycle.

6. **Clean up the worktree:**
   ```bash
   git worktree remove ../<repo>-review-YYYY-MM-DD
   ```

7. **Log it.** Append to `docs/wiki/log.md`:
   ```markdown
   ## [YYYY-MM-DD HH:MM] review
   - Report: [[decisions/review-YYYY-MM-DD]]
   - Critical: <N>, Warnings: <M>, Drift: <K>
   - New todos: <list>
   ```

8. **Report to the human.** Highlight critical items only. Recommend whether the next step is `/work` (fix critical), `/interview` (spec gap), or `/wiki-lint` (heavy drift).

## What you do NOT do

- **No code edits.** Findings only. The next `/work` cycle fixes things.
- **No skipping the worktree step.** Reviewer must run isolated.
- **No reviewer-in-`/work`.** This is the cardinal violation — the implementer cannot audit its own work.
