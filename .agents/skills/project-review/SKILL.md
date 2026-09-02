---
name: project-review
description: Thorough review of the codebase against the wiki. Runs the reviewer agent in a fresh session context with no developer baggage. Flags critical issues, warnings, drift, missing tests, security/perf concerns. Use periodically (~every 5 todos), never inside project-work. Trigger on "/project:review", "/review", "periodic review", "audit codebase against wiki", "check for drift".
---

# /project:review (Command)

The authoritative procedure for this command is defined in [`.claude/commands/project/review.md`](../../../.claude/commands/project/review.md).

Extract any specific area or review lens directly from the user prompt (e.g. `/review <lens>`). Read that command document and follow its preconditions, steps, and failure modes verbatim, applying the Antigravity runtime mappings from [`AGENTS.md`](../../../AGENTS.md).
