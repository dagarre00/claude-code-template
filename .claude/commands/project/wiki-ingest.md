---
name: wiki-ingest
description: Direct ingest of a file or research topic into the wiki. Use /wiki-ingest specification.pdf to ingest a document, or /wiki-ingest search for exchange rates APIs to research and ingest. Focused — no lint pass, just ingest.
type: command
---

# /wiki-ingest

Ingest a file or research topic directly into the wiki. Two modes:

- **File mode:** `/wiki-ingest path/to/file.pdf` — read a local file and produce a `summaries/` page.
- **Research mode:** `/wiki-ingest search for exchange rates APIs` — search the web, produce raw research, then ingest it.

This is **focused ingest only** — no orphan scan, no link audit, no lint pass. For the full health pass, use `/wiki-lint`.

## Preconditions

- Working tree clean (or only `docs/` dirty).
- `docs/wiki/summaries/` directory exists.
- For file mode: the target file must exist and be readable.
- For research mode: internet access available.

If dirty outside `docs/`: run `human-checkpoint`.

## Steps — file mode

Triggered when the argument is a path to an existing file (e.g., `/wiki-ingest docs/spec.pdf`, `/wiki-ingest meeting-notes.md`).

1. **Read the file.** If it's a PDF, read all pages. If it's markdown or plain text, read it fully.

2. **Derive a slug** from the filename: `specification.pdf` → `specification`, `meeting-notes.md` → `meeting-notes`. If the slug collides with an existing summary, append a discriminator (`-2`, `-3`).

3. **Write the summary page** at `docs/wiki/summaries/<slug>.md`:

   ```markdown
   ---
   name: <slug>
   description: <one-line summary of what this source is>
   type: wiki-summary
   updated: YYYY-MM-DD
   status: draft
   sources: [docs/raw/<path>]
   tags: [...]
   ---

   # <Title>

   **Source:** <path>
   **Date:** <date from file or today if unknown>

   ## Summary
   2-3 paragraphs: what this source says, who it's from, why it matters to this project.

   ## Key claims
   - Claim 1
   - Claim 2
   - ...

   ## Open questions
   - Things the source raises but doesn't answer.
   - Things that contradict existing wiki pages (link them with [[wiki-links]]).

   ## Updates to the wiki
   - Which entity/concept/decision pages you updated based on this source.
   ```

   If the source is already in `docs/raw/`, great — use that path. If it's outside (e.g., a PDF the human just dropped in the repo root), note its current location and suggest moving it to `docs/raw/` in the report.

4. **Cross-link.** Grep `docs/wiki/` for terms from the summary. If an entity or concept page overlaps with claims from the source, add a `[[summaries/<slug>]]` reference in that page's "Related" section. If the source contradicts an existing claim, flag it with `> [!contradiction]` in the summary and note it in both pages.

5. **Update `docs/wiki/index.md`** — add the new summary page under the "Summaries" section.

6. **Append to `docs/wiki/log.md`:**
   ```markdown
   ## [YYYY-MM-DD HH:MM] /wiki-ingest file
   - Ingested: <path> → [[summaries/<slug>]]
   - Cross-links added: <list>
   ```

7. **Commit:**
   ```bash
   git add docs/wiki/
   git commit -m "docs: ingest <filename> → [[summaries/<slug>]]"
   ```

8. **Report** to the human: slug, summary path, key claims, any contradictions flagged.

## Steps — research mode

Triggered when the argument is a research query (starts with "search for", "research", "find", "look up", etc. — or when the argument is not a path to an existing file).

1. **Dispatch the `researcher` agent** with the research query. The agent will:
   - Search the web
   - Fetch relevant pages
   - Write `docs/raw/research/<slug>.md`

2. **Wait for the researcher to complete.** If the researcher fails (no results, all sources unreachable), report and stop.

3. **Read the raw research** at `docs/raw/research/<slug>.md`.

4. **Write the summary page** at `docs/wiki/summaries/<slug>.md` following the same template as file mode (above). The `sources:` frontmatter points to the raw research file.

5. **Cross-link** against existing wiki pages (same as file mode step 4).

6. **Update `docs/wiki/index.md`** and `docs/wiki/log.md` (same as file mode steps 5-6).

7. **Commit:**
   ```bash
   git add docs/raw/research/ docs/wiki/
   git commit -m "docs: ingest research <slug> → [[summaries/<slug>]]"
   ```

8. **Report** to the human: topic, slug, top findings, key recommendations, any contradictions flagged.

## Ambiguous case

If the argument could be either (e.g., `search.md` — it's both a valid file path and looks like a research topic), prefer **file mode**. The human can disambiguate by prefixing with "search for".

## Failure modes

- **File not found / unreadable.** Report the exact error. Don't guess the format.
- **PDF too large.** If a PDF has >20 pages, read it in chunks and synthesize progressively. If it's >100 pages, ask the human which sections matter.
- **Researcher returns nothing.** Report and stop. Don't fabricate a summary from thin air.
- **Slug collision.** Append `-2`, warn the human.
- **Contradiction with existing wiki page.** Flag in the summary with `> [!contradiction]` and in the conflicting page. Don't silently resolve.

## What you do NOT do

- **No lint pass.** This is ingest only. For lint, use `/wiki-lint`.
- **No code changes.** This touches `docs/wiki/` and `docs/raw/` only.
- **No raw edits.** The raw source is immutable.
- **No silent contradiction resolution.** Flag both sides; let the human or `/interview` decide.
- **No mass rewrites of entity pages.** A cross-link is fine; a full entity-page rewrite to match a new source is `/interview` territory.

## Wiki updates

- `docs/wiki/summaries/<slug>.md` (new)
- `docs/wiki/index.md` (one line added)
- `docs/wiki/log.md` (one entry appended)
- Possibly: entity/concept pages (cross-link in Related section)
