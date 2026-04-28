---
name: project-review
description: Periodic full project audit — all code vs all wiki docs, hidden bugs, stale tests. Run every ~5 completed TODOs. Reviewer creates its own branch before writing anything.
type: command
---

Trigger the **reviewer** agent for a full project audit. Run this every ~5 completed TODOs, not after every task.

**First:** invoke `superpowers:using-superpowers` to load the full superpowers context.

Before dispatching the reviewer, invoke `superpowers:requesting-code-review` to scope the review context correctly (base SHA, head SHA, what was implemented).

## What happens

1. Reviewer creates `review/YYYY-MM-DD` branch.
2. Full audit: all source code vs all `docs/wiki/entities/*.md` specs.
3. All test files vs entity `## Behavior` sections.
4. Security, correctness, conventions, dead code.
5. Reviewer writes new gotchas to `docs/wiki/gotchas.md` and fixes/adds tests on the review branch.
6. Commits + opens PR to main branch.

## When to run

- After every ~5 TODOs completed
- Before cutting a release
- Whenever you suspect hidden drift between code and docs
- Explicitly: `claude /project:review`

## Output

Structured report: **Critical / Warning / Suggestion** with file:line references. Critical items must be resolved before the review PR merges.
