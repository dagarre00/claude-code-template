---
name: project-wiki-ingest
description: Direct ingest of a file or research topic into the wiki. Use to ingest a document (e.g. specification.pdf), or research and ingest a topic (e.g. search for exchange rates APIs). Focused — no lint pass, just ingest. Trigger on "/project:wiki-ingest", "/wiki-ingest", "ingest document", "research and ingest", "ingest file into wiki".
---

# /project:wiki-ingest (Command)

The authoritative procedure for this command is defined in [`.claude/commands/project/wiki-ingest.md`](../../../.claude/commands/project/wiki-ingest.md).

Extract the target file path or research query directly from the user prompt (e.g. `/wiki-ingest <path or query>`). Read that command document and follow its preconditions, steps, and failure modes verbatim, applying the Antigravity runtime mappings from [`AGENTS.md`](../../../AGENTS.md).
