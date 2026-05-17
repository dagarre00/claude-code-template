---
name: wiki-lint
description: Periodic wiki health check. Dispatches the wiki-maintainer to process the wiki-todos.md queue, find orphans, broken [[links]], stale claims, contradictions, and missing ADRs. Run every few work cycles or when wiki-todos.md is piling up.
type: command
---

# /project:wiki-lint

You dispatch the `wiki-maintainer` agent for a full health pass. This is **periodic**, not every-cycle. Heuristics:

- `docs/wiki/wiki-todos.md` has > 10 unticked entries.
- Last `/project:wiki-lint` was > 5 work cycles ago.
- `/project:review` flagged drift.
- A new batch of raw sources landed in `docs/raw/`.

## Preconditions

- Working tree clean (the maintainer will write to `docs/wiki/`).
- `docs/wiki/index.md` exists.

If dirty: run `human-checkpoint`.

## Steps

1. **Branch for the maintenance pass:**
   ```bash
   git checkout -b chore/wiki-lint-YYYY-MM-DD
   ```
   Keeps maintenance commits separate from feature work.

2. **Dispatch `wiki-maintainer`** with:
   - The current `docs/wiki/wiki-todos.md` content.
   - The list of raw files added since the last summary in `docs/wiki/summaries/`.
   - Explicit instructions: process the queue, ingest, lint, and produce a summary at the end.

3. **Maintainer writes:**
   - Resolved `wiki-todos` lines (removed).
   - New `summaries/` pages for any ingested raw sources.
   - Updates to entity/concept/decision pages.
   - Updated `index.md`.
   - A log entry to `log.md`.

4. **Review the diff** — `git diff --stat`. Sanity-check:
   - No code outside `docs/wiki/` was touched.
   - No raw files were modified.
   - No mass rewrites of entity pages (the maintainer is conservative; a 500-line entity diff is a red flag).

5. **Commit:**
   ```bash
   git add docs/wiki/
   git commit -m "chore(wiki): lint — <N todos processed, M orphans, K broken links>"
   ```

6. **Report to the human.** What was processed, what remains. If the maintainer flagged contradictions or stale claims it couldn't auto-fix, list them explicitly — the human or `/project:interview` resolves which version is correct.

## Failure modes

- **Maintainer touches code outside `docs/wiki/`.** Reset; that's a behavioral violation. Re-dispatch with stricter instructions.
- **Maintainer rewrites large sections of an entity page.** Reset; entity rewrites go through `/project:interview`. The maintainer's job is structure, not content overhaul.
- **Conflicting versions of the same fact in two pages.** Don't auto-resolve. File both in the report and run `human-checkpoint` to decide which is correct.

## What you do NOT do

- **No code changes.** This is wiki-only.
- **No raw edits.** Append-only there.
- **No silent merges of contradictions.** Flag, don't bury.
