---
aliases: [Failure modes, Traps]
type: reference
domains: [software]
status: stable
sources: []
contradicts: []
open_questions: []
created: 2026-04-15
updated: 2026-09-10
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
**Related:** [[decisions/2026-09-08-drop-commands-from-mcp-surface]]
