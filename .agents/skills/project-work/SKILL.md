---
name: project-work
description: Pick the top todo (or batch consecutive todos sharing context), open a feat/* branch from develop, dispatch the planner for complex/batched work, then the developer through red→green→refactor→wiki-update, then commit, push, and (if the entity is fully done) open a PR to develop and return to develop. The core development loop. Trigger on "/project:work", "/work", "work on todo", "start development", "implement entity".
---

# /project:work (Command)

The authoritative procedure for this command is defined in [`.claude/commands/project/work.md`](../../../.claude/commands/project/work.md).

Extract any target scope, entity, or batching instructions directly from the user prompt (e.g. `/work <scope>`). Read that command document and follow its preconditions, steps, and failure modes verbatim, applying the Antigravity runtime mappings from [`AGENTS.md`](../../../AGENTS.md).
