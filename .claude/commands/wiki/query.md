---
name: wiki-query
description: Answer a question from the wiki with citations. Optionally file the answer back as a concepts/ page if it's non-obvious.
type: command
---

Run **inline** in the main context (no sub-agent). Load the `wiki-schema` skill first — its query procedure is authoritative.

## Summary of the procedure (see the skill for detail)

1. Read `docs/wiki/index.md` to locate candidate pages. Use `qmd search "<question>" docs/wiki/` if `qmd` is installed.
2. Read relevant pages, follow `[[wiki-links]]` where they add context.
3. Synthesize an answer. **Every claim must cite** a wiki page using `[[path/to/page#section]]`. Cite raw sources from the page's `sources:` frontmatter when origin matters.
4. If the wiki is insufficient, say so — do not speculate. Suggest raw sources or web searches that could fill the gap.

## File back

If the answer is non-obvious (a comparison, analysis, or cross-cutting connection), ask:

> "This looks worth keeping. File it as `docs/wiki/concepts/<slug>.md`?"

If the user agrees, follow the file-back steps in the skill (concept page + backlinks + `index.md` + log entry).

## Rules

- Never fabricate citations.
- If pages contradict each other, surface it in the answer and flag it for the next `/wiki:lint`.
