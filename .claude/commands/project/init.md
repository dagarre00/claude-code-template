---
name: project-init
description: Detect the project stack, set up the dev environment, and scaffold the wiki with architecture + file-map pages.
type: command
---

Use the **initializer** agent.

After the initializer finishes:
1. Use the **wiki-maintainer** agent to generate `docs/wiki/file-map.md` from the project tree and populate `docs/wiki/architecture.md` `## Stack` / `## Project Structure` from detection results.
2. Append to `docs/wiki/log.md`: `## [YYYY-MM-DD] init | stack: <detected>`.
3. Report to the user: detected stack, what was installed, what pages were seeded.
