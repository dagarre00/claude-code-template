---
name: wiki-query
description: Answer a question from the wiki with citations. Optionally file the answer back as a concepts/ page if it's non-obvious.
type: command
---

Answer the user's question against `docs/wiki/`. Run **inline** in the main context.

## Procedure

1. Read `docs/wiki/index.md` to locate candidate pages.
2. If `qmd` is installed (`command -v qmd`), prefer it: `qmd search "<question>" docs/wiki/` for hybrid BM25+vector search.
3. Read the relevant pages, follow `[[wiki-links]]` where they add context.
4. Synthesize an answer. **Every claim must cite a wiki page** using `[[path/to/page#section]]` syntax. Cite the raw source from the page's `sources:` frontmatter when the origin matters.
5. If the wiki doesn't have enough to answer, say so explicitly — do not speculate. Suggest which raw sources or web searches could fill the gap.

## File back (optional)

After answering, if the answer is non-obvious (a comparison, analysis, cross-cutting observation, or connection that isn't already captured on a single page), ask:

> "This looks worth keeping. File it as `docs/wiki/concepts/<slug>.md`?"

If the user agrees:
- Write the concepts page using the concepts/ template (see `docs/wiki/concepts/README.md`).
- Link from every relevant existing page back to the new concept.
- Add a row to `docs/wiki/index.md`.
- Append `## [YYYY-MM-DD] query-filed | <title>` to `docs/wiki/log.md`.

## Rules

- Never fabricate citations.
- If pages contradict each other, surface the contradiction in the answer and flag it for the next `/wiki:lint`.
