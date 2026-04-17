---
name: wiki-lint
description: Health-check the wiki — contradictions, orphan pages, stale claims, broken links, code drift, missing ADRs.
type: command
---

Dispatch the **wiki-maintainer** agent. It loads the `wiki-schema` skill and runs the full lint procedure there.

## Output

Produce a report organized by severity:

- **Critical** (broken links, code drift, contradictions) — fix now
- **Warning** (stale, orphans, missing ADRs, stale Code References)
- **Suggestion** (concept density, hub splits)

For each issue, suggest the concrete fix or question to ask.

Append `## [YYYY-MM-DD] lint | <n> critical, <m> warnings, <p> suggestions` to `docs/wiki/log.md`.
