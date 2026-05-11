---
name: init
description: Detect project state, scaffold docs/wiki, fill project-basic docs (requirements, architecture, git-conventions, commands), initialize git if needed. Run once at project start, or to recover from a broken wiki layout.
type: command
---

# /init

You are initializing this project's wiki + schema scaffolding. This is **idempotent** — if pieces already exist, leave them alone; only fill what's missing.

## Preconditions

- The current directory is the project root.
- `CLAUDE.md` and `.claude/` exist (the schema is already on disk — that's what makes this an `agentic-template` project).

## Steps

1. **Git state.**
   ```bash
   git status
   ```
   - If not a git repo: `git init`, then create a default `.gitignore` (Node, Python, OS, IDE entries) and commit `chore: initial commit` on `main`.
   - If on `main` with uncommitted changes: stop and run `human-checkpoint`. Ask whether to commit, stash, or discard.
   - If on a feature branch: warn the user; don't switch.

2. **Stack detection.** Look for: `pyproject.toml`, `package.json`, `Cargo.toml`, `go.mod`, `Gemfile`, `composer.json`, `pom.xml`, `build.gradle`, `Dockerfile`, etc. Note what you find — you'll record this in `architecture.md`.

3. **Test command detection.** Look at `pyproject.toml` / `package.json` scripts / `Makefile` for a test target. Record the working test command — you'll need it for `commands.md`.

4. **Scaffold `docs/raw/` and `docs/wiki/`** (only the dirs that don't exist):
   ```
   docs/raw/interviews/
   docs/wiki/entities/
   docs/wiki/concepts/
   docs/wiki/decisions/
   docs/wiki/summaries/
   ```

5. **Create missing project-basic pages** (skip any that already exist with non-trivial content):
   - `docs/wiki/index.md` — catalog, one section per category, links by Obsidian wiki-link.
   - `docs/wiki/log.md` — start with the init entry.
   - `docs/wiki/requirements.md` — empty skeleton with all sections: `## Vision`, `## Users`, `## User stories`, `## Functional requirements`, `## Non-functional requirements`, `## Out of scope`, `## Open questions`. Use the exact section format from the current template (including the `- As a <user type>...` story format under User stories). Leave every section body as `<TBD via /interview>`.
   - `docs/wiki/architecture.md` — fill what you detected (stack, test command, dirs) under `## Stack` and `## Layout`. Leave all other sections (`## Data`, `## External services`, `## Testing strategy`, `## Conventions`, `## Deployment`) as `<TBD via /interview>`.
   - `docs/wiki/git-conventions.md` — start from `feature-branching` skill; record default branch, prefixes, commit format.
   - `docs/wiki/todos.md` — empty heading list `## P0 / ## P1 / ## P2` (or `## Now / ## Next / ## Later`).
   - `docs/wiki/completed.md` — empty.
   - `docs/wiki/gotchas.md` — empty headings: `## Critical`, `## Runtime`, `## Testing`, `## Tooling`.
   - `docs/wiki/commands.md` — fill with detected test/build/lint commands.
   - `docs/wiki/wiki-todos.md` — empty.

   Every page gets frontmatter (see `wiki-update` skill).

6. **First log entry.** Append to `docs/wiki/log.md`:
   ```markdown
   ## [YYYY-MM-DD HH:MM] init
   - Stack detected: <list>
   - Test command: <command or TBD>
   - Pages created: <count>
   - Next: run `/interview` to fill requirements.
   ```

7. **Report to the human.** Print:
   - Stack and test command detected (or "not detected — please run /interview").
   - Pages created vs already present.
   - Recommended next step (almost always `/interview`).

## Failure modes

- If git is broken (no remote, divergent main): stop and run `human-checkpoint`.
- If you can't detect a stack: don't guess. Leave `architecture.md` mostly empty and recommend `/interview`.
- If a wiki page exists with conflicting frontmatter (wrong `type:`): don't auto-fix; append to `docs/wiki/wiki-todos.md`.

## What you do NOT do

- **No code creation.** This command sets up the wiki and schema. It does not generate `src/`, dependency manifests, or boilerplate. That comes from `/work` after `/interview`.
- **No assumptions about the stack.** Detect or ask. Don't write "Python project" if there's no Python signal.
- **No second-guessing existing wiki.** If a page exists, leave it. Append to `wiki-todos.md` if you think it needs cleanup.
