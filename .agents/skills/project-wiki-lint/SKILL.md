---
name: project-wiki-lint
description: Periodic wiki health check. Dispatches the wiki-maintainer to process the wiki-todos.md queue, run the computable reconciliation pass (schema gaps, asymmetric relations, unresolved contradicts), check lint invariants, find orphans, broken [[links]], stale claims, and missing ADRs. Run every few work cycles or when wiki-todos.md is piling up. Trigger on "/project:wiki-lint", "/wiki-lint", "lint wiki", "wiki health check", "reconcile wiki", "clean up wiki-todos".
---

# /project:wiki-lint (Command)

The authoritative procedure for this command is defined in [`.claude/commands/project/wiki-lint.md`](../../../.claude/commands/project/wiki-lint.md).

Extract any focus subtree or check filter directly from the user prompt (e.g. `/wiki-lint <focus>`). Read that command document and follow its preconditions, steps, and failure modes verbatim, applying the Antigravity runtime mappings from [`AGENTS.md`](../../../AGENTS.md).
