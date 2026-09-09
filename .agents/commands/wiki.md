---
name: wiki
description: Wiki operations — ingest and health, both dispatched to the wiki-maintainer so the conductor never reads a source or a findings backlog itself. With an argument, ingests one source into the wiki (a file path, or "search for <topic>" to research first). With no argument, runs a periodic health pass — the wiki-todos queue, the reconciliation pass, lint invariants, orphans, broken links, and the filed-findings backlog. Ingest is per-source and on demand; the health pass is periodic.
argument-hint: [path/to/file | search for <topic>] — empty runs the periodic health pass
type: command
skills:
  wiki-maintainer: [wiki-update]
---

# /project:wiki

**Argument:** `$ARGUMENTS`

The argument **picks the mode**. Resolve it before anything else:

- **A path that exists on disk** → **ingest mode**, from the file.
- **Anything else non-empty** (`search for exchange rate APIs`, `research OAuth PKCE`) → **ingest mode**, from web research.
- **Empty** → **health-pass mode**.

Ambiguity (`search.md` is both a real path and a plausible topic) resolves to the file. The human disambiguates by writing `search for …`.

A narrowing phrase alone (`entities/ only`, `broken links`, `archive the log`) is a **health pass with a focus**, not an ingest — it names no source. Pass the focus to the maintainer and have it skip the checks outside it. If you cannot tell whether a non-empty argument names a source or narrows a pass, ask; guessing wrong here either skips a health pass the human wanted or invents a summary page from a lint instruction.

## Preconditions

- **Ingest mode:** working tree clean, except that `docs/` may be dirty and so may the source being ingested — a file the human just dropped anywhere in the repo counts. File ingest needs the target readable; research ingest needs network access.
- **Health-pass mode:** working tree clean. The maintainer writes across `docs/wiki/`, so unrelated dirt there is indistinguishable from its output.
- `docs/wiki/` exists, with `summaries/` for ingest and at least `requirements.md` + `wiki-todos.md` for a health pass.

Any other dirt: `human-checkpoint` (rule 21 — account for every line before assuming it is yours).

## Sync develop

Run the guarded sync block in [`.agents/skills/feature-branching/sync-develop.md`](../skills/feature-branching/sync-develop.md) (read it; its stop conditions apply). Syncing first means the wiki you dedup against is current, not a stale mirror.

---

# Ingest mode

One source in, one `summaries/` page out, cross-linked. **Ingest only** — no orphan scan, no link audit, no lint pass. Those are the health pass. The conductor never reads the source itself — getting it onto disk is the only conductor-side step; reading, dedup, writing and cross-linking all happen in the `wiki-maintainer`'s own worktree, not the conductor's context.

1. **Get the source onto disk — unread.**
   - **From a file:** the path from the argument, already confirmed to exist by the mode resolution above. Nothing to do here; hand the path to the `wiki-maintainer` in step 2.
   - **From research:** dispatch the `researcher` with the query. It searches, fetches, and writes `docs/raw/research/<slug>.md`. Wait for it. If it returns nothing or every source was unreachable, report and stop — never synthesize a summary from thin air. Hand its output path to the `wiki-maintainer` in step 2, same as a file source — the conductor does not read it either.

2. **Dispatch `wiki-maintainer`** with the source path and the instructions below — this is the same reading-and-placement work it already does for straggler sources during a health pass, just aimed at the one source you were just handed instead of a `docs/raw/` sweep:

   - **Read it fully.** PDFs: all pages; >20 pages, chunk and synthesize progressively; >100 pages, ask which sections matter before proceeding.
   - **Placement check (dedup).** Before creating anything, compare the source's essence against existing pages — filenames and `aliases` (`grep -r "aliases:" -A3 docs/wiki/`). An existing summary or concept page already covering this material gets **updated** (merge new claims into the right section, extend `sources`, bump `updated`), never duplicated. Only then derive the slug: `specification.pdf` → `specification`. A slug collision on a genuinely different concept takes a discriminator (`-2`, `-3`) and records the near-miss in `aliases`; a collision on the *same* concept under another name means updating that page instead.
   - **Write `docs/wiki/summaries/<slug>.md`.** Frontmatter per the Obsidian standard — flat, no `name`/`description`, wikilinks in properties quoted and solitary (`wiki-update` skill):

   ```markdown
   ---
   aliases: [<alternative names for this source/topic>]
   type: summary
   domains: [<domain>]
   status: developing
   sources:
     - docs/raw/<path>
   contradicts: []
   open_questions:
     - Things the source raises but doesn't answer.
   created: YYYY-MM-DD
   updated: YYYY-MM-DD
   ---

   # <Title>

   > [!abstract] Essence
   > One or two sentences: what this source is and why it matters to this project.

   ## Summary

   2-3 paragraphs: what this source says, who it's from, why it matters.

   ## Key claims

   - Claim 1 ← `docs/raw/<path>` (every non-trivial claim keeps provenance)
   - Claim 2 ← ...

   ## Boundaries

   - Claims that contradict existing wiki pages (link them with [[wiki-links]] and set `contradicts` on both pages).
   - Unverified or unsourced claims.

   ## Updates to the wiki

   - Which entity/concept/decision pages you updated based on this source.
   ```

   `sources:` points at the raw file — the researcher's `docs/raw/research/<slug>.md`, or the ingested file's own path. A source still outside `docs/raw/` (a PDF dropped in the repo root) keeps its current path here; flag the move in its report.

   - **Cross-link.** Grep `docs/wiki/` for the summary's terms. Where an entity or concept page overlaps, add a `[[summaries/<slug>]]` reference in its body and merge material new claims into the section they belong to. Where the source **contradicts** an existing claim, add `"[[summaries/<slug>]]"` / `"[[<page>]]"` to both pages' `contradicts` and note the conflict in both `## Boundaries` sections — never resolve it silently; unresolved `contradicts` is exactly the flag the health pass reconciles. Linking from the pages it informs is what makes a summary reachable: there is no central index.
   - **Report back:** slug, summary path, key claims, every contradiction flagged, and every page touched (for the cross-links field below).

3. **Review the diff** — `git diff --stat`. Only `docs/wiki/` (and `docs/raw/`, if a source was moved in); no other code, no raw file edits beyond adding the new source.

4. **Log, commit and push** per [`log-and-commit.md`](../skills/feature-branching/log-and-commit.md) — kind `wiki-ingest`, fields `Ingested: <path> → [[summaries/<slug>]]` and `Cross-links added: <list>`, both from the `wiki-maintainer`'s report. Stage `docs/wiki/` and `docs/raw/` (so a source you moved in is tracked rather than left dirty); subject `docs: ingest <name> → [[summaries/<slug>]]`.

5. **Report:** slug, summary path, key claims, and every contradiction flagged — relaying the `wiki-maintainer`'s report.

---

# Health-pass mode

Dispatch the `wiki-maintainer` for a full pass. **Periodic, not every-cycle.** Due when any of these fires:

- `docs/wiki/wiki-todos.md` has > 10 unticked entries.
- Open `[adversary]` todos have reached `FINDINGS_MAX` (`docs/wiki/todos.md § Filed-findings backlog`).
- The last health pass was > 5 work cycles ago.
- `/project:review` flagged drift.
- A new batch of raw sources landed in `docs/raw/`.

1. **Compute the due-checks** — two cheap counts, nothing else. This is the only reading the conductor does before dispatch; everything past it — including reading any individual finding's code to verify a disposition — belongs in the `wiki-maintainer`'s own context, not here:

   ```bash
   grep -c "^## \[" docs/wiki/log.md 2>/dev/null || true                    # log overflow — archive at >= 100
   grep -c '^- \[ \] .*\[adversary\]' docs/wiki/todos.md 2>/dev/null || true  # against FINDINGS_MAX
   ```

2. **Dispatch `wiki-maintainer`** with the focus from the argument (and an explicit instruction to skip checks outside it), the current `wiki-todos.md`, the raw files with no matching summary, and step 1's two counts — never the backlog's own contents, which the maintainer reads from `docs/wiki/todos.md` directly inside its own worktree. Instruct it to:

   - **If the log count is ≥ 100:** move all but the most recent 30 `log.md` entries into `docs/wiki/summaries/log-archive-YYYY.md` (recency is the only criterion — age is irrelevant), append-only from then on. `log.md` grows unboundedly and models loading it lose signal in the noise; the archive is reference-only and never loaded by default. Shipped work is not tracked in a `completed.md` — git history is that record.
   - **Re-triage the filed-findings backlog.** Rule 20 files every `minor` adversary finding as a todo and nothing else drains them, so this pass is their only consumer (rule 22). Oldest first (`grep -n '^- \[ \] .*\[adversary\]' docs/wiki/todos.md`), each gets one of three outcomes:
     - **Closed** — later work already fixed it, or it duplicates another entry. Verify by reading the code, not by assuming; a duplicate merges into the entry that stays.
     - **Re-graded** — its severity was wrong when filed. A finding that has sat through two passes untouched was never a `minor`: promote it to a priority that will actually be worked, or close it as not worth doing.
     - **Kept** — still true, still worth doing, correctly graded.

     Every Closed or Re-graded disposition needs a one-line reason (rule 20) — report each one back individually, not just the tally, so the conductor can carry the reasons into the commit body. A backlog pruned silently is a backlog deleted, and the next adversary round re-finds every one of them.
   - Process the `wiki-todos` queue; ingest the stragglers; run the **reconciliation pass** (computable gaps — techniques without `implements`, instances without `specializes`, broken `depends_on` targets, ≥3-reference terms without a page, orphaned **content** pages only, since ledgers, root spec pages and folder READMEs are navigational and exempt, asymmetric `contrasts_with`/`alternative_to`, unresolved `contradicts`, and dangling `<file>.md § <Section>` citations from `.agents/rules.md`/`.agents/skills`/`.agents/commands`); check the **lint invariants** (illegal filename characters, broken wikilinks, nested frontmatter objects, unquoted or multiple wikilinks in properties, out-of-vocabulary `type`/`abstraction`/`status`, singular `tag`/`alias` keys, claims without provenance); migrate queued legacy pages; archive overflow; and end with a summary plus a **single batched lot** of clarification questions.

3. **Expect back:** resolved `wiki-todos` lines removed; every findings-backlog disposition (Closed / Re-graded / Kept) with its one-line reason; new `summaries/` pages for ingested stragglers; entity/concept/decision updates with cross-links so new pages are reachable; `status: stub` pages for missing prerequisites and heavily-referenced terms (never invented content); legacy pages migrated to the standard (facts moved, not rewritten); archival files if a threshold was hit.

4. **Review the diff** — `git diff --stat`. No code outside `docs/wiki/`, no modified raw files, no mass entity rewrites (a 500-line entity diff is a red flag; the maintainer is meant to be conservative).

5. **Log, commit and push** per [`log-and-commit.md`](../skills/feature-branching/log-and-commit.md) — kind `wiki-maintenance`, staging `docs/wiki/`, subject `chore(wiki): lint — <N todos, M orphans, K broken links, F findings re-triaged>`, body carrying every Closed/Re-graded reason the maintainer reported (rule 20 — a disposition that exists only in a discarded report satisfies nothing).

6. **Report.** What was processed, what remains, gaps and contradictions found — and the maintainer's clarification questions **in one lot**. The human or `/project:interview` decides which version of a contradiction is correct; unresolved `contradicts` stay flagged until then.

---

## Failure modes

- **File not found or unreadable.** Report the exact error; never guess the format.
- **Researcher returns nothing.** Report and stop.
- **Slug collision.** Check first whether it is the same concept under another name — if so, update that page. Genuinely different: discriminator, and warn the human.
- **Contradiction with an existing page.** `contradicts` on both, noted in both `## Boundaries`. Never silently resolved.
- **Maintainer touched code outside `docs/wiki/`, or rewrote large entity sections.** Reset it and re-dispatch with stricter instructions — entity rewrites go through `/project:interview`. The maintainer's job is structure, not content overhaul.

## What you do NOT do

- **No code changes.** `docs/wiki/` and `docs/raw/` only.
- **No raw edits.** Append-only (rule 11).
- **No silent contradiction resolution.** Flag both sides; the human or `/project:interview` decides.
- **No mass entity rewrites.** A cross-link is fine; rewriting an entity page to match a new source is `/project:interview` territory.
- **No lint work during an ingest, and no ingest of a named source during a health pass.** The modes are separate on purpose: ingest is per-source and on demand, the pass is periodic. The maintainer's straggler sweep is the one exception, and it covers raw files nobody ingested — never a source the human just handed you.
