---
name: review
description: Throughout review of the codebase against the wiki. Runs the reviewer agent in a fresh git worktree with no developer context. Flags critical issues, warnings, drift, missing tests, security/perf concerns. Use periodically (~every 5 todos), never inside /project:work.
argument-hint: [scope — e.g. "the auth module" | "security only" | "src/api/"]
type: command
---

# /project:review

**Argument:** `$ARGUMENTS`

The argument **pins the review scope** — an area (`the auth module`, `src/api/`), a lens (`security only`, `test coverage`), or both. Pass it verbatim to the reviewer in step 3 so the isolated agent inherits the same scope you were given. Empty argument means whole-repo review.

You dispatch the `reviewer` agent in a worktree-isolated context. The reviewer audits code vs wiki with no developer baggage.

## When to use

- Roughly every 5 completed todos.
- After a non-trivial set of merges to `develop`.
- Before any release.
- When you suspect drift between the wiki and the code.

Do **not** use `/project:review` inside `/project:work`. They're different phases.

## Preconditions

- On `develop` (or any non-`feat`/`fix` branch). `develop` is this project's integration branch — `main` is the release branch and is not where audits start.
- Working tree clean.
- `docs/wiki/` exists and has at least one entity page.

If any fails: run `human-checkpoint`.

## Steps

1. **Pin the scope.** If the argument named an area or lens, write it down in one line — that line is what you hand the reviewer in step 3. Otherwise the review is whole-repo.

1a. **Fetch, sync, and branch for the report.** The report is a tracked file, and `develop`/`main` take no direct commits (`feature-branching`, `git-conventions.md`). Fetch and fast-forward `develop` before the reviewer writes anything, same as every other command that branches — otherwise the review runs against a stale local mirror instead of actual remote state:

   ```bash
   git fetch origin develop
   git merge --ff-only origin/develop
   git checkout -b chore/review-$(date -u +%Y-%m-%d)
   ```

   If `merge --ff-only` fails (develop has diverged in a non-fast-forward way), stop and use `human-checkpoint` — do not rebase or force develop. No remote yet (`git remote` prints nothing)? Skip the fetch/merge and branch off local `develop`.

2. **Create the worktree.** Outside the main checkout:

   ```bash
   MAIN_ROOT="$(git rev-parse --show-toplevel)"   # absolute path back to the main checkout
   WORKTREE="$(dirname "$MAIN_ROOT")/$(basename "$MAIN_ROOT")-review-$(date -u +%Y-%m-%d)"
   git worktree add "$WORKTREE" HEAD
   ```

   Do **not** rely on a parent-shell `cd "$WORKTREE"` carrying into the dispatched subagent — that inheritance is not guaranteed. Instead, pass the **absolute** `$WORKTREE` path to the reviewer and let it `cd` in itself as its first action (see the reviewer agent); that is what makes the isolation real. Keep `$MAIN_ROOT` around for the return in step 5.

3. **Dispatch the `reviewer` agent** with:
   - The absolute worktree path (the reviewer `cd`s into it and `pwd`-verifies before reading anything).
   - The scope (whole repo or specific area).
   - The current `docs/wiki/wiki-todos.md` (so it sees outstanding queue items as input).
   - Explicit instruction: no developer context, fresh read.

   The reviewer's first action is `pwd` and a check against the path you passed. If they mismatch, the reviewer stops and reports — that means step 2's `cd` was skipped or the worktree creation failed.

4. **Reviewer writes** `docs/wiki/decisions/review-YYYY-MM-DD.md` with structured findings (see reviewer agent definition).

5. **Return to the main checkout and bring the report over.** The reviewer wrote the report inside the worktree; it is uncommitted there and would be discarded when the worktree is removed. Copy it onto the working branch:

   ```bash
   cd "$MAIN_ROOT"                   # absolute — never `cd -` ($OLDPWD does not persist across tool calls)
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

9. **Commit and push.** Stage the report, the new todos, the queued wiki-todos, and the log entry in one commit, then push immediately (behavioral rule 19):

   ```bash
   git add docs/wiki/
   git commit -m "docs(review): audit YYYY-MM-DD — <N critical, M warnings, K drift>"
   git push -u origin "$(git branch --show-current)"   # the chore/review-* branch from step 1a
   ```

   Then open a PR to `develop` via `pr-create` (the branch is `chore/*`, so the body is the report summary rather than Behavior cases) and return to `develop` with `git checkout develop`. Merging stays the human's call.

10. **Report to the human.** Highlight critical items only. Recommend whether the next step is `/project:work` (fix critical), `/project:interview` (spec gap), or `/project:wiki-lint` (heavy drift).

## What you do NOT do

- **No code edits.** Findings only. The next `/project:work` cycle fixes things.
- **No skipping the worktree step.** Reviewer must run isolated.
- **No reviewer-in-`/project:work`.** This is the cardinal violation — the `developer` cannot audit its own work.
