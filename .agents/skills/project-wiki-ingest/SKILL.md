---
name: project-wiki-ingest
description: Direct ingest of a file or research topic into the wiki. Use to ingest a document (e.g. specification.pdf), or research and ingest a topic (e.g. search for exchange rates APIs). Focused — no lint pass, just ingest. Trigger on "/project:wiki-ingest", "/wiki-ingest", "ingest document", "research and ingest", "ingest file into wiki".
---

# /project:wiki-ingest (Command)

**Argument:** `$ARGUMENTS`

The authoritative procedure for this command is defined in [`.claude/commands/project/wiki-ingest.md`](../../../.claude/commands/project/wiki-ingest.md).
Follow that document's steps and preconditions verbatim, applying the Antigravity runtime mappings from [`AGENTS.md`](../../../AGENTS.md).

## Summary of Procedure

1. **Sync develop:** Run the canonical guarded sync in [`.claude/skills/feature-branching/sync-develop.md`](../../../.claude/skills/feature-branching/sync-develop.md).
2. **File Mode:** If argument is an existing file path:
   - Read file and check placement/dedup against `docs/wiki/`.
   - Write summary at `docs/wiki/summaries/<slug>.md` using the canonical template from [`.claude/skills/wiki-update/SKILL.md`](../../../.claude/skills/wiki-update/SKILL.md).
   - Cross-link against affected wiki pages and flag any contradictions.
   - Append to `docs/wiki/log.md`, commit, and push.
3. **Research Mode:** If argument is a search/research topic:
   - Dispatch `researcher` subagent (TypeName: `research` or `self`, Role: `Researcher`, Model: `inherit`) following [`.claude/agents/researcher.md`](../../../.claude/agents/researcher.md).
   - Read raw research at `docs/raw/research/<slug>.md`.
   - Compile summary page at `docs/wiki/summaries/<slug>.md`, cross-link, log, commit, and push.
