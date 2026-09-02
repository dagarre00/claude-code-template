---
name: project-agent-scout
description: Post-init survey that reads the wiki and recommends specific agents and skills tailored to this project's stack, domain, and external services. Run once after /project:init fills requirements and architecture. Re-run after /project:interview adds a major feature. Trigger on "/project:agent-scout", "/agent-scout", "scout agents", "recommend skills", "survey skills".
---

# /project:agent-scout (Command)

The authoritative procedure for this command is defined in [`.claude/commands/project/agent-scout.md`](../../../.claude/commands/project/agent-scout.md).

Extract any focus area or output filter directly from the user prompt (e.g. `/agent-scout <focus>`). Read that command document and follow its preconditions, steps, and failure modes verbatim, applying the Antigravity runtime mappings from [`AGENTS.md`](../../../AGENTS.md).
