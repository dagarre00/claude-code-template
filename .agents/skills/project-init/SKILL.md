---
name: project-init
description: Detect project state, interview for requirements, scaffold docs/wiki, update CLAUDE.md and AGENTS.md with project parameters. Run once at project start, or to recover from a broken wiki layout. Trigger on "/project:init", "/init", "initialize project", "init project", "scaffold wiki".
---

# /project:init (Command)

The authoritative procedure for this command is defined in [`.claude/commands/project/init.md`](../../../.claude/commands/project/init.md).

Extract any steering context or legacy material path directly from the user prompt (e.g. `/init <context>`). Read that command document and follow its preconditions, steps, and failure modes verbatim, applying the Antigravity runtime mappings from [`AGENTS.md`](../../../AGENTS.md).
