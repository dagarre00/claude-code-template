# Harness Details

This template supports three CLIs — **Claude Code**, **Codex**, and
**Antigravity CLI** — from one canonical source, `.harness/`. `scripts/sync-harness.mjs`
renders that source into each CLI's native format. This page is the map: which
canonical file becomes which native file, how each CLI's native format differs,
which files the toolchain must never touch, and how the coordination MCP server
(`tools/coordination-mcp/`) ties dispatch, models, and effort together across
all three.

Everything below is derived from `scripts/sync-harness.mjs`,
`tools/coordination-mcp/{server,config,manager}.mjs`, `scripts/configure-mcp.mjs`,
and `.harness/settings.json` as they exist in this repository. If those files
change, this page is stale until re-derived — it is documentation, not a spec
the generator reads.

> Generated adapters are committed artifacts. After any `.harness/` edit, run
> `node scripts/sync-harness.mjs`, then `node scripts/sync-harness.mjs --check`
> and `node --test tests/harness.test.mjs` before committing. This page never
> triggers that regeneration itself.

## 1. Canonical source → generated adapters

`render()` in `scripts/sync-harness.mjs` reads everything under `.harness/` and
writes the outputs below. Nothing under `.claude/`, `.agents/`, `.codex/`,
`AGENTS.md`, or `CLAUDE.md` is hand-edited — the generator detects a manual edit
(hash mismatch against `.harness/generated.json`) and refuses to overwrite it
without `--force`.

| Canonical source | Generated output(s) | Notes |
| --- | --- | --- |
| `.harness/project.md` | folded into `AGENTS.md` | Project identity block, verbatim after macro expansion. |
| `.harness/instructions.md` | folded into `AGENTS.md` | Shared operating instructions. |
| `.harness/rules/*.md` | folded into `AGENTS.md` | Frontmatter stripped; bodies concatenated in filename order. Currently one file, `behavioral.md`. |
| *(built inline, no source file)* | `AGENTS.md` § Command catalog | One row per command: summary, MCP prompt name `project-<name>`, and the short name `get_workflow` takes. Generated from the command list. |
| *(built inline, no source file)* | `AGENTS.md` § Agent catalog | One bullet per agent: name, profile, expanded description. The only place role names are published as text; `list_roles` is the runtime equivalent. |
| `.harness/instructions.md` (marker only) | `CLAUDE.md` | Fixed two-line file: a DO-NOT-EDIT marker plus a literal `@AGENTS.md` — Claude Code's own import syntax. This is the **only** generated file that uses a native `@` import. |
| `.harness/commands/project/<name>.md` | *(nothing generated)* | Commands produce **no** native files in any harness. The coordination server registers one MCP prompt per command and serves the same body through `get_workflow` (see §3). The generator still validates each command's `argument-hint` and `{{arguments}}` contract at sync time. |
| `.harness/skills/<name>/SKILL.md` (+ sibling files) | `.claude/skills/<name>/SKILL.md` and `.agents/skills/<name>/SKILL.md` | Procedure skills. Non-`SKILL.md` siblings (e.g. `TEMPLATE.md`, `sync-develop.md`) are copied byte-for-byte to both trees; `.md`/`.toml`/`.tmpl` siblings get the DO-NOT-EDIT marker and macro expansion, everything else is copied raw. |
| `.harness/agents/<name>.md` | *(nothing generated)* | Agents produce **no** native files. `manager.spawn` prepends the worker contract and this file's body to every prompt, for every engine, and the permission mode carries read-only isolation — so a per-engine agent file would only deliver the role a second time. `profile`/`access` are still validated at sync time and feed the `AGENTS.md` catalog. |
| `.harness/worker-contract.md` | *(not generated — read directly)* | Workers read this file at its canonical path regardless of engine; it is not copied or rendered per-harness. |
| `.harness/settings.json` | *(not rendered into prompt text — consumed by code)* | Validated by the generator and read by the MCP server/config module at dispatch time. See §8. |
| `.harness/templates/command.md.tmpl` | *(authoring aid, not generated)* | Starting point when hand-writing a new `.harness/commands/project/<name>.md`; the generator never reads it directly. |

Every command file must define `argument-hint` and use `{{arguments}}` in its
body, or the generator throws (`Command lacks argument contract`). Skill and
agent names must match their containing directory/file, or the generator throws
a name/path-collision error.

## 2. Per-harness native formats

| | Claude Code | Codex | Antigravity CLI |
| --- | --- | --- | --- |
| Root instructions | `CLAUDE.md` (imports `AGENTS.md` via `@AGENTS.md`) | `AGENTS.md` directly (native discovery — no generated pointer file exists for Codex) | `AGENTS.md` directly (native discovery — same as Codex) |
| Human-invoked commands | *(no native files in any harness)* — all three are served by the coordination MCP server as registered **prompts** (see §3) | same | same |
| Reusable procedures | `.claude/skills/<name>/SKILL.md` | `.agents/skills/<name>/SKILL.md` — Codex discovers skills from `$CWD/.agents/skills`, then parent directories, then `$REPO_ROOT/.agents/skills`, then `$HOME/.agents/skills` ([Codex skills docs](https://learn.chatgpt.com/docs/build-skills)). The same generated tree serves Codex and Antigravity. | `.agents/skills/<name>/SKILL.md` |
| Agent/role definitions | *(no native files in any harness)* — the role body is prepended to the worker's prompt by `manager.spawn` | same | same |
| Read-only enforcement | `--permission-mode plan`, measured to refuse writes even when `Write` and `Edit` are explicitly allowed | `--sandbox read-only` | `--mode plan`, measured to refuse the write that `--mode accept-edits` performs |
| MCP client config | `.mcp.json` (repo root, gitignored) | `.codex/config.toml`, managed block (gitignored) | `.agents/mcp_config.json` (gitignored) |

## 3. Invocation catalog

Commands generate **no native files in any harness**. `tools/coordination-mcp/server.mjs`
registers one MCP **prompt** per file in `.harness/commands/project/`, named
`project-<name>`, and `get_workflow(name, context)` returns the same body on
demand. One name therefore works everywhere, and there is no per-harness
invocation spelling to keep in step.

`AGENTS.md` § Command catalog is generated from this same list — it is not
hand-maintained.

| Command | MCP prompt | `get_workflow` short name |
| --- | --- | --- |
| adversary | `project-adversary` | `adversary` |
| agent-scout | `project-agent-scout` | `agent-scout` |
| handoff | `project-handoff` | `handoff` |
| init | `project-init` | `init` |
| interview | `project-interview` | `interview` |
| review | `project-review` | `review` |
| wiki-ingest | `project-wiki-ingest` | `wiki-ingest` |
| wiki-lint | `project-wiki-lint` | `wiki-lint` |
| work | `project-work` | `work` |

**How a human invokes one.** Ask the conductor in plain conversation ("run
project-work"); it calls `get_workflow("work", "…")` and follows the returned
body. Where a CLI surfaces MCP prompts as slash commands, they can also be
picked directly — Claude Code spells that `/mcp__coordination__project-work`,
and Codex exposes registered prompts through its `$name` picker.

**This makes commands depend on MCP being up.** Before this change, Claude Code
and Antigravity had native command files that worked without the server. They no
longer do, which matches the operating rule already stated in `AGENTS.md`: all
project commands are conductor-only, and if MCP is unavailable the conductor
reports the blocker rather than improvising. Configure the server first (§6).

**Why commands went MCP-only.** Native command files duplicated the canonical
body into two more places per command and forced the generator to carry a
per-harness invocation flavour (`/project:x` versus `project-x`, plus differing
argument macros). Codex already worked this way, proving the path; extending it
to the other two removed 18 generated files and the last flavour split, so a new
engine needs no command work at all.

## 4. File inclusion and prompt expansion

- **`@` import.** Only `CLAUDE.md`'s literal `@AGENTS.md` is a native import.
  It is hard-coded in the generator, not produced by macro expansion. No other
  generated or canonical file uses `@`-import syntax, and none should be
  authored to rely on one.
- **`{{cmd:<name>}}`.** Expands to `project-<name>` everywhere. Because commands
  are MCP prompts rather than per-harness files, one spelling serves every
  target, and the generator has no per-harness invocation flavour at all.
  Referencing an undefined command name is a build error.
- **`{{arguments}}`.** Expands to Claude Code's own placeholder token
  `$ARGUMENTS` for Claude output, or to the literal sentence
  `user-provided context following this skill invocation (empty if omitted)`
  for every other target. Every command body must contain this token at least
  once (enforced at build time).
- **Runtime expansion of the same tokens.** `get_workflow(name, context)` and
  the MCP prompts registered for each command (§3) perform an equivalent
  substitution at call time — `{{cmd:x}}` → `project-x`, `{{arguments}}` →
  the literal user context, appended as a JSON envelope — so a conductor
  calling the tool sees the same text shape regardless of engine.
- **Relative Markdown links.** A link in a canonical file is resolved against
  *that file's* directory, then rewritten relative to *each generated file's*
  own directory. A link does not import file contents — only navigation is
  rebased; the target file's prose is not inlined.
- **Unresolved-token guard.** Any remaining lowercase `{{...}}` after macro
  expansion fails the build. Uppercase placeholders (`{{TITLE}}`,
  `{{OWNED_PATHS}}`, …) are exempt — those belong to
  `.harness/skills/llm-handoff/TEMPLATE.md`, filled by the `llm-handoff`
  procedure, not by the generator.
- **Frontmatter is data, not prose.** Canonical frontmatter is one scalar per
  line (`key: value` or `key: "JSON-quoted string"`); no nested YAML, no
  multiline values. The generator parses it with a regex, not a YAML library,
  so anything more elaborate fails the build.

## 5. User-owned files — never replaced by the toolkit

These are either gitignored (per `.gitignore`) or explicitly protected by
`scripts/configure-mcp.mjs`'s refusal to overwrite an entry it does not
recognize. Neither `sync-harness.mjs` nor `configure-mcp.mjs` will replace
their contents wholesale.

| File | Owner | Why |
| --- | --- | --- |
| `.claude/settings.local.json` | human | Claude Code's personal/local settings; never generated. |
| `.codex/config.toml` | human + generator (shared) | Human-owned file; `configure-mcp.mjs` only ever touches the text between its own `# BEGIN/END GENERATED COORDINATION MCP` markers and refuses to run if an unmanaged `[mcp_servers.coordination]` block already exists outside those markers. |
| `.codex/config.local.toml` | human | Local Codex overrides; gitignored, generator never writes it. |
| `.agents/settings.local.json` | human | Antigravity's personal/local settings; never generated. |
| `.mcp.json` | human + `configure-mcp.mjs` | Claude Code's project MCP registration. `configure-mcp.mjs` merges in (or updates) only the `mcpServers.coordination` key; it refuses to touch a `coordination` entry whose `args` don't already point at `tools/coordination-mcp/server.mjs`, forcing you to rename a conflicting entry by hand first. |
| `.agents/mcp_config.json` | human + `configure-mcp.mjs` | Same merge/refusal behavior as `.mcp.json`, for Antigravity CLI. |
| `CLAUDE.local.md` | human | Personal Claude Code memory; never generated. |
| `tools/coordination-mcp/node_modules/` | npm | Installed by `npm ci`; gitignored, never committed. |

None of these appear in `.harness/generated.json`'s manifest, so
`sync-harness.mjs` will not even consider deleting or rewriting them.

## 6. MCP server setup

`scripts/configure-mcp.mjs` is the one-time (and idempotent) registration step
for the coordination MCP server, run separately from `sync-harness.mjs`:

```bash
node scripts/configure-mcp.mjs           # register for all three clients
node scripts/configure-mcp.mjs --check   # report drift without writing
```

For each client it computes the desired launch command —
`{ command: <path to the current node binary>, args: ["tools/coordination-mcp/server.mjs", "--root", "<repo root>", "--engine", "<claude|codex|antigravity>"] }`
— and:

- **`.mcp.json`** (Claude Code) and **`.agents/mcp_config.json`** (Antigravity)
  are JSON files; the script merges in `mcpServers.coordination` and leaves
  every other key untouched. It writes only if the computed value differs from
  what's already there.
- **`.codex/config.toml`** is TOML with a managed block:

  ```toml
  # BEGIN GENERATED COORDINATION MCP
  [mcp_servers.coordination]
  command = "<node path>"
  args = [...]
  startup_timeout_sec = 20
  tool_timeout_sec = 120
  # END GENERATED COORDINATION MCP
  ```

  Only the text between the markers is replaced; everything else in the file
  (including a malformed or duplicated marker pair) causes the script to stop
  rather than guess.
- **Refusal to clobber.** If any of the three already defines a `coordination`
  server whose `args` don't reference `tools/coordination-mcp/server.mjs`, the
  script throws (`Existing unowned coordination server ...; rename it before
  setup`) instead of overwriting a server you configured for something else.
- **Idempotent.** Re-running with nothing to change prints
  `Local MCP registration is current.` and writes nothing.

**After running it, approve project trust and MCP access in each client** —
registering the server in config does not itself grant the running CLI
permission to use it; each client's own trust/approval prompt still applies
the first time it sees the new server.

## 7. MCP tool reference

`tools/coordination-mcp/server.mjs` registers these tools on the `coordination`
MCP server. Every tool call is scoped to the repository at `--root`; the
`--engine` flag only affects which native model/effort defaults `get_settings`
and `spawn_worker` resolve to.

| Tool | Access | Who can call it | Purpose |
| --- | --- | --- | --- |
| `get_settings()` | read-only | anyone | Returns `.harness/settings.json` plus `conductor_engine` and `worker_mode`. |
| `get_workflow(name, context?)` | read-only | anyone | Returns one canonical command's body with macros expanded and `context` appended as a JSON envelope. |
| `list_workers()` | read-only | anyone | Durable task state for this integration checkout. |
| `check_worker_status(task_id)` | read-only | anyone | Process outcome, log tail, commit range, current SHAs. |
| `read_worker_log(task_id, stream?, offset?)` | read-only | anyone | Full report/log, paged by byte offset; retained after cleanup. |
| `list_roles()` | read-only | anyone | No parameters. Returns an array, sorted by `name` ascending, of `{ name, description, profile, access, engine, model, effort }`. The first four come from the frontmatter of `.harness/agents/*.md`: `profile` is one of `reasoning\|balanced\|fast`, `access` is one of `read-only\|write`, and `{{cmd:x}}` inside a description is expanded to `project-x`. The last three are **resolved**, not merely configured — they are what the role would actually run with right now, after applying `.harness/settings.json` role overrides and `defaultEngine`, so configuration is verifiable without spawning a worker. Use it to discover available roles and their access before calling `spawn_worker`. |
| `spawn_worker(role, cli_engine?, instructions, owned_paths?, model_override?, thinking_budget?, commit_message?)` | write | conductor only | Launches one bounded CLI task in a fresh worktree from committed HEAD. `commit_message` is the subject the supervisor commits that worker's work under (see below); rejected for read-only roles, which produce no commit. |
| `kill_worker(task_id)` | write | conductor only | Requests cancellation of the owned process tree; preserves branch/worktree/logs. |
| `merge_and_cleanup_worker(task_id, expected_target_sha, expected_worker_sha)` | write | conductor only | SHA-pinned local integration of a reviewed, successful worker, then cleanup of its worktree/branch. |

"Conductor only" is enforced at the process level: `spawn_worker`,
`kill_worker`, and `merge_and_cleanup_worker` are only registered when
`COORDINATION_WORKER` is not `'1'` in the server process's environment. A
dispatched worker's own MCP connection (which sets that variable) sees only
the read-only tools above — it cannot recursively dispatch or integrate,
independent of anything its prompt tells it.

Two MCP resources are also registered: `harness://settings` (the same JSON
`get_settings` returns) and `harness://instructions`
(`.harness/instructions.md` verbatim).

### Where a worker's files live

| Path | Contents | Why there |
| --- | --- | --- |
| `<repo>/.worktrees/<task_id>` | The worker's Git worktree — the only place it edits | **Must not be inside `.git/`.** Agent CLIs refuse to write anywhere under the git directory, so a worktree placed there silently makes every write role undeliverable: the worker reports the write as denied and produces no commits. |
| `.git/coordination/tasks/<task_id>` | `task.json`, `prompt.txt`, `stdout.log`, `stderr.log`, `result.json`, `phase.json`, `heartbeat` | Metadata and logs only. No CLI is ever spawned here, so the write restriction does not apply, and keeping it in `.git` keeps it out of the working tree. |

`.worktrees/` must be ignored, or it dirties the integration checkout that both
`spawn_worker` and `merge_and_cleanup_worker` require to be clean. The server
writes that rule into `.git/info/exclude` itself on every dispatch rather than
trusting the project's `.gitignore`, so the control plane stays correct in an
adopting repository that rewrote or replaced that file. The template's
`.gitignore` also lists it, for human readers.

### How a worker's work becomes a commit

**No worker on any engine runs git.** It writes files into its worktree; the
`runner.mjs` process supervising it stages the task's `owned_paths` after a clean
exit and makes one commit. That runner is an ordinary Node process on the host,
started by the MCP server and outside every CLI sandbox, so it can write the Git
store that the worker itself cannot.

This is one convention rather than a per-engine capability because only one of
the three CLIs can commit at all (§12): Codex's sandbox protects `.git`, and
Antigravity denies every unlisted shell command in headless mode. Claude could,
and deliberately no longer does — keeping that would mean one engine delivering a
commit history the other two cannot produce, and every downstream step having to
know which engine ran.

What the runner does, in `commitWorkerOutput`:

| Situation | Outcome |
| --- | --- |
| Clean exit, changes inside `owned_paths` | One commit with the conductor's `commit_message` subject; `result.json` records `commit` (the SHA) and `committed_paths`. |
| Clean exit, **anything** outside `owned_paths` | **No commit at all.** The task is `failed`, the error names the offending paths, and every change stays on disk. A partial commit would have hidden which half was refused. |
| Clean exit, nothing changed | No commit. `merge_and_cleanup_worker` then rejects it as a write worker with no deliverable, which is accurate. |
| Failed, cancelled, timed-out, or output-limited | No commit. The work stays uncommitted for the conductor to read. |
| Read-only role | No commit policy exists on the task, so the runner cannot commit even if the role misbehaved. |

One dispatch is therefore one commit. To keep per-case history, scope a write
worker to one Behavior case — batching cases into one worker batches them into
one commit, and no instruction to the worker can change that.

The commit is made with the repository's own identity and hooks; the runner
passes no `-c user.*` override and never `--no-verify`. Subjects are validated
like any other argv value: one line, no control characters, at most 200
characters. Omitting `commit_message` falls back to
`chore(<role>): supervised worker <short id>`, which is a placeholder, not a
convention — pass a real subject.

### Claude worker permissions

`--permission-mode acceptEdits` covers file edits and read-only shell commands,
but a *mutating* shell command still routes to a permission prompt — and
`--permission-prompts none` denies anything that would prompt.

`engines.claude.writeAllowedTools` in `.harness/settings.json` is the explicit
`--allowedTools` grant for write roles. It ships **empty**: the git verbs it used
to contain are gone with the delivery convention above. It remains the place to
grant the mutating commands a project's write roles genuinely need — most often
its test runner, e.g. `"Bash(npm test:*)"`. `workerCommand` rejects any rule
matching `dangerous` or `bypassPermissions`.

Read-only roles receive **no** `--allowedTools` grant: `plan` mode already permits
the `git diff` / `git log` reads a review depends on. Measured behaviour:

| Permission mode | Read-only shell | File write | Mutating shell |
| --- | --- | --- | --- |
| `acceptEdits` (write roles) | allowed | allowed | denied **unless** granted via `writeAllowedTools` |
| `plan` (read-only roles) | allowed | n/a | n/a |
| `dontAsk` | allowed | denied | denied |
| `default` | denied | denied | denied |

## 8. Model and reasoning-effort mapping

Every worker role carries a **profile** (`reasoning`, `balanced`, or `fast`)
and an **access** level (`read-only` or `write`) from its
`.harness/agents/<name>.md` frontmatter:

| Role | Profile | Access |
| --- | --- | --- |
| planner | reasoning | read-only |
| adversary | reasoning | read-only |
| reviewer | balanced | read-only |
| developer | balanced | write |
| wiki-maintainer | balanced | write |
| researcher | fast | write |

`tools/coordination-mcp/config.mjs` resolves the actual model and effort for a
dispatch in this order (`workerCommand()`):

```
model  = spawn_worker's model_override
         ?? settings.roles[role].models[engine]
         ?? settings.engines[engine].models[profile]

effort = spawn_worker's thinking_budget
         ?? settings.roles[role].effort[engine]
         ?? settings.engines[engine].effort[profile]
```

`settings.roles` is the per-role override map. All six roles ship pre-populated
with explicit `null` slots, so changing a model means editing an existing line
rather than inventing a structure:

```json
"roles": {
  "adversary": {
    "engine": null,
    "models": { "claude": "opus", "codex": null, "antigravity": null },
    "effort":  { "claude": "high", "codex": null, "antigravity": null }
  }
}
```

`null` means "inherit" at every level: `engine: null` falls back to
`defaultEngine`, and a `null` model or effort falls back to the engine's profile
default. Only the three keys `engine`, `models`, and `effort` are accepted, and
the inner maps are keyed by engine name.

`loadSettings` validates this map and **fails loudly** on a malformed entry —
writing `model` where the schema says `models`, an unknown engine key, an
unknown engine value, or a non-object role. That matters because the failure
mode it replaces was silent: a typo left the worker running the default model
while the file claimed otherwise, visible only as a surprising bill or a weaker
review. Call `list_roles()` to read back the resolved values.

Both engine defaults and role overrides live once in `.harness/settings.json`;
nothing else maintains a parallel copy.

Shipped engine defaults:

| Engine | reasoning model | balanced model | fast model | reasoning effort | balanced effort | fast effort |
| --- | --- | --- | --- | --- | --- | --- |
| claude | `opus` | `sonnet` | `haiku` | `high` | `medium` | `low` |
| codex | *(none — Codex's own default)* | *(none)* | *(none)* | `high` | `medium` | `low` |
| antigravity | `pro` | `inherit` | `flash` | `high` | `medium` | `low` |

Codex ships with no model override at any profile (`models` are all `null`),
so a Codex worker always runs on Codex's own default model unless a project
sets `settings.roles[role].models.codex` or passes `model_override` to
`spawn_worker`.

Each engine accepts a different effort vocabulary, validated by
`workerCommand()`:

| Engine | Accepted effort values |
| --- | --- |
| claude | `low`, `medium`, `high`, `xhigh`, `max` |
| codex | `minimal`, `low`, `medium`, `high`, `xhigh` |
| antigravity | `low`, `medium`, `high` |

An effort value outside the target engine's list is rejected before the
process is launched, not silently clamped.

**Read-only vs. write, per engine's actual CLI flags:**

| Engine | Read-only dispatch | Write dispatch | Always-on safety flags |
| --- | --- | --- | --- |
| claude | `--permission-mode plan` | `--permission-mode <engines.claude.writePermissionMode>` (`acceptEdits` by default) | `--permission-prompts none`, `--disallowedTools Agent,Task` (blocks recursive subagent dispatch) |
| codex | `--sandbox read-only` | `--sandbox workspace-write` | `-c approval_policy="never"`, `-c agents.enabled=false`, `-c mcp_servers.coordination.enabled=false` (a Codex worker cannot re-enter the coordination server) |
| antigravity | `--mode plan` | `--mode accept-edits` | `--sandbox` always set |

**Where overrides live, from most to least specific:** a single
`spawn_worker` call's `model_override`/`thinking_budget` → that role's entry
in `.harness/settings.json` `roles[role].models`/`.effort` → that engine's
profile default in `settings.engines[engine].models`/`.effort`. Change the
canonical defaults in `.harness/settings.json`; never hand-edit a generated
agent file to change its model.

`settings.json` also carries `maxWorkers` (concurrent worker cap),
`workerTimeoutSeconds` (per-task ceiling, also passed to Antigravity's
`--print-timeout`), and `validation` (an array of argv-array commands run as
pre-merge validation before `merge_and_cleanup_worker` integrates a worker;
empty by default — a project adds its own build/test commands here).

## 9. Dependencies and one-time setup

The harness generator and its tests (`scripts/sync-harness.mjs`,
`tests/harness.test.mjs`) are dependency-free — they run on a bare Node.js 22+
install. The **coordination MCP server** is not: `tools/coordination-mcp/`
depends on `@modelcontextprotocol/sdk` and `zod`
(`tools/coordination-mcp/package.json`), and its `node_modules/` is gitignored.
A fresh clone needs one `npm ci` before the MCP server (and therefore
`spawn_worker`, `get_workflow`, and every `project-*` workflow) will run.
Because commands are MCP prompts, none of them work until the server is up.

Setup sequence for a new adopter:

```bash
node scripts/sync-harness.mjs --check     # confirm generated files match .harness/ (no deps needed)
npm ci --prefix tools/coordination-mcp    # install the MCP server's dependencies (one time)
node scripts/configure-mcp.mjs            # register the coordination server for all three clients
# then: approve project trust / MCP access inside claude / codex / agy
```

## 10. Compatibility checks

`.github/workflows/harness.yml` runs on every push/PR, on both
`ubuntu-latest` and `windows-latest`:

```bash
npm ci                                    # (working-directory: tools/coordination-mcp)
node scripts/sync-harness.mjs --check
node --test tests/harness.test.mjs
node --test tests/mcp-setup.test.mjs
npm test                                  # (working-directory: tools/coordination-mcp)
```

A red run means either `.harness/` and its generated outputs have drifted
(`sync-harness.mjs --check` fails) or the coordination server itself regressed
(`npm test` under `tools/coordination-mcp`). `tests/mcp-setup.test.mjs` is the
CLI smoke test for §6: it runs `configure-mcp.mjs` against a scratch root with
a pre-existing unrelated MCP server and a pre-existing Codex config comment,
and asserts registration is idempotent, leaves the unrelated server and
comment untouched, and throws on an unowned `coordination` entry rather than
overwriting it.

## 11. Adding a new CLI engine

Everything CLI-specific lives in one module per engine under
`tools/coordination-mcp/engines/`. The control plane — `config.mjs`,
`manager.mjs`, `server.mjs` — contains **no engine names at all**; its validation
lists and the `cli_engine` enum are derived from the registry.

To add an engine:

1. **Write `tools/coordination-mcp/engines/<name>.mjs`**, default-exporting:

   ```js
   export default {
     name: 'gemini',
     efforts: ['low', 'medium', 'high'],       // this CLI's effort vocabulary
     buildArgs({ config, settings, role, access, readOnly, workspace, model, effort }) {
       return [/* argv */];                     // never a shell string
     },
   };
   ```

2. **Register it** in `engines/index.mjs` — one import, one array entry.
3. **Add an `engines.<name>` block** to `.harness/settings.json` with
   `executable`, `models`, and `effort` for all three profiles.

That is the whole procedure for the control plane. The registry is an explicit
list rather than a directory scan on purpose: importing whatever `.mjs` happened
to sit in that folder would turn a dropped file into executable code inside the
process that spawns write-capable workers.

**The conformance suite then holds the new adapter to the same contract as the
others.** `test/engines.test.mjs` iterates the registry, so a new engine is
automatically required to produce well-formed shell-free argv, pass a hostile
workspace path (`C:/with spaces/café/$(touch pwned)`) as a single argv element,
distinguish `read-only` from `write` with role and model held constant, honour
its declared effort vocabulary, pass a model override through, and never emit a
permission-bypass flag. `workerCommand` re-checks the returned argv for control
characters and bypass tokens, so an adapter is verified rather than trusted.

### What still needs a per-engine edit

One place remains engine-aware, and it does not collapse into a common shape:

- **`scripts/configure-mcp.mjs`** registers the MCP server per client: JSON
  merge for `.mcp.json` and `.agents/mcp_config.json`, a marker-delimited block
  for `.codex/config.toml`. A new client needs its own registration format,
  because the config file formats genuinely differ.

Everything else is already pluggable. Commands and agents generate nothing, so
they need no per-engine work at all — a worker learns its role from the prompt
the manager builds. Skills render once and are written to the two
discovery roots that exist — `.claude/skills` for Claude Code, `.agents/skills`
for Codex and Antigravity — with identical content and no per-harness flavour.

An MCP-only engine therefore needs no generator change whatsoever: one adapter
module, one registry line, one settings block.

## 12. Engine status — what has actually been dispatched

The full loop — spawn → isolated worktree → real CLI → file write → supervisor
commit → clean worktree — has been exercised against **all three engines**, each
with a real `developer` write role dispatched from this repository.

| Engine | Read-only roles | Write roles | Its own shell |
| --- | --- | --- | --- |
| Claude | verified | verified end to end | granted per dispatch via `writeAllowedTools` |
| Codex | verified | verified end to end | free inside the sandbox; `.git` excluded |
| Antigravity | verified (a dispatched worker used read tools and returned its report) | verified end to end | **unavailable** without a user-global allow-rule |

Each write worker was told to create one file and nothing else; each produced the
file, ran no git, and had its work committed by its runner:

| Engine | Worker output | Supervisor commit |
| --- | --- | --- |
| Claude | `tests/fixtures/e2e-claude.txt` | `30a84c3` `test(e2e): claude supervised commit` |
| Codex | `tests/fixtures/e2e-codex.txt` | `6b876e5` `test(e2e): codex supervised commit` |
| Antigravity | `tests/fixtures/e2e-antigravity.txt` | `7a3b05a` `test(e2e): antigravity supervised commit` |

Each worker branch then held exactly one commit over its base, touching exactly
one path inside `owned_paths`, with a clean worker checkout and an untouched
integration checkout. The branches were deleted rather than merged, so those SHAs
are evidence in this document, not history in this repository. Integration itself
is covered by the unit suite, which merges a real worker branch through
`merge_and_cleanup_worker` and asserts the guards.

### Why the runner commits, per engine

- **Codex cannot commit.** A real Codex worker reads, runs shell commands, and
  writes files, but `git add` fails with
  `Unable to create .git/worktrees/<id>/index.lock: Permission denied`, and Codex
  emits a diff instead — its own delivery model is `codex apply` on the host.
  This is deliberate upstream behaviour, not a misconfiguration: a writable
  `.git/hooks` would let an agent plant a hook that executes *outside* the sandbox
  the next time a human runs git. The documented escape — pointing
  `sandbox_workspace_write.writable_roots` at `.git` — does not help, and both
  blockers are open with no fix:
  [openai/codex#18918](https://github.com/openai/codex/issues/18918) (since Codex
  0.122.0, Windows applies DENY ACLs to `.git` inside `writable_roots`) and
  [openai/codex#27418](https://github.com/openai/codex/issues/27418) (the sandbox
  force-protects the resolved gitdir of a **linked worktree** even with explicit
  write permission). The second applies on Linux too, and this project always
  dispatches into linked worktrees, so this is not a Windows-only limitation.
  Both were reproduced here, including in a standalone clone with `.git` inside
  the workspace, which failed identically. With the runner committing, none of
  this is on the critical path any more.
- **Antigravity cannot run the terminal at all** in headless mode without a
  user-global allow-rule (see below). A write worker that only edits files never
  needs one — which is exactly what the verified dispatch above did.
- **Claude can, and no longer does**, so that the delivery shape does not depend
  on which engine ran. See §7, *How a worker's work becomes a commit*.

### Codex pins no models

All three profiles are `null`, so every Codex worker inherits the CLI default and
the `reasoning`/`balanced`/`fast` distinction is lost. This also weakens
behavioural rule 12, which prefers a *different* model for adversarial review:
with Codex inheriting, a Codex-dispatched adversary may silently run the same
model as the author. Fill in `engines.codex.models` once the intended IDs are
confirmed.

### Antigravity: there is no per-project place to allow a command

`agy` gates every `run_command` on a `command(...)` rule under
`permissions.allow`, and headless mode cannot prompt, so anything unlisted is
auto-denied:

```json
"denied_actions": [{ "action": "command", "display_name": "RunCommand" }]
```

Those rules live **only** in the user-global
`~/.gemini/antigravity-cli/settings.json`. Every repository-scoped alternative was
tried against agy 1.1.27 and none of them works:

| Candidate | Result |
| --- | --- |
| `<repo>/.agents/settings.json` with `permissions.allow` | Not read. Command still auto-denied. |
| `~/.gemini/config/projects/<id>.json` → `settings.permissions.allow`, on the active default CLI project | Not applied. Command still auto-denied, despite the CLI's own changelog describing project configs as taking precedence over global settings. |
| `<repo>/.agents/hooks.json`, a `PreToolUse` hook on `run_command` | **The hook loads and fires** — verified: it ran with the working directory set to `.agents/`, received the full tool call (`{"toolCall":{"name":"run_command","args":{"CommandLine":"git rev-parse --short HEAD",…}}}`) on stdin, and inherited the runner's environment. But its documented replies do not reach the permission engine: `{"decision":"allow"}`, `"allowTool": true`, and `"permissionOverrides": ["command(git)"]` were each tried, together and separately, and the call was auto-denied every time. |
| Control: a rule already present in the user-global `settings.json` | **Passes the command gate**, proving the rule syntax and headless enforcement both work and that only the file's location is the problem. That run then hit a *second* gate, `escalate_admin`, because `--sandbox` is set — which has no per-project home either. |

So the toolkit cannot grant agy the way it grants Claude's tools, and it will not
silently edit a file that governs all of a user's projects. To use `agy` for work
that needs a terminal — running the project's tests, for instance — add a
`command(...)` rule to `~/.gemini/antigravity-cli/settings.json` yourself, scoped
as tightly as your workflow allows. Without one, `agy` is best used for roles that
read and write files: the verified write dispatch above never touched a terminal.

`.agents/hooks.json` is still a real, repo-committed extension point for
everything hooks *can* do — blocking a tool call, rewriting its arguments,
injecting context, or keeping the loop alive. Note that a worktree is created
from committed HEAD, so a hooks file only reaches a worker if it is tracked.

One thing that was *not* a problem: agy writes its transcript and artifacts under
`~/.gemini/antigravity-cli/brain/<conversation>`, not into the workspace, so a
dispatched worker leaves no stray files to fail the ownership check.
