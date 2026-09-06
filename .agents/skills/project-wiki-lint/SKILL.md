---
name: "project-wiki-lint"
description: "Periodic wiki health check. Dispatches the wiki-maintainer to process the wiki-todos.md queue, run the computable reconciliation pass (schema gaps, asymmetric relations, unresolved contradicts), check lint invariants, find orphans, broken [[links]], stale claims, and missing ADRs. Run every few work cycles or when wiki-todos.md is piling up."
---

<!-- Generated from .harness/commands/project/wiki-lint.md; DO NOT EDIT. Run node scripts/sync-harness.mjs. -->

# project-wiki-lint

**Conductor only.** Follow `mcp-coordination` for every worker dispatch, status
check, cancellation, and local integration. A worker must return a result or
blocker instead of invoking this command. Never substitute native delegation.

**Argument:** `user-provided context following this skill invocation (empty if omitted)`

The argument **narrows the pass** — a subtree (`entities/ only`, `summaries/`), a specific check (`broken links`, `orphans`, `archive the log`), or a queue slice (`just the wiki-todos backlog`). Pass it to the maintainer in step 4 and have it skip the checks outside that focus, so a targeted pass stays cheap. Empty argument means the full health pass described below.

Only an explicit human invocation of this command or request for wiki maintenance
allows the conductor to dispatch `wiki-maintainer`. Cadence heuristics are
recommendations, never auto-dispatch authorization. This command conducts a **periodic** health pass, not an every-cycle action. Heuristics:

- `docs/wiki/wiki-todos.md` has > 10 unticked entries.
- Open `[adversary]` todos have reached `FINDINGS_MAX` (`docs/wiki/todos.md § Filed-findings backlog`).
- Last `project-wiki-lint` was > 5 work cycles ago.
- `project-review` flagged drift.
- A new batch of raw sources landed in `docs/raw/`.

## Preconditions

- Working tree clean (the maintainer will write to `docs/wiki/`).
- `docs/wiki/` exists with at least `requirements.md` and `wiki-todos.md`.

If dirty: run `human-checkpoint`.

## Steps

1. **Sync develop.** Run the guarded sync block in `.harness/skills/feature-branching/sync-develop.md` (read it; its stop conditions apply).

2. **Check append-only files for overflow** before dispatching:

   ```bash
   # log.md: count session entries
   grep -c "^## \[" docs/wiki/log.md 2>/dev/null || true
   ```

   - **`log.md` ≥ 100 entries:** Instruct the maintainer to move all but the most recent 30 entries into `docs/wiki/summaries/log-archive-YYYY.md` (age is irrelevant — recency is the only criterion). The archive file is append-only going forward.

   `log.md` grows unboundedly; models loading it lose signal in the noise. The archive is reference-only — agents never load it by default. (Shipped work isn't tracked in a `completed.md` — git history is the record.)

3. **Re-triage the filed-findings backlog.** Rule 20 files every `minor` adversary finding as a todo and nothing else ever drains them, so this pass is their only consumer (behavioral rule 22):

   ```bash
   grep -c '^- \[ \] \[adversary\]' docs/wiki/todos.md 2>/dev/null || true        # against FINDINGS_MAX
   grep -n '^- \[ \] \[adversary\]' docs/wiki/todos.md 2>/dev/null | head -20   # oldest first — head's exit status, not grep's, ends the pipe
   ```

   Collect the entries for the maintainer to inspect oldest-first and return one of
   three outcomes per entry. Do not dirty the integration checkout before spawning:
   - **Closed** — later work already fixed it, or it duplicates another entry. Verify by reading the code, not by assuming; a duplicate merges into the entry that stays.
   - **Re-graded** — its severity was wrong when filed. A finding that has sat through two of these passes untouched is telling you it was never a `minor`; either promote it to a priority that will actually be worked, or close it as not worth doing.
   - **Kept** — still true, still worth doing, correctly graded.

   Closing needs the same one-line reason in the commit body that rejecting a finding needs (rule 20). A backlog pruned silently is a backlog deleted, and the next adversary round re-finds every one of them.

4. **Call `spawn_worker` for `wiki-maintainer`**, with `docs/wiki/` as its
   explicit owned scope (or narrower paths when the focus permits), including:
   - The focus from the argument, if any — and an explicit instruction to skip checks outside it.
   - The current `docs/wiki/wiki-todos.md` content and the backlog re-triage request
     from step 3; the worker makes approved mechanical queue edits in its worktree.
   - The list of raw files added since the last summary in `docs/wiki/summaries/`.
   - The overflow check results from step 2 (so the maintainer knows which archival tasks apply).
   - Explicit instructions: process the queue, ingest, run the **reconciliation pass** (computable gaps: techniques without `implements`, instances without `specializes`, broken `depends_on` targets, ≥3-reference terms without a page, orphaned **content** pages only — ledgers, root spec pages and folder READMEs are navigational and exempt — asymmetric `contrasts_with`/`alternative_to`, unresolved `contradicts`, dangling `<file>.md § <Section>` citations from `.harness/rules`/`.harness/skills`/`.harness/commands` whose target section doesn't exist yet), check the **lint invariants** (illegal filename characters, broken wikilinks, nested frontmatter objects, unquoted/multiple wikilinks in properties, out-of-vocabulary `type`/`abstraction`/`status`, singular `tag`/`alias` keys, claims without provenance), migrate any queued legacy pages, archive overflow, and end with a summary plus a **single batched lot of clarification questions** for the human.

5. **Maintainer writes and locally commits in its own worktree:**
   - Resolved `wiki-todos` lines (removed).
   - New `summaries/` pages for any ingested raw sources.
   - Updates to entity/concept/decision pages, including cross-links so new pages are reachable (no central index).
   - `status: stub` pages for missing prerequisites / heavily-referenced terms (never invented content).
   - Legacy pages migrated to the Obsidian standard (frontmatter mapped, body moved into the disclosure spine — facts moved, not rewritten).
   - Archival files under `docs/wiki/summaries/` if overflow thresholds were hit.
   - A log entry to `log.md`.

6. **Collect and review the completed task.** Poll `check_worker_status`, read
   the complete report and commit diff, and sanity-check:
   - No code outside `docs/wiki/` was touched.
   - No raw files were modified.
   - No mass rewrites of entity pages (the maintainer is conservative; a 500-line entity diff is a red flag).

7. **Integrate through MCP and push the integration branch.** Follow
   `mcp-coordination` with the inspected target and worker SHAs. The worker has
   already committed its wiki changes locally; do not stage another checkout's
   files. Verify the integrated wiki diff and push the conductor's branch.
   Preserve every backlog closure/regrade reason in the worker or conductor commit
   body. If it is missing, record it before reporting the pass complete.

8. **Report to the human.** What was processed, what remains, gaps and contradictions detected — and the maintainer's **batched clarification questions in one lot** (contradictions, gaps needing knowledge outside `docs/raw/`, ambiguous merges). The human or `project-interview` resolves which version is correct; unresolved `contradicts` entries stay flagged until then.

## Failure modes

- **Maintainer touches code outside `docs/wiki/`.** Reject integration, preserve
  the worktree and report the ownership violation. Never automatically reset.
- **Maintainer rewrites large sections of an entity page.** Preserve the result
  and ask before integration; content overhaul belongs to `project-interview`.
- **Conflicting versions of the same fact in two pages.** Don't auto-resolve. File both in the report and run `human-checkpoint` to decide which is correct.

## What you do NOT do

- **No code changes.** This is wiki-only.
- **No raw edits.** Append-only there.
- **No silent merges of contradictions.** Flag, don't bury.
