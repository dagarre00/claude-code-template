---
name: concepts-readme
description: Guide to the concepts directory — when and how to file a concept page.
type: wiki-index
updated: 2026-05-11
status: approved
---

# Concepts

Patterns, conventions, and domain ideas that recur across the project. Concept pages exist so the same explanation does not get rewritten in three different entity pages.

## When to file a concept page

- A pattern (retry, caching, pagination, request-validation, etc.) appears in three or more entity pages or concepts in their own words.
- Domain terminology that requires a definition multiple places refer to.
- A reusable approach the team should follow consistently.

For one-off explanations, keep it inside the entity page. Promote to a concept only when reuse is real.

## Page shape

```yaml
---
name: <slug>
description: <one line>
type: wiki-concept
updated: YYYY-MM-DD
status: draft | approved
tags: [...]
---
```

Body: 1–2 paragraphs explaining the pattern as it applies *in this project*, followed by `## When to use`, `## When NOT to use`, and `## Examples` linking to entities that use it.

## Filing

The `wiki-maintainer` promotes concepts from recurring text (see `wiki-todos.md` queue). Other agents may file a stub concept inline when they spot a clear pattern, but the maintainer normalizes it later.
