---
aliases: [Concepts guide]
type: reference
domains: [knowledge]
status: stable
sources: []
contradicts: []
open_questions: []
created: 2026-04-15
updated: 2026-07-21
---

# Concepts

> [!abstract] Essence
> Patterns, conventions, and domain ideas that recur across the project. Concept pages exist so the same explanation does not get rewritten in three different entity pages.

## When to file a concept page

- A pattern (retry, caching, pagination, request-validation, etc.) appears in three or more entity pages or concepts in their own words.
- Domain terminology that requires a definition multiple places refer to.
- A reusable approach the team should follow consistently.

For one-off explanations, keep it inside the entity page. Promote to a concept only when reuse is real.

## Page shape

Use the canonical template in the `wiki-update` skill: Obsidian-standard frontmatter (`type: concept`, `abstraction`, `domains`, `status`, relation properties) and the disclosure spine — `> [!abstract] Essence`, `## Model`, `## Detail`, `## Boundaries`, `## Provenance`. Run the placement check before creating: the pattern may already exist under another name in `aliases`.

## Filing

The `wiki-maintainer` promotes concepts from recurring text (see `wiki-todos.md` queue). Other agents may file a `status: stub` concept inline when they spot a clear pattern, but the maintainer normalizes it later.
