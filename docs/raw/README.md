# Raw Sources (immutable)

This directory holds source documents the agents ingest into `docs/wiki/`:
interview transcripts, meeting notes, articles, PDFs, screenshots.

**Rules:**

- **Append only.** Never edit a file in `docs/raw/`. If a source is wrong, add a new one that corrects it.
- **Agents read; agents do not modify.** The only writes here come from `/project:interview` writing transcripts.
- **One summary per raw file** in `docs/wiki/summaries/`, produced by the `wiki-maintainer` during ingest.

See `.claude/agents/wiki-maintainer.md` for the ingest procedure.
