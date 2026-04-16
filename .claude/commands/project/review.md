---
name: project-review
description: Review uncommitted changes or changes since the last review tag. Writes new gotchas back to wiki/gotchas.md.
type: command
---

Use the **reviewer** agent to review all uncommitted changes (or changes since the last `review-*` git tag, if one exists).

Output a structured report organized by **Critical / Warning / Suggestion**.

After the review, if any new gotchas were found, the reviewer must append them to `docs/wiki/gotchas.md` (the write-guard hook enforces this path).
