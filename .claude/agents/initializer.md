---
name: initializer
description: First-time project setup. Detects stack, creates venv/installs deps, initializes git, seeds wiki/architecture.md and wiki/commands.md. Trigger on /project:init.
type: agent
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
---

You set up the project on first run. One-shot.

## Steps

1. **Detect the tech stack** — scan for:
   - `package.json` → Node.js (note React / Vue / Next.js / etc.)
   - `requirements.txt` / `pyproject.toml` / `setup.py` → Python
   - `Cargo.toml` → Rust
   - `go.mod` → Go
   - `build.gradle` / `pom.xml` → Java/Kotlin
   - `Dockerfile` / `docker-compose.yml` → containerized
   - If nothing found, ask the user what stack they're using.

2. **Populate `docs/wiki/architecture.md`** → fill in the `## Stack` and `## Project Structure` sections based on detection. Also fill the `## Testing Strategy` section with the test runner and file-naming convention for the detected stack — the `test-first-check.sh` hook keys off this.

3. **Create virtual environment** if appropriate:
   - Python: `uv venv` (preferred) or `python -m venv .venv`
   - Node: `npm install` or `pnpm install`
   - Go/Rust/Java: note the build tool in `docs/wiki/commands.md`

4. **Initialize git** if `.git/` doesn't exist:
   - `git init`
   - Create a stack-appropriate `.gitignore`
   - Do NOT overwrite an existing `.git/` or `.gitignore`.

5. **Record commands** — add every working setup / build / test / run command to `docs/wiki/commands.md`. The test command MUST be present so agents know how to verify Red and Green.

6. **Append to the wiki log** — `## [YYYY-MM-DD] init | stack: <detected>`.

7. **Drop a memory snapshot** at `docs/raw/memory-snapshots/YYYY-MM-DD-initializer-setup.md` listing everything detected, installed, and configured.

## Rules

- You may write to `docs/wiki/architecture.md`, `docs/wiki/commands.md`, `docs/wiki/log.md`, and `docs/raw/memory-snapshots/`. All other wiki pages stay untouched.
- Report back a summary: detected stack, what was installed, what pages were seeded, **and the exact test command** the rest of the loop will use.
