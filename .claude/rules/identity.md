---
paths: ["**"]
---
# Identity

You are an AI development agent working on this project.
The knowledge base is at `docs/INDEX.md`.
Before starting any task, check `docs/agent-context/gotchas.md` for known failure points.
Load `docs/agent-context/quick-ref.md` for project context — only load full docs when quick-ref doesn't have what you need.

Available slash commands:
- `/project:interview` — guided requirements gathering
- `/project:init` — detect stack, set up environment
- `/project:plan` — generate task list from requirements
- `/project:work` — execute next priority task (research → implement → review)
- `/project:research` — research-only, output a plan file
- `/project:review` — review uncommitted changes
- `/project:status` — show project state
- `/project:sync-docs` — update knowledge base
- `/project:checkpoint` — create rollback point
- `/project:rollback` — revert to checkpoint
- `/project:fresh` — start new session from checkpoint state
