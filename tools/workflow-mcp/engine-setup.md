# Engine setup — what each CLI needs before it can run a worker

A worker runs non-interactively, so **nothing can prompt**: every permission it needs must be granted before it starts, or the call is auto-denied — on two of the three engines silently enough to look like success. Read this before pinning a role to an engine.

## The command allowlist

`workerCommands` in `.agents/config.json` lists the **exact command lines** a worker may run — not patterns:

```json
"workerCommands": [
  "npm test",
  "git status",
  "git status --porcelain",
  "git diff",
  "git rev-parse HEAD",
  "git branch --show-current"
]
```

`/project:init` step 5a replaces `npm test` with the project's real test command. Keep the list short: workers read, search and edit with their own file tools, which need no permission, so commands are only for the suite and the few read-only git calls the role checklists name. The editor (`node tools/workflow-mcp/config-ui.mjs`, [config.md](config.md)) edits the list and refuses a line no engine could match.

The engines gate it differently — agy's `command(<line>)` rules are true exact match; Claude Code's `Bash(<line>:*)` allows trailing arguments; Codex ignores the list and relies on its OS sandbox — but the list is also **inlined into every worker prompt** under `Commands you may run`. A worker that doesn't know it improvises a near-miss (`git log -n 3`), and on agy one denied command ends the run and discards the report: measured, a developer that had already written its failing test returned nothing after one denied `git log`. Adding a command means adding it here and to the agy grants below, nowhere else.

## Codex — nothing to do

`--sandbox` with `approval_policy="never"` is an OS-level sandbox with no approval surface: commands run, and disallowed writes are refused by the kernel. `workerCommands` does not apply. Codex has no file-reading tool apart from its shell, so its prompt tells it that read-only shell commands inside the workspace are its file tools.

### Codex on Windows

- **Separate sandbox account.** Codex runs workers under a different Windows SID from the repo owner (measured: `…-1001` vs `…-1005`), so git in the worktree fails `detected dubious ownership` unless that path is trusted — silently disabling the `adversary` and `reviewer`, whose first git call errors. `prepare_worktree` registers every worktree it creates with `git config --global --add safe.directory <path>`, so there is nothing to configure. A worktree made some other way needs the same line by hand; the trailing-`/*` wildcard does **not** work on Windows (measured), and `safe.directory "*"` trusts every repository on the machine.
- **The conductor too.** Only worktrees are registered. A conductor whose own shell runs under another account (conducting from Codex) hits `dubious ownership` on the root checkout. `verify.mjs` passes `-c safe.directory=*` for its own git calls, scoped to that process; for your other git calls, trust the root path the same way or pass that flag per call.
- **`npm`/`npx` need the `.cmd` spelling** in the sandbox account, where PowerShell refuses `npm.ps1` (measured: `npm test` → `PSSecurityException`, `npm.cmd test` → exit 0). Dispatch respells them in a codex worker's prompt automatically. `worktreeSetup` is run by *your* shell, not the worker's, and is never respelled — if your own PowerShell blocks scripts, write `npm.cmd` there yourself.

### Codex — optional context-management overrides

The report file keeps the *conductor* from paying for a long transcript, but not the *worker's* own context: a health pass or an adversary sweep reading many large files can still force an early, lossy auto-compaction. Two Codex settings bound it, opt-in per project under `engines.codex` (no default is set — they were not measured here):

```json
"engines": { "codex": { "executable": "codex", "toolOutputTokenLimit": 2000, "modelAutoCompactTokenLimit": 50000, ... } }
```

- `toolOutputTokenLimit` — how much of one tool output (a large file read, a verbose command) the worker keeps; lower is leaner but may truncate what it needed.
- `modelAutoCompactTokenLimit` — the history size that triggers auto-summarization; unset, Codex picks one from the model's context window.

Both are positive integers and Codex-only: the loader refuses them on the other engines, where they would be silently inert.

## Claude Code — nothing to do

Each `workerCommands` entry becomes `--allowedTools "Bash(<cmd>:*)"`. Read-only roles run `--permission-mode dontAsk`, not `plan` (which refuses every Bash call, so an adversary couldn't verify a finding): with `--permission-prompts none`, edits have no approval surface and are denied, while allowlisted commands run.

**Known gap** (measured on 2.1.267): the allowlist is not a hard gate. A command outside it can still run if Claude Code's auto-mode classifier judges it benign — `sha256sum` of a file returned the correct, unguessable hash. But writes, deletes, network calls and reads outside the worktree were denied in every mode tried; only local, non-mutating reads slip through, which Read/Grep/Glob already allow. So "workers run only these exact commands" is not literally true here, while "workers cannot mutate, exfiltrate or read outside their worktree" still is. A `--settings` hard-deny rule and a blanket `--disallowedTools Bash` were both tried: neither restored a literal allowlist without also blocking the allowed commands. Where a mechanical command gate matters, put that role on codex, whose sandbox is enforced by the OS.

## Antigravity (agy) — one step, per machine

agy reads **no project configuration** in print mode (a repository `.gemini/settings.json` is ignored — measured), only the user-global `~/.gemini/antigravity-cli/settings.json`.

**Call `grant_antigravity_setup`.** It adds one `command(<line>)` rule per `workerCommands` entry that has no exact match, creating the file and its directories if needed, and never touches or reorders anything else — your interactive grants included. It exists because a conductor's own edit tools are commonly denied from writing under `$HOME`, while the server process is not. Call it again whenever `workerCommands` changes; with nothing missing it is a no-op. A settings file that exists but isn't valid JSON (a BOM, a trailing comma) is reported by `check` as `setup.problem` and refused — fix it by hand first. The write holds `settings.json.lock`, so concurrent conductors queue instead of overwriting each other; a lock whose holder died is taken over after a minute.

By hand, merge into `permissions.allow` — matching is exact, so `command(git status)` does not grant `git status --porcelain`, and `command(npm test)` does not grant `npm test -- --watch`:

```json
{
  "permissions": {
    "allow": [
      "command(npm test)",
      "command(git status)",
      "command(git status --porcelain)",
      "command(git diff)",
      "command(git rev-parse HEAD)",
      "command(git branch --show-current)"
    ]
  }
}
```

Without it, an agy worker **exits 0, reports `SUCCESS` and returns an empty response**, the reason only in stderr and `denied_actions`:

```
jetski: no output produced — a tool required the "command" permission that
headless mode cannot prompt for, so it was auto-denied.
```

**`check` finds this before a cycle:** its `antigravity.setup` block lists every entry with no grant, and `roles_with_unmet_setup` names each role whose engine — the first *installed* one in its chain — has one missing.

**The runner turns silent agy failures into real ones.** `run-worker.mjs` runs `extract-agy-result.mjs` over the transcript, which exits non-zero on a denied action (naming the refused target from the transcript), a missing `result` event, an empty response with no denial, a write outside the workspace, or a subagent call; the whole command's exit code carries it unless the process itself already failed. Twice in about thirty runs agy rejected the model's own malformed tool call (`invalid arguments: missing property …`) and the run simply ended: that is marked `transient`, `inspect_dispatch` reports `verdict.transient: true`, and the `worker-dispatch` skill allows one unchanged retry.

### Read grants for files outside the worktree

A worker's workspace is its worktree. A read outside it — a shared virtualenv, `vendor/`, a monorepo dependency — **may** be denied, and then fails exactly like a denied command. Allowing `pytest` does not grant reading the interpreter's own packages.

Which reads are denied is not fully established. Measured on agy 1.2.2: reads into a project's own `.venv` and `vendor/` were denied, and so was a read into another registered agy workspace; reads into an unregistered scratch directory — including the conductor's dispatch files — were allowed, and `allowNonWorkspaceAccess: false` changed nothing. **A worktree is not a read boundary on agy, nor on codex**, whose read-only sandbox bounds writes, not reads (measured 2026-09-14: a read-only worker read a file in the parent checkout and one outside the repository). Both are audited instead: `inspect_dispatch` reports `audit.reads_outside_workspace` and `audit.skill_reads` with warnings — from the agy transcript, and for codex from the command text (so a path assembled at run time can escape it). Check it before trusting a reviewer: one that read the author's material is no longer independent.

Grant needed paths as `read_file(<absolute path>)` in the same `permissions.allow` list; a directory covers its descendants:

```json
"allow": ["command(npm test)", "read_file(C:/path/to/shared/.venv)", "read_file(C:/path/to/shared/vendor)"]
```

List every outside path a task implies **before** dispatching — finding them one denial at a time costs a full worker run each — and check that no broader `deny` or `ask` rule shadows them (agy puts those ahead of `allow`). Prefer this to `allowNonWorkspaceAccess: true`.

### Why agy workers run without `--sandbox`

Under `--sandbox` every shell call needs `escalate_admin` instead of `command`, which headless mode cannot prompt for and which cannot be scoped to a command line — keeping it would mean granting shell escalation wholesale.

### Why every agy worker runs as a custom agent

`--mode plan` does not make a worker read-only (agy warns it has no effect with slash-command expansion disabled), and a plain worker gets `define_subagent`/`invoke_subagent`, browser tools and your global MCP servers. So `build_worker_prompt` writes a per-dispatch agent to `.worktrees/.dispatch/<task_id>/agent/.agents/agents/workflow-<role>.md` and passes `--agent workflow-<role> --add-dir <that dir>`:

- `excludeDefaultComponents: true` drops agy's own prompt sections — two measured failures lived there: the artifacts section, which made the model attach an `ArtifactMetadata` argument agy then refused ("not a valid artifact path"), and the file-link section, which filled reports with `file:///` links.
- `inheritMcp: false` keeps your global MCP servers away from workers.
- `tools:` is the whole toolset: read, search and `run_command`, plus the write tools for write roles, plus `search_web` and `read_url_content` for a role that declares `capabilities: [web]` — no subagents or browser, ever.

Measured 2026-09-13: told to create a file and define a subagent, a read-only worker did both when launched plainly, and answered NO SUCH TOOL to both as its agent; across 9 real agy dispatches of five roles, none lost a capability it needed. Re-measured 2026-09-24 on agy 1.2.9: still NO SUCH TOOL for both, nothing written (the stream's `init` event lists agy's whole tool registry, not the agent's tools — ignore it). The agent must be passed **by name** (`--agent C:/…/x.md` is silently ignored), and an unknown tool name fails the run (`tool "<name>" not found in registry`), so a typo cannot widen the set. It does not confine reads — see above.

### Web access for the researcher

Measured 2026-09-24 on agy 1.2.9, headless, as a custom agent with the web tools:

- `search_web` works with no grant and returns a summary with cited sources. (On 1.2.2 it failed with `no summary returned from GenerateContent`; the agy changelog records the fix.)
- `read_url_content` is denied (`denied_actions: [{action: "read_url"}]`, the run ends) unless `permissions.allow` holds `read_url(<domain>)` or `read_url(*)`. With it, the page is saved under `~/.gemini/antigravity-cli/brain/<conversation>/.system_generated/steps/<n>/content.md` and the tool returns that path; `view_file` on it is allowed. The audit lists those reads under `tool_output_reads`, not as reads outside the workspace, and the prompt tells the worker the read is permitted.

A researcher cannot know its domains before it searches, so when a role with `capabilities: [web]` would run on agy, `check` reports `read_url(*)` under `setup.missing_url_grants` and `grant_antigravity_setup` adds it. It is user-global, so every agy session on the machine — interactive ones included — may then fetch any URL without asking. To narrow it, replace it by hand with `read_url(<domain>)` rules: any `read_url(...)` rule satisfies `check`, and a fetch outside them is denied and ends that run.

## Projects with a Python virtualenv

A worktree is a fresh checkout with no `.venv`. Measured 2026-09-13 (src-layout package, editable install, agy, Windows):

| Layout | Worker command | Tests import | Outcome |
| --- | --- | --- | --- |
| Borrow the root `.venv`, nothing else | `../../.venv/Scripts/python.exe -m pytest` | **the main checkout's `src/`** | a correct implementation stayed Red; the worker patched `sys.path` to get Green, and wrote `__pycache__` into the main checkout |
| Borrow the root `.venv` + `pythonpath = ["src"]` | `../../.venv/Scripts/python.exe -m pytest` | the worktree's `src/` | clean Red → Green |
| A `.venv` per worktree | `.venv/Scripts/python.exe -m pytest` | the worktree's `src/` | clean Red → Green |

**Never the first:** an editable install points the venv at the root checkout's `src/`, so a correct change stays Red and a Red can pass on code the worker never touched.

**Borrowing the root venv** needs `pythonpath = ["src"]` under `[tool.pytest.ini_options]` in `pyproject.toml` (or a root `conftest.py` that prepends `src`). The command is relative to `.worktrees/<id>/`, so it is its own `workerCommands` entry and agy grant. A new dependency can't be tested in the worktree until it is installed at the root, and codex's sandbox can't resolve a venv whose interpreter lives outside the worktree — prefer a per-worktree venv for codex roles.

**A venv per worktree** is self-contained: the command matches the root's, dependency changes are testable in the cycle, nothing is read outside. With `uv` and a warm cache it takes under 3 seconds. Put the setup in `worktreeSetup`:

```json
"worktreeSetup": [
  "uv venv --python 3.11 .venv",
  "uv pip install --python .venv/Scripts/python.exe -e . pytest"
]
```

`prepare_worktree` returns these as `setup_commands` for you to run in the worktree before dispatch — the server runs nothing, and a failure is a blocker. The `.venv` is gitignored, so the worktree still reads as clean. Worktrees are created and removed with `core.longpaths=true`, so a deep venv no longer breaks `remove_worktree` on Windows. `check`'s `setup` block lists any such command agy has no grant for.

## When an engine is unavailable

- **Not installed** — computable: `check` reports per engine whether its `executable` is on PATH, which roles use it, and `roles_without_an_available_engine`.
- **Installed but refusing** (a usage limit, an expired login) — not computable before running it. Recover cheaply:
  - **A fallback chain:** `roles.<name>.engine` takes an ordered list, e.g. `"planner": { "engine": ["codex", "claude"], "models": { "codex": "gpt-6-astra" } }`. The first installed entry runs, and `warnings` says when it fell through. `inherit` may appear in a chain; repeats collapse.
  - **One dispatch elsewhere:** `cli_engine` on `build_worker_prompt` overrides the chain — right for a usage limit, since the engine is still installed. A `model_override` needs `cli_engine` with it; left to the chain it could reach an engine that can't run that model, and is refused.

Watch how many roles share one engine: one measured session had four of seven on the same one, and a single usage limit stopped all four. `check`'s per-engine `roles` shows the concentration.

## Checking your setup

[`conductor-e2e.md`](conductor-e2e.md) runs workers on each engine and reports which of these guarantees held on your machine. Re-run it after changing any of the above.
