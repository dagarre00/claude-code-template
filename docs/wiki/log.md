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

> Append-only chronological record. Each entry begins with `## [YYYY-MM-DD HH:MM] <kind>` so the file can be grep'd — `init`, `interview`, `work`, `pr`, `review`, `agent-scout`, `wiki-maintenance`.
> Entries are written by the command that did the work, in the same commit as the work. `/project:wiki-lint` archives this file once it passes ~100 entries.

## [2026-07-31 00:00] work — adversarial-review

- Source: adversarial-review post (r/ClaudeCode, u/croovies) → `docs/raw/research/adversarial-review-croovies.md`
- Added: `adversary` agent (Opus, read-only), `adversarial-review` skill, `/project:adversary` command
- Wired: `/project:work` step 7a — gated on `[complex]`/batched cycles only
- Rules: amended rule 12 (two review roles, both read-only, one periodic and one per-change); added rule 20 (every finding gets a written disposition)
- Wiki: [[concepts/adversarial-review]], [[decisions/2026-07-31-adversarial-review-for-complex-work]], [[summaries/adversarial-review-croovies]]
- Branch: claude/reddit-implementation-jl5w3k
