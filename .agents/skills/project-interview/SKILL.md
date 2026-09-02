---
name: project-interview
description: Grill-me-relentlessly Q&A to define a plan, a feature, or fill requirements. Walks down each branch of the decision tree, resolving dependencies one at a time. Always provides a recommended answer. Streams a transcript to docs/raw/interviews/ Q-by-Q and A-by-A (never batched at the end), then updates affected wiki pages. Trigger on "/project:interview", "/interview", "interview me", "grill me", "define requirements", "plan a new feature".
---

# /project:interview (Command)

The authoritative procedure for this command is defined in [`.claude/commands/project/interview.md`](../../../.claude/commands/project/interview.md).

Extract the interview topic or scope directly from the user prompt (e.g. `/interview <topic>`). Read that command document and follow its preconditions, steps, and failure modes verbatim, applying the Antigravity runtime mappings from [`AGENTS.md`](../../../AGENTS.md).
