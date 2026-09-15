---
aliases: [Failure modes, Traps]
type: reference
domains: [software]
status: stable
sources: []
contradicts: []
open_questions: []
created: 2026-04-15
updated: 2026-09-14
---

# Gotchas

> [!abstract] Essence
> Project-specific traps future agents must avoid. Generic discipline issues live in `.agents/rules.md`. Use the `gotcha-recording` skill to append entries — keep the When/Symptom/Cause/Fix format.

## Critical
*(Severe — data corruption, security, silent breakage. Read first.)*

*(None yet.)*

## Runtime
*(Things that go wrong while the code runs.)*

*(None yet.)*

## Testing
*(Test framework, fixtures, isolation, flake.)*

*(None yet.)*

## Tooling
*(Build, lint, formatter, IDE, env quirks.)*

### Claude's `--allowedTools` Bash allowlist is a hint, not a hard gate — but the bound that actually matters still holds

**When:** Dispatching any role on the `claude` engine (`tools/workflow-mcp/engines/claude.mjs`), on Claude Code 2.1.267, in any `--permission-mode` (tried `default`, `auto`, `manual`, `dontAsk`).
**Symptom:** A worker runs a Bash command that was never granted via `--allowedTools`/`workerCommands`, and reports a correct result for it. Reproduced by granting only `Bash(git status:*)` and asking the worker to compute the SHA-256 of an in-repo file — the correct hash (unguessable, verified independently) came back anyway.
**Cause:** With `--permission-prompts none`, a Bash command outside the explicit `--allowedTools`/`--disallowedTools` rules is no longer hard-denied; Claude Code routes it through its own semantic "auto-mode classifier" (`claude auto-mode defaults`/`config`) instead, which judges the command on its own heuristics. First measured this looked like a serious hole — but a fuller sweep narrows it a lot: **write** (Write tool, and a Bash shell-redirect `echo x > file`), **delete** (`rm` on a neutrally-named file), **network** (`curl` to an external host), and **reads outside the worktree** (`cat /etc/hosts`) were all denied in every mode tested. Only local, in-project-scope, non-mutating reads slip through the allowlist — and `Read`/`Grep`/`Glob` already give every role that same access with zero gating at all, allowlisted or not. So the property that actually matters (`enforcesReadOnly`: no mutation, no exfiltration, no scope escape) holds; only the literal phrase "workers may only run these exact commands" is false, and the gap it leaves doesn't hand a worker any capability its own file tools didn't already have.
**Fix attempted, did not work:** Passing a custom `hard_deny` rule via `--settings '{"autoMode":{"hard_deny":[...]}}'` scoped to just the one process (never touching the operator's global `~/.claude/settings.json`) did not stop the classifier from allowing the same non-allowlisted read — the shipped "Local Operations" allow-category outweighs an ad hoc custom rule. Blanket `--disallowedTools Bash` alongside a specific `--allowedTools Bash(<cmd>:*)` pattern was tried too, but the deny-list wins outright and blocks the allowlisted commands as well, which is worse.
**Current stance:** Don't treat `workerCommands`/`--allowedTools` as a literal, exhaustive Bash allowlist for the `claude` engine — it's a hint for what a worker is expected to run; the actual enforced boundary is "no mutation, no network, no scope escape," which is what the rest of the design (worktree isolation, read-only roles never writing) depends on anyway. Where a literal, mechanical command-level gate genuinely matters, prefer `codex` for that role — its `--sandbox` is an OS-level jail, not a heuristic. A `--restricted --tools <allowlist>` variant (which additionally confines Claude's own file tools to `--add-dir` directories) looks like a promising further hardening layer, untested here — treat it as a separate, carefully-regression-tested follow-up, not a quick patch, since it touches which built-in tools every role can use.

### The connected `workflow` MCP server does not see mid-session edits to its own source

**When:** Editing `tools/workflow-mcp/*.mjs` (e.g. `generate.mjs`, `canonical.mjs`) in the same session where the `workflow` MCP server is already connected, then calling one of its tools (`sync`, `check`, etc.) expecting the new code to run.
**Symptom:** `sync`/`check` succeed and report no drift, but the regenerated `AGENTS.md`/`CLAUDE.md` don't contain the just-added content — and `check` passes anyway because it's comparing stale-code output against itself.
**Cause:** The server is a long-running Node process started at session boot; ES modules are cached per-process and don't hot-reload. Every `mcp__workflow__*` tool call for the rest of the session runs whatever `tools/workflow-mcp/*.mjs` looked like when the process started, not what's on disk now.
**Fix:** After editing anything under `tools/workflow-mcp/`, regenerate by invoking `generate.mjs` directly instead of through the MCP tool: `node -e "import('./generate.mjs').then(m => m.generate('<repo-root>'))"` run from `tools/workflow-mcp/` (use forward slashes in the root path on Windows — backslash escaping through Bash mangles it). Verify the new content actually landed with a targeted grep before trusting `check`.
**Also happens across projects:** the same staleness hits a project that adopted the workflow via `/project:sync-template` — `sync-template` updates that project's checkout on disk, but its own long-running `workflow` MCP server process keeps the ES module cache from before the sync and keeps erroring (e.g. `mcp__workflow__check` throwing on a role-frontmatter key a template fix already allowlisted). Confirm by re-running the equivalent of `generate.mjs` directly in that project's checkout — if that succeeds, the fix is on disk and only that project's MCP server process needs restarting, not a code change.
**Related:** [[decisions/2026-09-08-drop-commands-from-mcp-surface]]

### `build_worker_prompt`'s returned `command` is a POSIX shell string — running it through WSL on Windows can't find the checkout

**When:** Running the `command` field `build_worker_prompt` (`tools/workflow-mcp/dispatch.mjs`) returns, on a Windows machine, through a shell tool that isn't guaranteed to be a real POSIX shell in the same filesystem namespace as the Windows checkout.
**Symptom:** `cd: C:/Users/.../<task_id>: No such file or directory`, and the worker never runs at all — before it can be denied a permission, before it can produce any output.
**Cause:** `command` is composed as `cd <workspace> && <executable> <args> < <stdin_file>` — POSIX `sh` syntax, quoted for a real POSIX shell (Git Bash, the shell inside a Linux CI runner, codex's/agy's own shell). WSL is also a POSIX shell, but it is a *different* filesystem namespace from the Windows checkout: it has no `C:\` drive letters, only `/mnt/c/...`, so a Windows absolute path passed to it verbatim resolves nowhere. Observed the hard way in a resumed dispatch (workflow-resume-report, 2026-09-10): the composed command was run under WSL bash instead of Git Bash, and the `cd` failed before the worker process ever started.
**Fix:** On Windows, run `command` only through a shell that shares the Windows filesystem namespace (Git Bash, not WSL). If that isn't guaranteed — a generic "run this shell command" tool might silently prefer WSL when both are installed — bypass the composed string entirely and invoke the structured fields `executable`, `args`, `cwd`, and `stdin_file` directly (e.g. `spawnSync`/`child_process`, or a native process launch), which is what `dispatch.mjs` already returns for exactly this reason. Never try to translate the Windows path into a `/mnt/c/...` form yourself — the workspace path in `args`/`cwd` is the one the rest of the toolchain (git, the engine CLI) expects natively.
**Related:** [[decisions/2026-09-08-drop-commands-from-mcp-surface]]

### An agy or codex worker can read outside its worktree, and no setting stops it

**When:** Any dispatch to the `antigravity` or `codex` engine — most often a role told to "read the repository" (`reviewer`, `wiki-maintainer`), a reviewer curious about the change's intent, or a worker asked about its own context.
**Symptom:** agy: the transcript shows `find_by_name`/`list_dir`/`view_file` calls on the parent checkout, a sibling worktree, or `.worktrees/.dispatch/` — 5 of 22 real dispatches did it (2026-09-13); where the path belongs to a registered agy project the read is denied and the run ends empty. codex: a read-only worker read a file in the parent checkout and a file outside the repository and reported both contents (measured 2026-09-14, codex 0.154.0, Windows).
**Cause:** A worktree is not a read boundary on either engine. agy's custom agent removes write and subagent tools, not read tools, and `allowNonWorkspaceAccess: false` does not confine reads (canary read with it on and off). Codex's `--sandbox read-only` bounds writes and network, not reads. The worktree also sits inside the conductor's checkout, so `.handoff/` plans and every earlier worker's report are two directories up. Claude workers were denied reads outside the worktree in every permission mode tried, but leave no transcript to audit.
**Fix:** Detected, not prevented. The worker contract forbids it; agy's `extract-agy-result.mjs` and codex's `engines/codex-audit.mjs` list every read outside the workspace, and every skill file a worker opened, in `inspect_dispatch` → `audit`, with a verdict warning. Check it before accepting a reviewer's findings: a reviewer that read the author's plan, another worker's report, or another role's skill is no longer independent. On agy, a write outside the workspace or any subagent call fails the command outright. The codex audit reads command text, so a path assembled at run time can escape it.
**Related:** [[gotchas#Antigravity can refuse to create a new file in a worktree — cause found, mitigated by the agent launch]]

### Antigravity can refuse to create a new file in a worktree — cause found, mitigated by the agent launch

**When:** Dispatching a write role to the `antigravity` engine for any task that adds a file — which is most development tasks. Not a concern for read-only roles, which never write.
**Symptom:** `write_to_file` returns `invalid_args: <worktree path> is not a valid artifact path; artifacts must be in C:\Users\<user>\.gemini\antigravity-cli\brain\<conversation_id>/`, and a following `replace_file_content` then fails because the file does not exist. The worker can still edit files that already exist, so the run looks partly productive and stops with the case unfinished. Measured non-deterministic: the same task in the same worktree with the same flags created files successfully ~20 minutes earlier.
**Cause:** Very likely the model, not the worktree. agy's `write_to_file` takes an optional `ArtifactMetadata` argument meant only for files in its per-conversation artifact directory, and agy's default system prompt pushes reports and task lists into artifacts; a call that carries the argument for an ordinary path is refused with exactly this message. In the original transcript the same call to the same path failed and then succeeded on retry two steps later — consistent with the model dropping the argument, not with a path problem. Recorded from an adopting project (`docs/raw/research/2026-09-11-workflow-mcp-cycle1-findings.md`, F-C); the tool schema and prompt section were read from agy 1.2.2 itself on 2026-09-13. Not reproduced: 0 of 12 new-file creations across 9 write dispatches that day hit it, on either launch style.
**Fix:** Every agy worker now launches as a custom agent with `excludeDefaultComponents: true` (`tools/workflow-mcp/engines/antigravity.mjs`), which removes the artifacts section that invites the argument. `antigravity` is back on the `developer` chain, first (`["antigravity", "codex", "claude"]`), on the human's decision of 2026-09-14 — backed by every agy developer dispatch in the 2026-09-13/14 e2e runs passing clean, and it puts the developer on a different provider from the codex adversary. If a write role ever hits this again, the wrapped command exits non-zero on the unfinished run; read the report before re-dispatching.
**Related:** [[decisions/2026-09-08-drop-commands-from-mcp-surface]]
