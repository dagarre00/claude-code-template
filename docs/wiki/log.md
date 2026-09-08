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

## [2026-09-08 17:57] chore

- Fix: a live `planner` dispatch (`access: read-only`) burned a turn on a denied write because `.agents/roles/planner.md` (frontmatter description, Planning procedure step 5, `## Handoff`, and a `## What you do NOT do` bullet) and the `plan-writing` skill it follows both still instructed it to write `.handoff/<slug>-plan.md` directly. `work.md` step 4 and (after this fix) rule 15 already had the real mechanism right: the planner is read-only, returns the full plan in its report, and the conductor optionally saves a copy and pastes the text inline into the developer's instructions (worktrees don't share scratch, so a path was never valid — same root cause as the incidental fix to `developer.md` above).
- Change: `.agents/roles/planner.md` — description, step 5, `## Handoff`, and the entity-page-edits bullet reworded to "returns the plan in its report"; added a "No writing, anywhere" bullet matching `plan-adversary.md`/`adversary.md`'s style.
- Change: `.agents/skills/plan-writing/SKILL.md` — intro, the template instruction, and "Where it lives" reworded so the planner returns the plan rather than writing it; the `.handoff/<slug>-plan.md` path now described as the conductor's optional copy.
- Change: `.agents/rules.md` rule 15 reworded to state the planner is read-only and writes nothing; AGENTS.md/CLAUDE.md regenerated via `sync` (`check` confirmed no drift after).
- Fix (incidental): `tools/workflow-mcp/getting-started.md` (the human-facing tutorial) had the same "planner writes the file" claim in four places (steps 1 and 3 of the two walkthroughs, the troubleshooting table, and an anti-pattern bullet) — corrected to match.
- Why: caught mid-session while validating a real `prepare_worktree`/`build_worker_prompt` dispatch of the `planner`, not from a wiki-adjacent read — the worker obeyed its own role doc over the (correct) command doc.
- Verified: workflow-mcp test suite 91/91 after the edits; `mcp__workflow__check` reports generated files match `.agents/`.

## [2026-09-08 19:12] chore

- Fix (severe, newly found): `worker-contract.md` and `compose.mjs`'s Delivery section both forbid a worker any mutating git command, but `developer.md` and the `tdd-loop` skill it always receives — both inlined into the same composed prompt — explicitly told the `developer` to `git commit`/`git push` per case, one line going as far as "you own it, not the conductor." A direct in-prompt self-contradiction on the most-dispatched role. Corrected `developer.md`, `tdd-loop/SKILL.md` (renamed "## Commit" → "## Finish", now describes leaving files + reporting paths), `gotcha-recording/SKILL.md` and `decision-recording/SKILL.md` (both showed `git add …` as something the developer runs), and `docs/wiki/git-conventions.md`'s Cadence section (said "the developer owns this"). All now agree: the developer leaves case files uncommitted and reports the paths; the conductor stages and commits.
- Fix (external report, template-repo-scoped items only — two PorchRail-specific ones excluded): a PorchRail session running an adversary review against a live `planner`/`build_worker_prompt` dispatch surfaced 9 more defects in the shipped template. Addressed:
  - **#1 adversary can't express its review scope.** `workerCommands` is an exact-match allowlist; a commit range carries a per-dispatch SHA no static literal can express, so `git diff <range>` was unreachable (confirmed: worker correctly refused it twice per its own prompt's instruction, rather than a variation). Chose diff-as-text over allowlist changes — engine-agnostic, unlike relying on Claude's `Bash(cmd:*)` prefix-wildcard or Codex's OS sandbox not gating on the list at all, both of which are real but don't hold on agy, and `adversary` can be repinned to any engine. The conductor now runs the range diff itself and pastes the text inline. Changed: `adversarial-review/SKILL.md` (steps 1, 2, 6), `roles/adversary.md` (entry checklist), `commands/adversary.md` (steps 1, 2, 4), `commands/work.md` (step 7a).
  - **#2 Codex on Windows silently disabled.** `dubious ownership` on every git call (measured: owner SID `…-1001` vs worker SID `…-1005`); the `/*` wildcard doesn't suppress it. Automated rather than just documented: `prepareWorktree` (`worktree.mjs`) now runs `git config --global --add safe.directory <path>` on every worktree it creates, deduped against the existing list. `engine-setup.md` documents the fallback manual command and the blanket-`*` tradeoff.
  - **#4 worker-visible rule numbers don't match `rules.md`.** Conductor-only rules are stripped and the rest renumbered contiguously for a worker (deliberate — a visible gap reads as "a rule was withheld," per `canonical.test.mjs`'s own comment — so reversing the renumbering was rejected). Audited every worker-visible `(behavioral rule N)` citation: only one was concretely broken by the renumbering (`wiki-update/SKILL.md`'s citation of rule 18, which lands at worker position 15) — every other worker-visible citation targets either a positionally-stable low number or a conductor-only rule that's absent from a worker's copy regardless of numbering scheme, so it's an aside, not a lookup failure. Fixed that one citation, and added a caveat to `rules.md`'s own preamble (flows into `AGENTS.md` and every worker prompt) telling future skill/role authors never to cite a rule by bare number across a role/skill boundary.
  - **#5 `compose.mjs` overstated the allowlist.** "The only shell commands you are permitted to run" is true on agy, false on Codex (OS sandbox, doesn't consult the list) and imprecise on Claude (`:*` wildcards arguments). Reworded to "commands you can rely on being allowed," and the "one denied command ends your run" hedge now names agy specifically instead of "some engines."
  - **#6** `conductor-e2e.md` called a nonexistent `list_commands` tool — removed.
  - **#7** `engine-setup.md` claimed `/project:init` sets `workerCommands`' test-command entry; it never did (only `docs/wiki/commands.md`). Made the claim true: `init.md` step 5a now updates `.agents/config.json`'s `workerCommands` placeholder to the verified test command, not just the doc.
  - **#8** already resolved before this session (`.agents/templates/CLAUDE.md.tmpl` deletion was already staged).
  - **#9** `init.md` step 6 said to "touch nothing else" in `project.md` beyond the four fields; `canonical.mjs` renders `project.md` verbatim into `AGENTS.md`, so an adopting project would publish the template's own self-description ("This is a reusable development template…") as its own agent instructions. Step 6 now says to replace that prose with the adopting project's own description, and adds a guard to read and preserve any pre-existing hand-written `CLAUDE.md` before `sync()` can overwrite it unconditionally.
- Regression caught and fixed during this work, not part of either report: the `worktree.mjs` fix for #2 ran `git config --global` in tests against the developer's real `~/.gitconfig` — the first test run left 6 throwaway fixture paths there. Cleaned up the pollution and isolated `worktree.test.mjs` with `GIT_CONFIG_GLOBAL` pointed at a per-test throwaway file outside the repo (inside it would itself dirty the fixture's git status).
- Verified: workflow-mcp test suite 92/92; `mcp__workflow__check` reports generated files match `.agents/`; confirmed no stray `safe.directory` entries remain in the real global git config after the test run.

## [2026-09-08 20:05] chore

- Fix: `scripts/adopt.sh` step 2 copied all of `tools/workflow-mcp/` (minus `node_modules`) into an adopting project, including this template repo's own `test/` suite and the `package.json` `"test"` script that runs it — a consuming project had no reason to receive tests that only verify the template's own workflow-mcp source, and their presence invites a future agent to run them there (mistaking them for the project's own tests). `scripts/adopt.sh` now also `--exclude`s `tools/workflow-mcp/test` from the tar copy and deletes the copied `package.json`'s `scripts` block via a small `node -e` step. `README.md`'s "manual equivalent" instructions updated to match (explicit `rm -rf tools/workflow-mcp/test` and a note to drop the `scripts` block).
- Why: user instruction, prompted by a prior-turn correction not to run the workflow-mcp test suite when working in a project that only adopted the mechanism (see `feedback_no_workflow_mcp_tests_in_consumer_projects` in the assistant's memory) — the user pointed out that relying on memory alone was insufficient and the exposure itself needed closing.
- Verified: ran `bash scripts/adopt.sh <scratch dir>` against a throwaway target outside the repo; confirmed the copied `tools/workflow-mcp/` has no `test/` directory and its `package.json` has no `scripts` key, then deleted the scratch target. Did not run the workflow-mcp `test/*.test.mjs` suite itself for this change (no test in it covers `adopt.sh`, a bash script). Note: the dry run's codex/agy global MCP registration step re-registered `workflow` under the real machine-global config — content-identical to what adopting the template itself already produces (the registered command is a relative path with no target-directory information), so no existing registration was altered in effect.
