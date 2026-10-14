# Project

- Name: `<set during project initialization>`
- Vision: `<set during project initialization>`
- Stack: `<detect or ask during project initialization>`
- Application tests: `<verify during project initialization>`

This is a reusable development template for Claude Code. The wiki (`docs/wiki/`) is the application spec; `.claude/` holds the workflow — the roles in `agents/`, the skills, the `/project:*` commands, and the rules in `.claude/rules/`, which load with this file.

`/project:init` fills the four fields above and replaces this paragraph with one about the project. Keep this file to project facts: the workflow lives in `.claude/`, where `/project:sync-template` can update it.
