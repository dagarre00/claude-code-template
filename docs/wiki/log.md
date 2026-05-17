---
name: log
description: Chronological ops log — ingests, work cycles, reviews, lints, checkpoints, rollbacks.
type: wiki-log
updated: 2026-05-11
status: draft
---

# Log

> Append-only chronological record. Each entry begins with `## [YYYY-MM-DD HH:MM] <kind>` so the file can be grep'd.
> Session-end entries are suppressed until `/project:init` writes the first `init` entry below.
