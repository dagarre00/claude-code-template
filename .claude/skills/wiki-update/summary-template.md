# Summary page template (`docs/wiki/summaries/<slug>.md`)

One page per ingested raw source. Run the placement check first: an existing summary or concept page that already covers the material is **updated** — new claims merged into the right section, `sources` extended, `updated` bumped — never duplicated.

**Slug** from the source's name (`specification.pdf` → `specification`). A collision with a genuinely different concept takes a discriminator (`-2`, `-3`) and records the near-miss in `aliases`; a collision with the same concept under another name means updating that page instead.

**Reading.** PDFs: every page; over 20 pages, chunk and synthesize progressively; over 100, ask which sections matter before starting.

```markdown
---
aliases: [<alternative names for this source or topic>]
type: summary
domains: [<domain>]
status: developing
sources:
  - docs/raw/<path>
contradicts: []
open_questions:
  - Things the source raises but does not answer.
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# <Title>

> [!abstract] Essence
> One or two sentences: what this source is and why it matters to this project.

## Summary

Two or three paragraphs: what it says, who it is from, why it matters.

## Key claims

- Claim ← `docs/raw/<path>` (every non-trivial claim keeps its provenance)

## Boundaries

- Claims contradicting existing pages — linked, with `contradicts` set on both pages.
- Unverified or unsourced claims.

## Updates to the wiki

- The entity, concept and decision pages updated from this source.
```

`sources:` points at the raw file — the researcher's `docs/raw/research/<slug>.md`, or the ingested file's path. A source still outside `docs/raw/` keeps its current path; flag the move in your report.

**Cross-link.** Grep `docs/wiki/` for the summary's terms. Where an entity or concept page overlaps, reference `[[summaries/<slug>]]` in its body and merge new claims into the section they belong to — linking from the pages it informs is what makes a summary reachable. Where the source **contradicts** a page, add each page to the other's `contradicts` and note the conflict in both `## Boundaries` sections; never resolve it silently.
