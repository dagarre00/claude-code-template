# Interviews

Transcripts produced by `/interview`. Append-only.

## Naming

`YYYY-MM-DD-<slug>.md` — the slug matches the topic of the interview (often a new entity slug).

## What's in here vs in the wiki

- This folder: the **raw transcript** — every Q+A as it happened, preserved verbatim. Immutable.
- `docs/wiki/summaries/<slug>.md`: the **digested summary** of the interview, produced by the wiki-maintainer.
- `docs/wiki/requirements.md`, `docs/wiki/entities/<slug>.md`, `docs/wiki/decisions/`: the **structured outputs** — requirements added, entity created, ADRs filed.

The `/interview` command writes here first, then proposes the structured outputs to the human.

## Rule

**Never edit a prior answer in a transcript.** If you got it wrong, run `/interview` again on the same topic and write a new transcript. The wiki-maintainer reconciles versions during ingest.
