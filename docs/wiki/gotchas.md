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

### Claude's `--allowedTools` Bash allowlist is not a hard gate

**When:** Dispatching any role on the `claude` engine (`tools/workflow-mcp/engines/claude.mjs`), on Claude Code 2.1.267.
**Symptom:** A worker runs a Bash command that was never granted via `--allowedTools`/`workerCommands`, and reports a correct result for it. Reproduced by granting only `Bash(git status:*)` and asking the worker to compute the SHA-256 of a file — the correct hash (unguessable, verified against a hash computed independently) came back anyway.
**Cause:** With `--permission-prompts none`, a Bash command outside the explicit `--allowedTools`/`--disallowedTools` rules is no longer hard-denied. Claude Code now routes it through its own semantic "auto-mode classifier" (`claude auto-mode defaults`/`config`), which independently judges whether the command looks safe. Measured across every `--permission-mode` value (`default`, `auto`, `manual`, `dontAsk`) — all behave the same. Write/Edit are unaffected: they still deny reliably with no approval surface, so `enforcesReadOnly` (no file mutation) holds. Only "workers may only run these exact allowlisted commands" is false.
**Fix:** None found yet. Do not treat `workerCommands`/`--allowedTools` as a hard security boundary for the `claude` engine — it's a hint for what a worker is expected to run, not an enforcement mechanism. Where arbitrary Bash execution by a worker would be unacceptable, prefer `codex` (real OS-level sandbox via `--sandbox`) for that role instead. Whether `claude auto-mode` config can be hardened (e.g. via `--settings`, or a hard-deny rule for anything outside the allowlist) to close this is still open.

## Runtime
*(Things that go wrong while the code runs.)*

*(None yet.)*

## Testing
*(Test framework, fixtures, isolation, flake.)*

*(None yet.)*

## Tooling
*(Build, lint, formatter, IDE, env quirks.)*

### The connected `workflow` MCP server does not see mid-session edits to its own source

**When:** Editing `tools/workflow-mcp/*.mjs` (e.g. `generate.mjs`, `canonical.mjs`) in the same session where the `workflow` MCP server is already connected, then calling one of its tools (`sync`, `check`, etc.) expecting the new code to run.
**Symptom:** `sync`/`check` succeed and report no drift, but the regenerated `AGENTS.md`/`CLAUDE.md` don't contain the just-added content — and `check` passes anyway because it's comparing stale-code output against itself.
**Cause:** The server is a long-running Node process started at session boot; ES modules are cached per-process and don't hot-reload. Every `mcp__workflow__*` tool call for the rest of the session runs whatever `tools/workflow-mcp/*.mjs` looked like when the process started, not what's on disk now.
**Fix:** After editing anything under `tools/workflow-mcp/`, regenerate by invoking `generate.mjs` directly instead of through the MCP tool: `node -e "import('./generate.mjs').then(m => m.generate('<repo-root>'))"` run from `tools/workflow-mcp/` (use forward slashes in the root path on Windows — backslash escaping through Bash mangles it). Verify the new content actually landed with a targeted grep before trusting `check`.
**Related:** [[decisions/2026-09-08-drop-commands-from-mcp-surface]]
