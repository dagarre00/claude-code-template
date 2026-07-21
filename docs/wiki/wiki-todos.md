---
name: wiki-todos
description: Cleanup queue for the wiki-maintainer. Other agents append; /project:wiki-lint processes.
type: wiki-spec
updated: 2026-05-11
status: draft
---

# Wiki Todos

> Queue of cleanup tasks. Agents append a one-line entry whenever they discover something the maintainer should handle later (orphan, missing ADR, repeated concept, broken link). `/project:wiki-lint` processes this queue and removes resolved lines.

## Format
```
- [ ] <YYYY-MM-DD> <agent>: <one-line action>
```

## Pending

- [ ] 2026-07-21 claude: migrate base pages (`requirements`, `architecture`, `git-conventions`, `commands`, `gotchas`, `todos`, `wiki-todos`, `log`) to the Obsidian standard — drop `name`/`description`, add facets (`type: reference` for ledgers), keep body formats; procedure in `wiki-update` skill step 5 of the maintainer contract
- [ ] 2026-07-21 claude: migrate `entities/hooks` to the entity template (Essence callout, facets, relations as properties, Boundaries/Provenance sections) — move facts, don't rewrite them
- [ ] 2026-07-21 claude: migrate the two 2026 ADRs and folder READMEs to the new decision/reference frontmatter (`supersedes`/`superseded_by` empty lists, `created`/`updated`)
- [ ] 2026-07-21 claude: after migration, run the invariants lint wiki-wide (no nested frontmatter, quoted solitary property wikilinks, closed vocabularies, zero broken links)
