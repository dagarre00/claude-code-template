---
name: summaries-index
description: Index of per-source summary pages. One page per ingested raw source.
type: wiki-index
updated: 2026-04-15
---

# Source Summaries

One page per ingested raw source. Contains the key takeaways, extracted entities, and links to every wiki page touched by the source.

## Template

```markdown
---
name: <source-slug>
description: <one-line — what this source is about>
type: wiki-summary
source: ../raw/<path-to-raw-source>
ingested: YYYY-MM-DD
updated: YYYY-MM-DD
---

# Summary: <Source Title>

## One-paragraph summary
What the source is about.

## Key takeaways
- Point 1
- Point 2

## Entities touched
- [[../entities/<x>]] — how it was updated
- [[../entities/<y>]]

## Concepts introduced or revised
- [[../concepts/<z>]]

## Contradictions flagged
> ⚠ contradicts [[../entities/<x>#<section>]]: <describe>

## Open questions raised
-
```

## Pages

*(none yet — populated on `/wiki:ingest`)*
