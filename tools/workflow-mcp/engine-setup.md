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

Known gap, measured on 2.1.267: this denies Write/Edit reliably in every
`--permission-mode` value, but does not make the allowlist a hard gate on Bash.
A Bash command outside `--allowedTools` can still execute if Claude Code's own
auto-mode classifier (`claude auto-mode defaults`) judges it benign — proven
with `sha256sum` against a file whose hash could not otherwise be known. Only
file mutation is actually guaranteed closed; "workers may only run these exact
commands" is not, for this engine, as things stand.

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

**The wrapped command turns this into a real failure.** `extract-agy-result.mjs`
reads the `result` event, and now exits non-zero when `denied_actions` is
non-empty or no `result` event was found at all; `dispatch.mjs` folds that into
the exit code of the whole runnable command, unless the underlying process
itself already failed (that `ec` still wins). So a denied grant is no longer
something the conductor has to notice by reading — a nonzero exit is the
signal — but the report is still where you find *which* action was denied.

### Read grants for files outside the worktree

Each worker's workspace is its isolated worktree (from `prepare_worktree`).
Anything it needs to read that lives outside that tree — a shared virtualenv,
a `vendor/` directory, a monorepo dependency the worktree doesn't include — is
invisible to it unless granted, **separately from `workerCommands`**: allowing
`pytest` does not grant reading the interpreter's own packages, and a denied
read fails exactly like a denied command (exit 0, `SUCCESS`, empty response,
now caught by the check above).

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

Prefer this over setting `allowNonWorkspaceAccess: true` below: that flag
grants every path on the machine, where a handful of `read_file(...)` entries
grant only the ones this project actually needs.

### Why agy workers run without `--sandbox`

With `--sandbox`, every shell call needs the `escalate_admin` permission instead
of `command`, and headless mode cannot prompt for that either — the worker
returns nothing. `escalate_admin` also cannot be scoped to a command line (its
target is the tool), so keeping the sandbox would mean granting Bash escalation
wholesale: strictly broader than the exact-match rules above. Isolation for agy
workers therefore rests on the worktree, `--add-dir`, and this allowlist.

Two consequences worth knowing, both surfaced in `build_worker_prompt`'s
`warnings`:

- **Read-only is prompt-level on agy.** `--mode plan` binds on its own, but agy
  prints `warning: --mode plan has no effect while slash command expansion is
  disabled` and means it. Recovering the mode would require dropping
  `--disable-slash-commands`, which loads agy's own commands and skills on top of
  the composed prompt — trading the context guarantee for the access one. Check
  `git status --porcelain` in the worktree after a read-only agy dispatch.
- **The leaf-worker rule is prompt-level on agy.** Its workers get
  `define_subagent`/`invoke_subagent` and there is no flag to remove them.

If your `~/.gemini/antigravity-cli/settings.json` sets
`"allowNonWorkspaceAccess": true`, an agy worker can read and write outside its
worktree. Set it to `false` if you want that boundary enforced rather than
promised.

## Checking your setup

[`conductor-e2e.md`](conductor-e2e.md) runs a worker on each engine and reports
which of these guarantees actually held on your machine. Run it after changing
any of the above.
