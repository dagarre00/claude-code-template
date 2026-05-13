# Research

Raw research documents produced by the `researcher` agent during `/wiki-ingest` research mode. Append-only.

## Naming

`<slug>.md` in kebab-case — the slug matches the research topic.

## What's in here vs in the wiki

- This folder: the **raw research** — structured findings, sources, and notes as produced by the `researcher` agent. Immutable.
- `docs/wiki/summaries/<slug>.md`: the **digested summary**, produced during `/wiki-ingest`.
- `docs/wiki/entities/`, `docs/wiki/decisions/`, `docs/wiki/concepts/`: the **structured outputs** where research findings land.

## Rule

**Never edit a raw research file after it's written.** If the research is stale, run `/wiki-ingest search for <topic>` again and write a new file. The wiki-maintainer reconciles versions during `/wiki-lint`.
