---
name: project-init
description: Detect the project stack, set up the dev environment, and scaffold the wiki with architecture + file-map pages.
type: command
---

Dispatch the **initializer** agent. It will auto-detect the stack, set up the environment, and seed the wiki.

## What the initializer does

1. **Detects existing project state** — checks for existing git, venv, `docs/wiki/`, and source code before creating anything, so it never overwrites your work.
2. **Detects the tech stack** — scans `package.json`, `requirements.txt`, `Cargo.toml`, `go.mod`, `Makefile`, CI configs, etc.
3. **Populates `docs/wiki/architecture.md`** — fills in `## Stack` (language, framework, DB, build tool, test runner, CI, deployment) and `## Project Structure` (top-level directory map with descriptions).
4. **Creates virtual environment** (new projects only, skips if one exists).
5. **Initializes git** (new projects only, skips if `.git/` exists; appends missing entries to existing `.gitignore`).
6. **Discovers commands** — reads `package.json` scripts, `Makefile` targets, pyproject scripts, CI workflow `run:` steps, and README code blocks. Records working commands in `docs/wiki/commands.md`.
7. **Generates `docs/wiki/file-map.md`** — three-level-deep project tree.
8. **Backfills for existing projects** — if the repo has git history or existing source code: creates entity stubs for top-level modules, backfills `docs/wiki/completed.md` from recent commits, extracts gotchas from README/CONTRIBUTING, pre-populates requirements from existing docs.
9. **Drops a memory snapshot** at `docs/raw/memory-snapshots/YYYY-MM-DD-initializer-setup.md`.

## After the initializer finishes

1. Append to `docs/wiki/log.md`: `## [YYYY-MM-DD] init | stack: <detected>`
2. Report to the user:
   - Detected stack and versions
   - What was installed vs. already present (skipped)
   - Commands recorded in `docs/wiki/commands.md`
   - Entity stubs created in `docs/wiki/entities/`
   - Anything marked `[NEEDS HUMAN REVIEW]`

## Next steps to suggest to the user

- Run `/project:interview` to capture or refine requirements (supports existing-project mode — it pre-reads your code and docs before asking questions)
- Review and correct `docs/wiki/architecture.md` if anything was mis-detected
- Review `docs/wiki/todos.md` and adjust priorities
- Run `/wiki:lint` to health-check the wiki after the first work session
