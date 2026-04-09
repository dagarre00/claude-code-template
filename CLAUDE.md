# Project Configuration

## Knowledge Base
Entry point: `docs/INDEX.md`
Quick reference: `docs/agent-context/quick-ref.md`
Gotchas (CHECK BEFORE EVERY TASK): `docs/agent-context/gotchas.md`

## Slash Commands
- `/project:interview` — guided requirements gathering
- `/project:init` — detect stack, set up environment
- `/project:plan` — generate tasks from requirements
- `/project:work` — research → plan → confirm → implement → review
- `/project:research` — research only, output plan file
- `/project:review` — review uncommitted changes
- `/project:status` — show project state and recent changelog
- `/project:sync-docs` — update knowledge base
- `/project:checkpoint` — create rollback point
- `/project:rollback` — revert to checkpoint
- `/project:fresh` — resume from checkpoint in new session

## Golden Rules
1. Never modify docs without the docs-maintainer agent (except commands-registry.md)
2. Always branch before implementing
3. Always run tests before marking a task complete
4. Keep context lean — load quick-ref.md, not full docs, unless you need specifics
5. Changelog logging is enforced by hooks on every Write/Edit
6. Use conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`
7. Context window discipline: if context exceeds 60%, dump state and start fresh
8. Rollback over fix-forward: if implementation fails review, rollback and retry from scratch
9. After any feature is added or changed, update `docs/project-requirements.md` to reflect it — requirements must always match what is actually built

## Agent Routing
| Task Type | Agent |
|-----------|-------|
| Investigate before building | researcher |
| Decompose & coordinate | orchestrator |
| Write code | implementer |
| Review changes | reviewer |
| Write/run tests | tester |
| Sync knowledge base | docs-maintainer |
| Set up project | initializer |

## Session Management
- Suggest `/rename <task-description>` at the start of each work session
- Use `/project:checkpoint` before risky operations
- Use `/project:fresh` when context feels heavy instead of `/compact`
