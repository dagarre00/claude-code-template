---
aliases: [Ops log, Timeline]
type: reference
domains: [software]
status: stable
sources: []
contradicts: []
open_questions: []
created: 2026-04-15
updated: 2026-08-31
---

# Log

> Append-only chronological record. Each entry begins with `## [YYYY-MM-DD HH:MM] <kind>` so the file can be grep'd — `init`, `interview`, `work`, `pr`, `adversary`, `review`, `wiki-ingest`, `wiki-maintenance`, or `chore` when nothing else fits (behavioral rule 19).
> Entries are written by the command that did the work, in the same commit as the work. `/project:wiki` archives this file once it passes ~100 entries.

## [2026-09-07 22:13] chore

- Change: added the `plan-adversary` role (pre-implementation review, `/project:work` step 4a) with its `plan-review` skill; pinned each role to an engine and exact model in `.agents/config.json`; moved adversary findings from the `.handoff` mailbox into the worker's report.
- Engines: added `workerCommands`, the exact-match allowlist a worker may run, inlined into every composed prompt; claude read-only roles moved from plan mode to `default`; agy runs without `--sandbox`; adapters now declare `enforcesReadOnly`.
- Why: an end-to-end run of the full cycle found workers could not execute any command — agy returned an empty response with exit 0, and claude denied every Bash call, leaving rule 4 (confirm Red) unsatisfiable.
- Verified: full cycle re-run against a throwaway fixture — planner (claude-opus-5), plan-adversary and developer (gemini-3.8-flash), adversary (gpt-6-astra); Red confirmed, Green reached, suite green, worktree removed clean. MCP suite 92/92.
- Setup: agy needs a one-time user-global permission grant, `docs/engine-setup.md`.
