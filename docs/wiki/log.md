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

## [2026-09-07 21:28] chore

- Change: pinned `developer` to `codex` (`gpt-5.6-luna`, effort `medium`) in `.agents/config.json`, replacing `antigravity`, specifically to test whether a codex worker can write files — no role had previously exercised codex's `workspace-write` sandbox, only its `read-only` one (adversary).
- Change: set `allowNonWorkspaceAccess: false` in the user-global `~/.gemini/antigravity-cli/settings.json`, closing the isolation gap `docs/engine-setup.md` names — an agy worker's worktree boundary is now enforced by the CLI itself rather than only by `--add-dir` and the allowlist.
- Why: the human asked for both directly, after a review of `docs/engine-setup.md` and the config surfaced that codex's write path was unverified under the current pinning and that agy's non-workspace access was left open.
- Not yet verified: no dispatch has been run against the new `developer` pinning. `engines.codex.models.fast` still names `gpt-5.4-mini`, which OpenAI retired from Codex on 2026-08-31 in favor of `gpt-5.6-luna` — flagged to the human, not changed here since only `developer`'s pin was requested.
