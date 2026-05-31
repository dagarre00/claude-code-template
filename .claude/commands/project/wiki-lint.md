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
- `docs/wiki/` exists with at least `requirements.md` and `wiki-todos.md`.

If dirty: run `human-checkpoint`.

## Steps

1. **Branch for the maintenance pass** — cut from `develop`, the base branch:

   ```bash
   git fetch origin develop
   git checkout develop && git merge --ff-only origin/develop
   git checkout -b chore/wiki-lint-YYYY-MM-DD
   ```

   Keeps maintenance commits separate from feature work.

2. **Check append-only files for overflow** before dispatching:

   ```bash
   # log.md: count session entries
   grep -c "^## \[" docs/wiki/log.md 2>/dev/null || echo 0
   ```

   - **`log.md` ≥ 100 entries:** Instruct the maintainer to move entries older than 90 days into `docs/wiki/summaries/log-archive-YYYY.md`, leaving only the most recent 30 entries in `log.md`. The archive file is append-only going forward.

   `log.md` grows unboundedly; models loading it lose signal in the noise. The archive is reference-only — agents never load it by default. (Shipped work isn't tracked in a `completed.md` — git history is the record.)

3. **Dispatch `wiki-maintainer`** with:
   - The current `docs/wiki/wiki-todos.md` content.
   - The list of raw files added since the last summary in `docs/wiki/summaries/`.
   - The overflow check results from step 2 (so the maintainer knows which archival tasks apply).
   - Explicit instructions: process the queue, ingest, lint, archive overflow, and produce a summary at the end.

4. **Maintainer writes:**
   - Resolved `wiki-todos` lines (removed).
   - New `summaries/` pages for any ingested raw sources.
   - Updates to entity/concept/decision pages, including cross-links so new pages are reachable (no central index).
   - Archival files under `docs/wiki/summaries/` if overflow thresholds were hit.
   - A log entry to `log.md`.

5. **Review the diff** — `git diff --stat`. Sanity-check:
   - No code outside `docs/wiki/` was touched.
   - No raw files were modified.
   - No mass rewrites of entity pages (the maintainer is conservative; a 500-line entity diff is a red flag).

6. **Commit and push.** Push immediately — an unpushed commit is lost when the container recycles (see `.claude/rules/behavioral.md` #19):

   ```bash
   git add docs/wiki/
   git commit -m "chore(wiki): lint — <N todos processed, M orphans, K broken links>"
   git push -u origin chore/wiki-lint-YYYY-MM-DD
   ```

7. **Merge into `develop` (human-approved).** Like a feature cycle, the maintenance branch is integrated by the agent after the human approves — follow the `branch-merge` skill (`--no-ff` into `develop`, then delete the branch). If the human holds, leave it pushed and unmerged.

8. **Report to the human.** What was processed, what remains. If the maintainer flagged contradictions or stale claims it couldn't auto-fix, list them explicitly — the human or `/project:interview` resolves which version is correct.

## Failure modes

- **Maintainer touches code outside `docs/wiki/`.** Reset; that's a behavioral violation. Re-dispatch with stricter instructions.
- **Maintainer rewrites large sections of an entity page.** Reset; entity rewrites go through `/project:interview`. The maintainer's job is structure, not content overhaul.
- **Conflicting versions of the same fact in two pages.** Don't auto-resolve. File both in the report and run `human-checkpoint` to decide which is correct.

## What you do NOT do

- **No code changes.** This is wiki-only.
- **No raw edits.** Append-only there.
- **No silent merges of contradictions.** Flag, don't bury.
