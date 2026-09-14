# Engine setup — what each CLI needs before it can run a worker

A worker is launched non-interactively, so **nothing can prompt**. Every
permission a worker needs must already be granted before it starts, or the tool
call is auto-denied. On two of the three engines that denial is silent enough to
look like success, so read this before pinning a role to an engine.

The allowlist itself lives in one place: `workerCommands` in
`.agents/config.json`. It is a list of **exact command lines**, not patterns.
The engines differ in how (and whether) they actually gate on it — agy's
`command(<line>)` rules are true exact-match with no argument wildcarding at
all; Claude Code's `Bash(<line>:*)` permits the command with any trailing
arguments; Codex doesn't consult this list at all; its OS-level sandbox gates
writes regardless of it (see below) — but on every engine, `npm test` is what
the prompt tells a worker it may run, and `cd x && npm test` is not something
any worker should be composing regardless of what a particular engine happens
to let through.

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

Set the test command to your project's real one when you adopt the template
(`/project:init` step 5a does this, in `.agents/config.json` as well as
`docs/wiki/commands.md`), and keep the list short. A worker reads, searches
and edits with its own file tools, which need no permission; commands are
only for running the suite and the few read-only git calls the role
checklists name.

**The list is also inlined into every worker prompt**, under `## Commands you may
run`. That is not redundancy: a worker that does not know the list improvises a
near-miss — `git log -n 3` instead of an allowlisted read — and on agy a single
denied command ends the run and discards the report along with any work already
done. Measured: a developer that had already written its failing test returned an
empty response after one denied `git log`. Adding a command means adding it here,
in the agy settings below, and nowhere else.

## Codex — nothing to do

`--sandbox` plus `approval_policy="never"` is an OS-level sandbox with no
approval surface to begin with, so commands run and writes are refused by the
kernel rather than by a prompt. `workerCommands` does not apply.

### Codex on Windows

Codex runs a worker under a different Windows SID than the repo owner, so
every git call in the worktree fails `fatal: detected dubious ownership`
unless that exact path is trusted first — measured: owner SID `…-1001`,
worker SID `…-1005`. Left unfixed, this silently disables the `adversary` and
the `reviewer` on Windows: their first git call errors, and nothing else in
the dispatch surfaces that as anything other than an empty or confused
report.

`prepare_worktree` handles this itself — every worktree it creates is
registered with `git config --global --add safe.directory <path>`
immediately after creation, so a Codex worker dispatched into it never hits
the ownership check. Nothing to configure.

If you ever hit `dubious ownership` from a worker anyway (a worktree created
some other way, or a global config that got reset), trust it manually:

```
git config --global --add safe.directory <absolute path to the worktree>
```

**The trailing-`/*` wildcard some git versions document does not suppress
this on Windows** (measured) — it takes a literal path per worktree, or the
blanket `git config --global --add safe.directory "*"`, which trusts every
repository on the machine and is a real loosening of the ownership check, not
just a convenience.

### Codex — optional context-management overrides

`-o reportFile` (above, in the codex adapter) keeps the *conductor* from
paying for a bloated transcript, but says nothing about the *worker's own*
context during a long task: a wiki-maintainer health pass or an adversary
sweep that reads many large files can still burn through its history and
force an early, lossy auto-compaction mid-task.

Codex's own config.toml exposes two knobs for this — unrelated to this
repo's report/raw split, and not measured against a real dispatch here the
way the transcript sizes above are, so no default is set for you. Opt in per
project in `.agents/config.json`'s `engines.codex` block:

```json
"engines": {
  "codex": {
    "executable": "codex",
    "toolOutputTokenLimit": 2000,
    "modelAutoCompactTokenLimit": 50000,
    ...
  }
}
```

- `toolOutputTokenLimit` caps how many tokens of a single tool output (a large
  file read, a verbose command) Codex keeps in its own history before
  truncating — lower keeps a session lean but risks the worker missing
  something in the truncated tail.
- `modelAutoCompactTokenLimit` is the history size that triggers Codex's own
  auto-summarization pass. Lower triggers it earlier (more headroom, less
  early-session detail retained); unset, Codex picks a default based on the
  model's context window.

Both must be positive integers, and both are Codex-only — `loadConfig` refuses
either field on `engines.claude` or `engines.antigravity`, since neither
adapter has an argv slot that reads them and the value would otherwise be
silently inert.

## Claude Code — nothing to do

The adapter turns each `workerCommands` entry into `--allowedTools
"Bash(<cmd>:*)"`. Read-only roles run in `--permission-mode dontAsk` rather than
`plan`: plan mode refuses every Bash call, which would stop an adversary from
verifying its own findings, while `dontAsk` plus `--permission-prompts none`
denies edits (no approval surface) and still allows the allowlisted commands.

Known gap, measured on 2.1.267: this does not make the allowlist a hard gate on
Bash. A command outside `--allowedTools` can still execute if Claude Code's own
auto-mode classifier (`claude auto-mode defaults`) judges it benign — proven
with `sha256sum` against a file whose hash could not otherwise be known. A
fuller sweep bounds the actual exposure, though: writes, deletes, network
calls, and reads outside the worktree were all denied in every mode tried.
Only local, in-scope, non-mutating reads slip through, and Read/Grep/Glob
already grant every role that same access unconditionally — so this costs
nothing beyond what a worker's own file tools already allow. "Workers may only
run these exact commands" is not literally true for this engine; "workers
cannot mutate, exfiltrate, or read outside their worktree" still is. A custom
`--settings` hard_deny rule and a blanket `--disallowedTools Bash` were both
tried as a fix and neither restored the literal allowlist without also
breaking the commands it's meant to grant — see `docs/wiki/gotchas.md`.

## Antigravity (agy) — one manual step, per machine

**agy reads no project-local configuration in print mode.** A `.gemini/settings.json`
in the repository is ignored — measured: identical run, identical denial. The
only file it reads is user-global:

```
~/.gemini/antigravity-cli/settings.json
```

Add one `command(...)` rule per `workerCommands` entry, matching the string
exactly:

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

Merge these into the existing `permissions.allow` rather than replacing it — the
file also holds your interactive grants. Matching is **exact**: `command(npm test)`
does not grant `npm test -- --watch`, and `command(git status)` does not grant
`git status --porcelain`. That is why both spellings are listed above.

Without it, an agy worker **exits 0, reports `SUCCESS`, and returns an empty
response**, with the reason only in stderr and in `denied_actions`:

```
jetski: no output produced — a tool required the "command" permission that
headless mode cannot prompt for, so it was auto-denied.
```

**`check` tells you before a cycle.** Its `antigravity` entry carries a `setup`
block listing every `workerCommands` entry with no exact grant in that file, so a
missing grant is found without spending a dispatch on it.

**The wrapped command turns every silent agy failure into a real one.**
`extract-agy-result.mjs` exits non-zero when `denied_actions` is non-empty (and
names the refused target, recovered from the transcript), when no `result` event
was found, when the response is empty with no denial at all (measured: a tool
call rejected as malformed, after which the run simply ended `SUCCESS`), and when
the worker wrote outside its workspace or called a subagent tool. `dispatch.mjs`
folds that into the exit code of the whole runnable command, unless the
underlying process itself already failed (that `ec` still wins). A nonzero exit
is the signal to reject the report; the report is where you find why.

### Read grants for files outside the worktree

Each worker's workspace is its isolated worktree (from `prepare_worktree`).
A read outside that tree — a shared virtualenv, a `vendor/` directory, a
monorepo dependency the worktree doesn't include — **may** be denied, and when
it is, it fails exactly like a denied command (the run ends, the report is
discarded, the wrapped command exits non-zero and names the target). Allowing
`pytest` does not grant reading the interpreter's own packages.

Which reads are denied is not fully established. Measured on agy 1.2.2: reads
into an adopting project's own `.venv` and `vendor/` were denied, and so was a
read into another registered agy workspace; reads into a scratch directory agy
had no record of were allowed — including the conductor's own dispatch files —
and `allowNonWorkspaceAccess: false` changed nothing. So a worktree is not a read
boundary on agy. `extract-agy-result.mjs` lists every read outside the workspace
under `workflow_mcp_audit.reads_outside_workspace` in the report, on every run;
read it, especially for a reviewer whose value is not having seen the author's
material.

Grant it as `read_file(<absolute path>)` in the same
`~/.gemini/antigravity-cli/settings.json` `permissions.allow` list as the
`command(...)` entries — a directory grant covers its descendants, so one
entry per shared root is enough:

```json
{
  "permissions": {
    "allow": [
      "command(npm test)",
      "read_file(C:/path/to/shared/.venv)",
      "read_file(C:/path/to/shared/vendor)"
    ]
  }
}
```

**Enumerate every shared path a role's task will touch in one pass before
dispatching, not one at a time.** Discovering these iteratively — dispatch,
read the denial, add one grant, redispatch, hit the next missing directory —
costs a full worker round trip per path. Read the task's instructions and the
skills it will receive first, list every directory outside the worktree they
imply, and grant all of them up front. Also check that nothing in `deny` or
`ask` shadows the path you just added — agy's own precedence puts `deny` and
`ask` ahead of `allow`, so a broader deny rule elsewhere silently wins.

Prefer this over setting `allowNonWorkspaceAccess: true`: a handful of
`read_file(...)` entries name only the paths this project actually needs.

### Why agy workers run without `--sandbox`

With `--sandbox`, every shell call needs the `escalate_admin` permission instead
of `command`, and headless mode cannot prompt for that either — the worker
returns nothing. `escalate_admin` also cannot be scoped to a command line (its
target is the tool), so keeping the sandbox would mean granting Bash escalation
wholesale: strictly broader than the exact-match rules above.

### Why every agy worker runs as a custom agent

`--mode plan` does not make a worker read-only — agy prints `warning: --mode plan
has no effect while slash command expansion is disabled` and means it — and a
plain agy worker is handed `define_subagent`/`invoke_subagent`, browser tools and
your user-global MCP servers. What does remove them is a custom agent, which agy
loads by name from `.agents/agents/` in any of its workspace folders, even in
print mode. So `build_worker_prompt` writes one per dispatch to
`.worktrees/.dispatch/<task_id>/agent/.agents/agents/workflow-<role>.md` and the
command passes `--agent workflow-<role> --add-dir <that agent dir>`:

- `excludeDefaultComponents: true` drops agy's own prompt sections and tools. Two
  measured failures lived there: the artifacts section, which invites an
  `ArtifactMetadata` argument on an ordinary write that agy then refuses as "not a
  valid artifact path", and the file-link section, which filled reports with
  absolute `file:///` links into the worker's own worktree.
- `inheritMcp: false` keeps the user's global MCP servers away from workers.
- `tools:` is the whole toolset: read, search and `run_command` for every role,
  plus `write_to_file`/`replace_file_content`/`multi_replace_file_content` for
  write roles. No subagent tools, no browser, no web.

Measured 2026-09-13: told to create a file and define a subagent, a read-only
worker did both when launched plainly and answered NO SUCH TOOL to both, creating
nothing, when launched as its agent. Across 9 real-task agy dispatches run this
way (plan-adversary, developer, adversary, reviewer, wiki-maintainer), none lost
a capability it needed. Two limits:

- **The agent must be named, not given as a path.** `--agent C:/…/x.md` is
  accepted and silently ignored — the worker ran with every default tool.
- **agy validates `tools:` strictly.** An unknown tool name fails the run with
  `tool "<name>" not found in registry`, so a typo cannot quietly widen the set.

It does not confine reads — see [Read grants](#read-grants-for-files-outside-the-worktree).

### The researcher role cannot run on agy headless

Measured once: `search_web` failed inside agy (`no summary returned from
GenerateContent`), and `read_url_content` is auto-denied in headless mode unless
each URL is granted in advance, which a research task cannot know. The agent
definition carries no web tools for that reason. Keep `researcher` off agy.

## Projects with a Python virtualenv

A worktree is a fresh checkout, so it has no `.venv` — it is gitignored. The
worker still has to run the suite from its own worktree, and there are two
layouts that work and one that looks like it works. Measured 2026-09-13 on a
src-layout package with an editable install, agy workers, Windows:

| Layout | Worker command | What the tests import | Outcome |
| --- | --- | --- | --- |
| Borrow the root `.venv`, nothing else | `../../.venv/Scripts/python.exe -m pytest` | **the main checkout's `src/`** | the new test stayed Red after a correct implementation; the worker patched `sys.path` inside the test file to get Green, and Python wrote `__pycache__` into the main checkout |
| Borrow the root `.venv` + `pythonpath = ["src"]` | `../../.venv/Scripts/python.exe -m pytest` | the worktree's `src/` | clean Red → Green |
| A `.venv` per worktree | `.venv/Scripts/python.exe -m pytest` | the worktree's `src/` | clean Red → Green |

**Never the first layout.** An editable install writes an absolute path to the
root checkout's `src/` into the venv, and it wins over the worktree. The failure
runs both ways: a correct change stays Red, and a Red can pass on code the worker
never touched.

**Borrowing the root venv** needs one line in `pyproject.toml`, which puts the
rootdir's `src` ahead of the editable install whenever pytest runs:

```toml
[tool.pytest.ini_options]
pythonpath = ["src"]
```

(A root `conftest.py` that prepends `src` to `sys.path` does the same.) The
command is relative to `.worktrees/<id>/`, so it is a different string from the
one you run at the root, and both need their own `workerCommands` entry and agy
grant. The venv is shared, so a cycle that adds a dependency cannot test it in
its worktree until someone installs it at the root. On codex, the sandbox cannot
resolve a venv whose base interpreter lives outside the worktree (measured in an
adopting project) — prefer a per-worktree venv for roles pinned there.

**A venv per worktree** is self-contained: the worker command is the same string
as at the root, dependency changes are testable inside the cycle, and nothing
reads outside the worktree. With `uv` and a warm cache it took under 3 seconds:

```bash
uv venv --python 3.11 .venv
uv pip install --python .venv/Scripts/python.exe -e . pytest    # or: uv sync, with a uv.lock
```

The conductor runs that in the worktree after `prepare_worktree` and before
dispatch; the `.venv` is ignored, so the worktree still reads as clean. A
virtualenv is also deep enough to pass Windows' 260-character path limit, which
used to make `remove_worktree` fail half-way and leave the directory and branch
behind; worktrees are now created and removed with `core.longpaths=true`.

Either way, `check`'s `setup` block lists the command if agy has no exact grant
for it.

## When an engine is unavailable

Two different problems wear the same face, and only one of them is computable.

**The CLI is not installed.** `check` reports, per engine, whether its
`executable` resolves on PATH, which roles resolve to it, and — the actionable
part — `roles_without_an_available_engine`. Run it before a cycle rather than
finding out from a composed prompt that could never have run.

**The engine is installed but refuses to work** — a usage limit, an expired
login. Nothing short of running the CLI reveals `try again at 9:05 PM`, so no
amount of checking will predict it. What is left is recovering cheaply:

- **Give a concentrated role a fallback chain.** `roles.<name>.engine` takes an
  ordered list as well as a single name:

  ```json
  "planner": { "engine": ["codex", "claude"], "models": { "codex": "gpt-6-astra" } }
  ```

  Dispatch takes the first entry that is installed, and says so in `warnings`
  when it falls through — a worker running on a model the role was not tuned on
  is a result you have to be able to weigh. `inherit` is allowed inside a chain
  and means the conducting CLI; a repeat is collapsed.

- **Override one dispatch.** `cli_engine` on `build_worker_prompt` beats the
  chain entirely, which is the right tool for a usage limit: the engine is
  installed, so the chain has no reason to skip it.

Worth checking when you pin roles: how many of them land on the same engine. A
measured session had four of seven on one, so a single usage limit made all four
undispatchable at once — including the `wiki-maintainer` that the findings
backlog was waiting on. `check`'s per-engine `roles` list shows that
concentration at a glance.

## Checking your setup

[`conductor-e2e.md`](conductor-e2e.md) runs a worker on each engine and reports
which of these guarantees actually held on your machine. Run it after changing
any of the above.
