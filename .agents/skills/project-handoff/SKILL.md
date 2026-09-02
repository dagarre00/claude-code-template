---
name: project-handoff
description: Package a todo as a self-contained brief for an external, non-Claude LLM agent. Gathers the entity spec, wiki excerpts, conventions and procedure into one file that works as that agent's sole prompt. Delegates execution; keeps orchestration here. Trigger on "/project:handoff", "/handoff", "package handoff", "handoff brief", "delegate todo".
---

# /project:handoff (Command)

The authoritative procedure for this command is defined in [`.claude/commands/project/handoff.md`](../../../.claude/commands/project/handoff.md).

Extract any target todo, entity, or delegation constraints directly from the user prompt (e.g. `/handoff <scope>`). Read that command document and follow its preconditions, steps, and failure modes verbatim, applying the Antigravity runtime mappings from [`AGENTS.md`](../../../AGENTS.md).
