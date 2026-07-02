---
name: summaries-readme
description: Guide to the summaries directory — one digest page per ingested raw source.
type: wiki-index
updated: 2026-05-11
status: approved
---

# Summaries

One summary page per ingested raw source in `docs/raw/`. The summary is what the rest of the wiki cross-references — entities, concepts, and decisions link to the summary, not to the raw file.

## Filing

The `wiki-maintainer` agent produces these during ingest. See `.claude/agents/wiki-maintainer.md` for the procedure.

## Page shape

```yaml
---
name: <slug>
description: <one line>
type: wiki-summary
updated: YYYY-MM-DD
status: draft | approved
sources: [docs/raw/<file>]
tags: [...]
---
```

Body: a tight summary of the source (what it says, who it's by, when, key claims), followed by `## Key claims`, `## Open questions`, and `## Updates to the wiki` listing which entity / concept / decision pages this source touched.

## Why these aren't the source

The raw file in `docs/raw/` is **immutable** — that's the source of truth. The summary is the *digestible* version for ongoing reference. Cross-link the summary, cite the raw file when accuracy matters.
