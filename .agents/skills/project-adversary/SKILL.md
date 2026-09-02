---
name: project-adversary
description: Point a read-only second model at the current change. Dispatches the adversary agent (fresh context) over the diff, collects numbered findings in a mailbox file, triages each one, and re-reviews once. Diff-scoped and per-change — unlike project-review, which is periodic and whole-repo. Trigger on "/project:adversary", "/adversary", "run adversary", "audit current diff", "adversarial review", "second model diff check".
---

# /project:adversary (Command)

The authoritative procedure for this command is defined in [`.claude/commands/project/adversary.md`](../../../.claude/commands/project/adversary.md).

Extract any target base ref or review lens directly from the user prompt (e.g. `/adversary <base-ref>`). Read that command document and follow its preconditions, steps, and failure modes verbatim, applying the Antigravity runtime mappings from [`AGENTS.md`](../../../AGENTS.md).
