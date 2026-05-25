---
name: review
description: Throughout review of the codebase against the wiki. Runs the reviewer agent in a fresh git worktree with no implementer context. Flags critical issues, warnings, drift, missing tests, security/perf concerns. Use periodically (~every 5 todos), never inside /project:work.
type: command
---

# /project:review

You dispatch the `reviewer` agent in a worktree-isolated context. The reviewer audits code vs wiki with no implementer baggage.

## When to use

- Roughly every 5 completed todos.
- After a non-trivial set of merges to `main`.
- Before any release.
- When you suspect drift between the wiki and the code.

Do **not** use `/project:review` inside `/project:work`. They're different phases.

## Preconditions

- On `main` (or any non-feat branch).
- Working tree clean.
- `docs/wiki/` exists and has at least one entity page.

If any fails: run `human-checkpoint`.

## Steps

1. **Optionally pin the scope.** If the human gave a specific area to review, write it down in one line. Otherwise the review is whole-repo.

2. **Create the worktree and enter it.** Outside the main checkout:

   ```bash
   WORKTREE="../$(basename "$PWD")-review-$(date -u +%Y-%m-%d)"
   git worktree add "$WORKTREE" HEAD
   cd "$WORKTREE"
   ```

   The reviewer works here; the `cd` is required because the dispatched subagent inherits this cwd. Without it, the reviewer ends up in the main checkout and the isolation is fake.

3. **Dispatch the `reviewer` agent** (you are now inside the worktree) with:
   - The worktree path (so the reviewer can `pwd`-verify it matches).
   - The scope (whole repo or specific area).
   - The current `docs/wiki/wiki-todos.md` (so it sees outstanding queue items as input).
   - Explicit instruction: no implementer context, fresh read.

   The reviewer's first action is `pwd` and a check against the path you passed. If they mismatch, the reviewer stops and reports — that means step 2's `cd` was skipped or the worktree creation failed.

4. **Reviewer writes** `docs/wiki/decisions/review-YYYY-MM-DD.md` with structured findings (see reviewer agent definition).

5. **Return to the main checkout and bring the report over.** The reviewer wrote the report inside the worktree; it is uncommitted there and would be discarded when the worktree is removed. Copy it onto the working branch:

   ```bash
   cd -                              # back to main checkout
   cp "$WORKTREE"/docs/wiki/decisions/review-*.md docs/wiki/decisions/
   ```

6. **Process findings in the main checkout.**
   - Read the report.
   - For each Critical / Warning: file a TODO in `docs/wiki/todos.md` with priority.
   - For each Drift item: append to `docs/wiki/wiki-todos.md` for the maintainer.
   - For each Missing ADR: queue the ADR for the next `/project:work` cycle.

7. **Clean up the worktree** (you are already back in the main checkout from step 5):

   ```bash
   git worktree remove "$WORKTREE"
   ```

8. **Log it.** Append to `docs/wiki/log.md`:

   ```markdown
   ## [YYYY-MM-DD HH:MM] review

   - Report: [[decisions/review-YYYY-MM-DD]]
   - Critical: <N>, Warnings: <M>, Drift: <K>
   - New todos: <list>
   ```

9. **Commit and push.** Stage the report, the new todos, the queued wiki-todos, and the log entry in one commit, then push immediately — an unpushed commit is lost when the container recycles (see `.claude/rules/behavioral.md` #19):

   ```bash
   git add docs/wiki/
   git commit -m "docs(review): audit YYYY-MM-DD — <N critical, M warnings, K drift>"
   git push -u origin "$(git branch --show-current)"
   ```

10. **Report to the human.** Highlight critical items only. Recommend whether the next step is `/project:work` (fix critical), `/project:interview` (spec gap), or `/project:wiki-lint` (heavy drift).

## What you do NOT do

- **No code edits.** Findings only. The next `/project:work` cycle fixes things.
- **No skipping the worktree step.** Reviewer must run isolated.
- **No reviewer-in-`/project:work`.** This is the cardinal violation — the implementer cannot audit its own work.
