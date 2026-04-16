---
name: concepts-index
description: Index of pattern, convention, and domain-concept pages. Reusable knowledge that isn't tied to one feature.
type: wiki-index
updated: 2026-04-15
---

# Concepts

Patterns, conventions, domain ideas that span features. Also the landing spot for query outputs that are worth keeping (comparisons, analyses, cross-cutting observations).

## Template

```markdown
---
name: <concept-slug>
description: <one-line — what this concept is>
type: wiki-concept
sources: [../raw/...]
updated: YYYY-MM-DD
---

# <Concept Name>

## What it is
Concise definition.

## Why it matters
How this shows up in the code or product.

## Where it appears
- [[../entities/<x>]]
- [[../entities/<y>]]

## Code Locations

<!-- Last verified: YYYY-MM-DD -->
Key files and symbols where this concept is implemented:

- `patternOrHelper()` — `src/shared/helpers.ts:10`
- `CONCEPT_CONSTANT` — `src/config.ts:30`

_Paths are relative to project root._

## Related concepts
- [[<other-concept>]]
```

## Pages

*(none yet)*
