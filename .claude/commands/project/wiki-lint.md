---
name: wiki-lint
description: Periodic wiki health check. Dispatches the wiki-maintainer to process the wiki-todos.md queue, run the computable reconciliation pass (schema gaps, asymmetric relations, unresolved contradicts), check lint invariants, find orphans, broken [[links]], stale claims, and missing ADRs. Run every few work cycles or when wiki-todos.md is piling up.
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

1. **Branch for the maintenance pass:**

   ```bash
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
   - Explicit instructions: process the queue, ingest, run the **reconciliation pass** (computable gaps: techniques without `implements`, instances without `specializes`, broken `depends_on` targets, ≥3-reference terms without a page, orphans, asymmetric `contrasts_with`/`alternative_to`, unresolved `contradicts`), check the **lint invariants** (illegal filename characters, broken wikilinks, nested frontmatter objects, unquoted/multiple wikilinks in properties, out-of-vocabulary `type`/`abstraction`/`status`, singular `tag`/`alias` keys, claims without provenance), migrate any queued legacy pages, archive overflow, and end with a summary plus a **single batched lot of clarification questions** for the human.

4. **Maintainer writes:**
   - Resolved `wiki-todos` lines (removed).
   - New `summaries/` pages for any ingested raw sources.
   - Updates to entity/concept/decision pages, including cross-links so new pages are reachable (no central index).
   - `status: stub` pages for missing prerequisites / heavily-referenced terms (never invented content).
   - Legacy pages migrated to the Obsidian standard (frontmatter mapped, body moved into the disclosure spine — facts moved, not rewritten).
   - Archival files under `docs/wiki/summaries/` if overflow thresholds were hit.
   - A log entry to `log.md`.

5. **Review the diff** — `git diff --stat`. Sanity-check:
   - No code outside `docs/wiki/` was touched.
   - No raw files were modified.
   - No mass rewrites of entity pages (the maintainer is conservative; a 500-line entity diff is a red flag).

6. **Commit and push.** Push immediately (behavioral rule 19):

   ```bash
   git add docs/wiki/
   git commit -m "chore(wiki): lint — <N todos processed, M orphans, K broken links>"
   git push -u origin chore/wiki-lint-YYYY-MM-DD
   ```

7. **Report to the human.** What was processed, what remains, gaps and contradictions detected — and the maintainer's **batched clarification questions in one lot** (contradictions, gaps needing knowledge outside `docs/raw/`, ambiguous merges). The human or `/project:interview` resolves which version is correct; unresolved `contradicts` entries stay flagged until then.

## Failure modes

- **Maintainer touches code outside `docs/wiki/`.** Reset; that's a behavioral violation. Re-dispatch with stricter instructions.
- **Maintainer rewrites large sections of an entity page.** Reset; entity rewrites go through `/project:interview`. The maintainer's job is structure, not content overhaul.
- **Conflicting versions of the same fact in two pages.** Don't auto-resolve. File both in the report and run `human-checkpoint` to decide which is correct.

## What you do NOT do

- **No code changes.** This is wiki-only.
- **No raw edits.** Append-only there.
- **No silent merges of contradictions.** Flag, don't bury.
