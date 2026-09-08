# Engine setup — what each CLI needs before it can run a worker

A worker is launched non-interactively, so **nothing can prompt**. Every
permission a worker needs must already be granted before it starts, or the tool
call is auto-denied. On two of the three engines that denial is silent enough to
look like success, so read this before pinning a role to an engine.

The allowlist itself lives in one place: `workerCommands` in
`.agents/config.json`. It is a list of **exact command lines**, not patterns —
both gating engines match the command line as invoked, so `npm test` is granted
and `cd x && npm test` is not.

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
(`/project:init` does this), and keep the list short. A worker reads, searches and
edits with its own file tools, which need no permission; commands are only for
running the suite and the few read-only git calls the role checklists name.

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

## Claude Code — nothing to do

The adapter turns each `workerCommands` entry into `--allowedTools
"Bash(<cmd>:*)"`. Read-only roles run in `--permission-mode default` rather than
`plan`: plan mode refuses every Bash call, which would stop an adversary from
verifying its own findings, while `default` plus `--permission-prompts none`
denies edits (no approval surface) and still allows the allowlisted commands.

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

This is why the conductor reads a worker's report rather than its exit code.

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
