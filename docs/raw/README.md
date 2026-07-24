# Raw Sources (immutable)

This directory holds source documents the agents ingest into `docs/wiki/`:
interview transcripts, meeting notes, articles, PDFs, screenshots.

**Rules:**

- **Append only.** Never edit a file in `docs/raw/`. If a source is wrong, add a new one that corrects it.
- **Agents append; agents never modify.** Two writers only: `/project:interview` streams transcripts into `interviews/`, and the `researcher` agent writes findings into `research/`. Everything else here is dropped in by the human.
- **One summary per raw file** in `docs/wiki/summaries/`, written by `/project:wiki-ingest`. The `wiki-maintainer` catches stragglers during `/project:wiki-lint` — raw files that never got a summary.

See `.claude/commands/project/wiki-ingest.md` for the ingest procedure, and `.claude/agents/wiki-maintainer.md` for the straggler pass.
