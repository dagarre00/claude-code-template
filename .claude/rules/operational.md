---
paths: ["**"]
---
# Operational Rules

## Memory Protocol
- Load `docs/wiki/todos.md` and `docs/wiki/gotchas.md` at the start of every task.
- Load `docs/wiki/requirements.md`, `docs/wiki/architecture.md`, and `docs/wiki/entities/<slug>.md` only when the task requires them.
- After completing significant work, write discoveries directly to the relevant wiki pages — no separate memory snapshots.

## Workflow Rules
- Use existing slash commands and workflows before improvising.
- Never modify wiki pages outside of a task — use the wiki-maintainer agent.
- Always branch before implementing. Never commit to main directly.
- Use conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.

## Sub-Agent Dispatch
- Each sub-agent gets scoped context — task, prior outputs, relevant constraints. Never dump full memory.
- For complex TODOs: tester → implementer → wiki-maintainer. For simple TODOs: main agent handles all phases.
- Use `/wiki:query <question>` for research before building — there is no separate researcher agent.

## Style & Git Rules
- These belong in skills, not here. This file is for universal operational behavior only.
