---
aliases: [Ops log, Timeline]
type: reference
domains: [software]
status: stable
sources: []
contradicts: []
open_questions: []
created: 2026-04-15
updated: 2026-07-21
---

# Log

> Append-only chronological record. Each entry begins with `## [YYYY-MM-DD HH:MM] <kind>` so the file can be grep'd.
> Session-end entries are suppressed until `/project:init` writes the first `init` entry below.
