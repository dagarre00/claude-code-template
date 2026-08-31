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

- On `develop` (or any non-`feat`/`fix` branch). Standing on `main` is corrected by step 1's guard — this command never runs from `main`.
- Working tree clean.
- `docs/wiki/` exists and has at least one entity page.

If any fails: run `human-checkpoint`.

## Steps

1. **Sync develop.** If standing on `develop`, fetch and fast-forward before the audit begins:

   ```bash
   if [ "$(git branch --show-current)" = "main" ]; then
     git checkout develop || exit 1
   fi
   if [ "$(git branch --show-current)" = "develop" ]; then
     if git fetch origin develop 2>/dev/null; then
       git merge --ff-only origin/develop || exit 1
     fi
   fi
   ```

   **Never from `main`.** The guard above moves you to `develop` first — `main` is the release branch, updated only when `develop` is promoted (`docs/wiki/git-conventions.md`).

   **If `git merge --ff-only` fails**, `develop` has diverged in a non-fast-forward way — stop and run `human-checkpoint` before proceeding. Committing on a stale `develop` and failing the push is exactly the unpushed-commit loss behavioral rule 19 exists to prevent.

2. **Dispatch the `reviewer` agent** with:
   - The scope (whole repo or specific area from `$ARGUMENTS`).
   - The current `docs/wiki/wiki-todos.md` (so it sees outstanding queue items as input).
   - Explicit instruction: fresh context, no developer assumptions, verify claims independently.

3. **Reviewer writes** `docs/wiki/decisions/review-YYYY-MM-DD.md` with structured findings (see reviewer agent definition).

4. **Process findings in the wiki.**
   - Read the report.
   - For each Critical / Warning: file a TODO in `docs/wiki/todos.md` with priority.
   - For each Drift item: append to `docs/wiki/wiki-todos.md` for the maintainer.
   - For each Missing ADR: queue the ADR for the next `/project:work` cycle.

5. **Log it.** Append to `docs/wiki/log.md`:

   ```markdown
   ## [YYYY-MM-DD HH:MM] review

   - Report: [[decisions/review-YYYY-MM-DD]]
   - Critical: <N>, Warnings: <M>, Drift: <K>
   - New todos: <list>
   ```

6. **Commit and push.** Living wiki updates commit directly on `develop` (or your active branch, behavioral rule 19):

   ```bash
   git status --porcelain   # residue outside docs/wiki/ is reviewer dirt — restore it with git checkout/clean before staging
   git add docs/wiki/
   git commit -m "docs(review): audit YYYY-MM-DD — <N critical, M warnings, K drift>"
   git push -u origin "$(git branch --show-current)"
   ```

7. **Report to the human.** Highlight critical items only. Recommend whether the next step is `/project:work` (fix critical), `/project:interview` (spec gap), or `/project:wiki-lint` (heavy drift).

## What you do NOT do

- **No code edits.** Findings only. The next `/project:work` cycle fixes things.
- **No reviewer-in-`/project:work`.** This is the cardinal violation — the `developer` cannot audit its own work.
