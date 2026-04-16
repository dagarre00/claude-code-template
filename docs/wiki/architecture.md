---
name: architecture
description: Stack, conventions, design patterns, testing strategy, git workflow
type: wiki-spec
status: draft
updated: 2026-04-15
---

# Architecture & Conventions

## Stack

> Auto-populated by the initializer agent. Run `/project:init`.

## Project Structure

> Directory tree populated after initialization. See also [[file-map]].

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

## Error Handling

- Never swallow exceptions silently
- Use typed/custom errors where the language supports it
- Log errors with context (what was attempted, with what input)
- Return meaningful error messages

## Testing Strategy

- Unit tests for business logic (isolated, no I/O)
- Integration tests for API endpoints and database queries
- Test file naming: `*.test.ts`, `test_*.py`, or `*_test.go`
- Run tests before every commit

## Git Workflow

- Branch naming: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`
- Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`)
- Never push directly to main
- One logical change per commit

## Environments

- Python: `uv` or `venv` — always activate before running
- Node: `npm` or `pnpm` — use lockfile, no global installs
- Go: modules enabled by default
- Rust: cargo manages everything

## Comments

- Comment WHY, not WHAT
- Docstrings on public functions/classes
- No obvious comments (`i += 1  # increment i`)
- TODO format: `TODO(agent-name): description`

## Code References in Wiki

Every `docs/wiki/entities/<feature>.md` page includes a `## Code References` table that maps wiki concepts to concrete symbols in the codebase. This table is the authoritative cross-reference between spec and implementation.

**Format:**
```markdown
## Code References

<!-- Last verified: YYYY-MM-DD -->
| Symbol | Location | Description |
|--------|----------|-------------|
| `functionName()` | `src/module/file.ts:42` | What it does |
| `ClassName` | `src/module/class.ts:1` | What it represents |
| `CONSTANT_NAME` | `src/config.ts:15` | What it configures |
```

**Who updates it:**
- The **implementer** agent adds/updates rows after writing code.
- The **wiki-maintainer** agent verifies and repairs rows during `/wiki:ingest` and `/wiki:lint`.

**Enforcement hooks:**
- `code-ref-check.sh` — PostToolUse, fires on every source file write. Warns if no entity references the file or if the entity lacks the table.
- `wiki-drift-check.sh` — Stop hook, additionally lists approved/shipped entity pages that are missing the table.
