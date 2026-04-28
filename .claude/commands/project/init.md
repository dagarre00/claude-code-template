---
name: project-init
description: Detect the project stack, set up the dev environment, and scaffold the wiki with architecture + file-map pages.
type: command
---

**First:** invoke `superpowers:using-superpowers` to load the full superpowers context.

Use the **initializer** agent.

After the initializer finishes:
1. Use the **wiki-maintainer** agent to generate `docs/wiki/file-map.md` from the project tree and populate `docs/wiki/architecture.md` `## Stack` / `## Project Structure` from detection results.
2. Append to `docs/wiki/log.md`: `## [YYYY-MM-DD] init | stack: <detected>`.
3. **Bootstrap template → project** — if this is the first time `/project:init` runs on this clone (i.e. `CLAUDE.md` still has the template's generic intro), follow the `## Template → Project bootstrap` checklist in `CLAUDE.md`. Specialize `CLAUDE.md`, `HUMAN.md`, `SETUP.md`, the agent prompts, and create a project-specific `README.md`. Commit as `chore: bootstrap template for <project-name>`.
4. Report to the user: detected stack, what was installed, what pages were seeded, **and whether bootstrap was performed**.
