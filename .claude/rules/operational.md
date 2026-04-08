---
paths: ["**"]
---
# Operational Rules

## Memory Protocol
- Load `docs/agent-context/quick-ref.md` and `docs/agent-context/active-todos.md` at the start of every task.
- Load full docs (architecture.md, etc.) only when quick-ref doesn't have what you need.
- After completing significant work, update your agent memory with patterns and decisions discovered.

## Workflow Rules
- Use existing slash commands and workflows before improvising.
- Never modify docs directly — use the docs-maintainer agent (except commands-registry.md which any agent may append to).
- Always branch before implementing. Never commit to main directly.
- Use conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.

## Sub-Agent Dispatch
- Each sub-agent gets scoped context, not your full setup.
- Research before build: dispatch the researcher agent before the implementer for any non-trivial task.
- Suggest `/rename <task-description>` at the start of each work session.

## Style & Git Rules
- These belong in skills, not here. This file is for universal operational behavior only.
