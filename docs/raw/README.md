# Raw Sources (immutable)

Source documents the agents ingest into `docs/wiki/`: interview transcripts, research, meeting notes, articles, PDFs, screenshots.

- **Append only.** Never edit a file here; a wrong source is corrected by a new one.
- **Two agent writers:** `/project:interview` streams transcripts into `interviews/`, and the `researcher` writes into `research/`. Everything else is dropped in by the human.
- **One summary per source** in `docs/wiki/summaries/`, written by `/project:wiki <source>`; its health pass catches sources that never got one.
