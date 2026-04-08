---
title: Architecture & Conventions
updated: 2026-01-01
tokens_estimate: 400
agents: [implementer, reviewer, tester, researcher]
---

# Architecture & Conventions

## Stack

> Auto-populated by the initializer agent. Run `/project:init`.

## Project Structure

> Directory tree goes here after initialization.

## Design Patterns

- Clean architecture layers: domain → application → infrastructure → presentation
- Dependency inversion: inner layers never import from outer layers
- Repository pattern for data access
- Service layer for business logic

## Naming Conventions

- Files: `kebab-case`
- Classes: `PascalCase`
- Functions/variables: `camelCase` (JS/TS) or `snake_case` (Python)
- Constants: `UPPER_SNAKE_CASE`
- Database tables: `snake_case`, plural

## Error Handling Strategy

- Never swallow exceptions silently
- Use typed/custom errors where the language supports it
- Log errors with context (what was being attempted, with what input)
- Return meaningful error messages to the user

## Testing Strategy

- Unit tests for business logic (isolated, no I/O)
- Integration tests for API endpoints and database queries
- Test file naming: `*.test.ts`, `test_*.py`, or `*_test.go`
- Run tests before every commit

## Git Workflow

- Branch naming: `feat/<task-id>-<short-desc>`, `fix/<task-id>-<short-desc>`
- Commit format: conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`)
- Never push directly to main
- One logical change per commit

## Virtual Environment

- Python: `uv` or `venv` — always activate before running anything
- Node: `npm` or `pnpm` — use lockfile, no global installs
- Go: modules enabled by default
- Rust: cargo manages everything

## Comments Guidelines

- Comment WHY, not WHAT — the code shows what, the comment explains why
- Docstrings on all public functions/classes
- No obvious comments (`i += 1  # increment i`)
- TODO format: `TODO(agent-name): description`
