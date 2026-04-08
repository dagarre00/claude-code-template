---
name: code-style
description: Coding style and conventions for this project. Use whenever writing new code, reviewing code, refactoring, or when the user asks about conventions, naming, or style. Trigger on "style", "convention", "naming", "format", "lint".
---

# Code Style Conventions

## General Principles
- Readability over cleverness — code is read 10x more than it's written
- Explicit over implicit — don't hide behavior in magic
- Small functions — if it doesn't fit on one screen, split it
- Single responsibility — one function does one thing

## Naming
- Files: `kebab-case` (e.g., `user-service.ts`, `auth_handler.py`)
- Classes: `PascalCase` (e.g., `UserService`, `PaymentGateway`)
- Functions/methods: `camelCase` (JS/TS) or `snake_case` (Python/Rust/Go)
- Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRY_COUNT`)
- Booleans: prefix with `is`, `has`, `can`, `should` (e.g., `isActive`, `hasPermission`)
- Avoid abbreviations — `getUserById` not `getUsrById`

## Comments
- Comment WHY, not WHAT — the code shows what, the comment explains why
- Docstrings on all public functions and classes
- No obvious comments (`i += 1  # increment i` — never do this)
- TODO format: `TODO(agent-name): description`
- Delete commented-out code — git has history

## Error Handling
- Never swallow exceptions silently
- Use typed/custom errors where the language supports it
- Log errors with context: what was attempted, with what input
- Return meaningful error messages — "User not found" not "Error occurred"
- Fail fast on invalid input — validate at the boundary

## File Organization
- Group by feature/domain, not by file type
- Keep imports organized: stdlib → external → internal
- One class per file (with small related helpers allowed)
- Tests mirror the source structure

## Architecture Compliance
- Always check `docs/architecture.md` for project-specific patterns
- Inner layers (domain, application) never import from outer layers (infrastructure, presentation)
- Use dependency injection — don't instantiate dependencies inside classes
