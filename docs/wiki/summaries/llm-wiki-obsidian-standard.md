---
aliases: [Prompt — Compilador y mantenedor de LLM-Wiki, LLM-wiki compiler prompt]
type: summary
domains: [knowledge, agents]
status: stable
sources:
  - docs/raw/llm-wiki-obsidian-standard.md
contradicts: []
open_questions: []
created: 2026-07-21
updated: 2026-07-21
---

# LLM-wiki Obsidian standard (source summary)

> [!abstract] Essence
> A system-prompt-style standard for an agent that compiles append-only raw sources into an atomic, reconciled Obsidian wiki and maintains it: verified Obsidian hard rules, a canonical page template, closed facet vocabularies, a fixed link ontology with expected links, computable gap/contradiction detection, a maintenance contract, and a migration procedure for legacy pages.

## Summary

The document (in Spanish) defines the compiler + librarian role over a `raw/ → wiki/` loop: the human deposits sources and answers clarification questions; the agent compiles, deduplicates, reconciles, and asks rather than inventing. Its structural principle is that a field or convention is only justified if it makes an absence or a conflict computable.

It fixes: Obsidian hard rules (flat frontmatter, plural special keys, quoted solitary wikilinks in list properties, filename-as-identity with `aliases`, illegal filename characters); atomicity (one page = one concept, merge only whole concepts); a canonical template (Essence callout → Model → Detail → Boundaries → Provenance, with facets `type`/`abstraction`/`domains`/`status`); a six-relation link ontology each carrying a gap rule; a maintenance contract (placement, merge, split, reconciliation pass, escalation, lint invariants); computable gap detection expressible as Bases/Dataview queries; and a nine-step migration procedure for existing pages, including a before/after example.

## Key claims

- Nested YAML objects render as illegible blobs in Obsidian properties; relations must be flat top-level list properties ← `docs/raw/llm-wiki-obsidian-standard.md` §2.
- Wikilinks in properties only count for graph/backlinks when quoted and solitary, one per list element ← §2.
- A note's identity is its filename; `aliases` is the anti-duplicate mechanism ← §2–3.
- Each relation type has expected links, from which gaps are computed (e.g. every technique should implement ≥1 principle) ← §6, §8.
- Unresolved `contradicts` is a reconciliation flag routed to a human decision queue ← §6–8.
- Migration must move facts without rewriting them, delete nothing, and record unfillable holes as `open_questions` rather than inventing content ← §9.

## Boundaries

- The source ships Spanish vocabulary; this repo adopted a 1:1 English translation and project-role extensions — see [[decisions/2026-07-21-adopt-obsidian-llm-wiki-standard]].
- The source has no notion of TDD entity pages, ADR lifecycles, or operational ledgers; those are project extensions layered onto it.

## Updates to the wiki

- Methodology adopted repo-wide: `CLAUDE.md` (Frontmatter convention), behavioral rule 18, `wiki-update` + `decision-recording` skills, `wiki-maintainer` agent, `/project:wiki-lint`, `/project:wiki-ingest`.
- Legacy-page migration queued in [[wiki-todos]].
