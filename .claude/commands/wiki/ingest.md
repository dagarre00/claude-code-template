---
name: wiki-ingest
description: Process pending raw sources in docs/raw/ into the wiki. Creates/updates summary, entity, concept, and decision pages; cross-links; logs.
type: command
---

Dispatch the **wiki-maintainer** agent. It loads the `wiki-schema` skill and follows the ingest procedure there.

## Inputs

- Optional argument: path to a specific raw source (relative or absolute). If omitted, process every row in `docs/raw/index.md` with `status: pending`.

## Report back

Tell the user every wiki page touched so they can browse the diff in Obsidian. If a single source touched fewer than 5 pages, flag it as likely under-integrated and ask whether the agent should revisit.
