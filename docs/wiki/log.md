---
aliases: [Ops log, Timeline]
type: reference
domains: [software]
status: stable
sources: []
contradicts: []
open_questions: []
created: 2026-04-15
updated: 2026-09-08
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
- Not yet verified: no dispatch has been run against the new `developer` pinning.

## [2026-09-07 21:45] chore

- Change: `engines.codex.models.fast` `gpt-5.4-mini` → `gpt-5.6-luna` (the model retired the previous entry flagged). `engines.antigravity.models.reasoning` `gemini-3.1-pro` → `gemini-3.1-pro-preview` — the bare id was simply wrong; Google's own docs give `gemini-3.1-pro-preview` as the real one, and the old value would have failed to resolve on first use.
- Checked against the web and left unchanged, all confirmed Active: `claude-opus-5`, `claude-sonnet-5`, `claude-haiku-4-5-20251001` (Anthropic's deprecations page — none even deprecated yet), `gpt-6-astra`, `gpt-5.6-terra` (current Codex models), `gemini-3.8-flash` (Google's model docs, stable).
- Note: `engines.antigravity.models.reasoning` is presently unreachable — no role with a `reasoning` profile resolves to `antigravity` under the current pins in `.agents/config.json` (`adversary` and `planner`, the two `reasoning`-profile roles, are explicitly pinned to `codex` and `claude`). Fixed anyway so it isn't a landmine for the next repin.
- MCP suite 92/92 after both edits.

## [2026-09-07 21:50] chore

- Change: reverted `developer` to `antigravity`/`gemini-3.8-flash`/`medium`, undoing the previous entry's codex pin. Change: `engines.antigravity.models.reasoning` `gemini-3.1-pro-preview` → `gemini-3.8-flash`, so every configured Gemini reference is now the same model.
- Why: human request, after the codex-write question this reversion reopens was tested directly first (see below) rather than left unanswered.
- Verified first, outside any role config: dispatched `codex exec --sandbox workspace-write` by hand against a throwaway git-initialized fixture (not a worktree of this repo), model `gpt-5.6-luna`, asking it to create `proof.txt` with fixed content. It wrote the file with exactly the requested bytes and nothing else — confirmed on disk after the process exited, not just from the CLI's own transcript. Codex's write path is real; the fixture was deleted after.
- MCP suite 92/92 after the revert.

## [2026-09-08 13:35] chore

- Change: removed `get_workflow`, `list_commands`, and the per-command MCP prompt registration from the `workflow` server — commands (`work`, `review`, `adversary`, `wiki`, `interview`, `init`) now have no MCP surface at all, reachable only through Claude Code's native `project` plugin (or, for another conductor, a human pointing it at `.agents/commands/<name>.md` directly). `canonical.mjs`'s command loading is unchanged; `generate.mjs` still needs it for the AGENTS.md catalog.
- Change: audited every file actually inlined into a dispatched worker's prompt (all 7 role bodies, the 8 skills declared in a command's `skills:` map, and `rules.md`) for `/project:xxx` references a worker has no way to act on — 64 occurrences across 16 files reworded to plain outcomes (e.g. "escalate via `/project:interview`" → "flag it for the conductor to route to a fresh spec pass"). Frontmatter `description:` fields left untouched — `compose.mjs` never inlines them into a worker prompt.
- Change: hardened "MCP is the only dispatch path" (`generate.mjs`'s "Delegating work", and `.agents/commands/work.md`'s dispatch intro) to say explicitly it holds even when a role's engine equals the conductor's own — no shortcut through the conductor's native Task/Agent tool.
- Fix (incidental): `.agents/skills/update-toolkit/SKILL.md`'s "Placement" step described commands getting their `/project:` prefix from a `commands/project/<name>.md` sub-folder namespace — never true in this repo; the prefix comes from the Claude Code plugin's own name (`project`, in `.agents/.claude-plugin/plugin.json`) over a flat `.agents/commands/<name>.md`. Corrected, and noted commands have no MCP surface to add one for.
- Fix (incidental): `.agents/roles/developer.md` described being dispatched "with a path to `.handoff/<slug>-plan.md`" — the actual mechanism (`work.md` step 4/5, rule 15) pastes the plan inline in the developer's instructions; worktrees don't share scratch, so a path was never valid. Corrected in the same edit that removed the `/project:work` reference on that line.
- Why: a user-facing question about `/project:work` vs `mcp__workflow__project-work` surfaced the duplication; further discussion established Claude Code is the only conductor for now (no per-CLI generation needed) and that a dispatched worker being handed a command reference it cannot act on was the sharper, previously-unnoticed problem.
- Researched and rejected generating a native command surface for Codex/Antigravity: Codex's custom-prompt slash commands are deprecated by OpenAI in favor of "skills"; both Codex's (`~/.codex/prompts/`) and Antigravity's (`~/.gemini/antigravity-cli/plugins/`) extension points are user-home-scoped, not project-portable — see `docs/wiki/decisions/2026-09-08-drop-commands-from-mcp-surface.md`.
- Verified: `workerRules()` run programmatically against the edited `rules.md` confirms zero leaked `/project:` references reach a worker. MCP suite 90/90 (92 minus the two `get_workflow` tests removed with the tool). `sync`/`check` regenerated `AGENTS.md`/`CLAUDE.md` with no drift (run via direct `node` invocation of `generate.mjs` — the session's already-running MCP server process has last session's `generate.mjs`/`canonical.mjs` cached in memory and will not pick up same-session edits; see gotcha).
- ADR: `docs/wiki/decisions/2026-09-08-drop-commands-from-mcp-surface.md`.
