# Interviews

Transcripts produced by `/project:interview`. Append-only.

## Naming

`YYYY-MM-DD-<slug>.md` — the slug matches the topic of the interview (often a new entity slug).

## What's in here vs in the wiki

- This folder: the **raw transcript** — every Q+A as it happened, preserved verbatim. Immutable.
- `docs/wiki/requirements.md`, `docs/wiki/architecture.md`, `docs/wiki/entities/<slug>.md`, `docs/wiki/decisions/`, `docs/wiki/todos.md`: the **structured outputs** — `/project:interview` writes these itself after the interview ends.

An interview does **not** normally get a `docs/wiki/summaries/` page: its content lands directly in the structured outputs above. Run `/project:wiki-ingest docs/raw/interviews/<file>.md` only if you want a standalone digest of the transcript as well.

The `/project:interview` command writes here first — question to disk, ask, answer to disk — then produces the structured outputs.

## Rule

**Never edit a prior answer in a transcript.** If you got it wrong, run `/project:interview` again on the same topic and write a new transcript. Later transcripts win; the wiki-maintainer flags surviving contradictions during `/project:wiki-lint`.
