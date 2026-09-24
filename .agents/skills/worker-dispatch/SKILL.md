---
name: worker-dispatch
description: Conductor-only. How to run one worker through the workflow MCP and decide whether to accept its result — check, prepare the worktree, compose, run, inspect, record the decision, integrate, clean up, resume. Use for every dispatch any command makes. Trigger on "dispatch", "prepare_worktree", "build_worker_prompt", "inspect_dispatch", "record_decision", "dispatch_stats", "run the worker", "retry the worker", "resume a dispatch", "worker failed", "accept the report", "change a role's engine".
type: skill
---

# Worker Dispatch

One procedure for every dispatch any command makes. The command decides *which* role gets *what* brief; this decides how the worker runs and whether its result is accepted.

## Read first

- `tools/workflow-mcp/engine-setup.md` — only the section for an engine `check` reports a problem with.

## Once per cycle, before the first dispatch

1. **Call `check`** and act on every field before composing anything:
   - `ok: false` → regenerate with `sync` — or, if `tools/workflow-mcp/` changed since the server started, run `generate.mjs` directly: the server caches its own source (`tools/workflow-mcp/getting-started.md` § Troubleshooting).
   - A role you are about to dispatch appears in `roles_without_an_available_engine` → `human-checkpoint`.
   - An engine that role resolves to has `setup.ok: false` → `human-checkpoint` naming its `missing_command_grants` and `missing_url_grants` (a web-capable role's `read_url(*)`, user-global) — or its `problem`, a settings file that exists but could not be read, which `grant_antigravity_setup` refuses to touch. A worker on it dies on its first denied command or URL. On the human's yes, `grant_antigravity_setup` writes exactly what is listed.
   - The role appears in `capability_gaps` for its first engine → dispatch it with `cli_engine` set to an engine not listed there.
   - `architecture.enforced: false` on a project whose `docs/wiki/architecture.md § Layers` is filled → say so in the cycle report; the layers are then enforced by review alone.

## Per dispatch

1. **Prepare.** `prepare_worktree` with a task id — and, for the next case of a cycle, `reuse: <the previous case's task id>` once that case is decided and integrated: the same directory on a new branch at HEAD, its installed dependencies intact, instead of a fresh checkout and a fresh install. If it returns a `setup_command`, run that one line: it runs every configured setup step in the worktree, under `workerTimeoutSeconds`, stops at the first failure and prints only a failure's output (on a reused worktree it is quick, and still needed if the last case changed a dependency). Never paste the individual `setup_commands` into your shell. A failing setup command is a blocker — never dispatch into a half-built worktree. Whatever setup creates must be gitignored; otherwise inspection reads it as worker output.
2. **Compose.** `build_worker_prompt` with the role, `instructions` or `instructions_file`, the `workspace` and the same `task_id` — plus `owned_paths` and `commit_message` for a write role, and `diff_range` for any review. The role receives the skills its command declares for it (and `roles.<role>.extraSkills`) without being asked; pass `command` when two commands would give it different ones, and `skills` only to narrow the list. Re-composing into a task whose last attempt already ran archives that attempt (with the verdict it had) and counts this one as a retry; a retry in a fresh worktree passes `retry_of: <previous task id>`. Composing into a task whose attempt is still running is refused — a live process would finish into the new attempt's record — so wait and inspect it, or pass `abandon_running: true` only once you know that process is gone. Read the `warnings`: a fallback engine, a shared quota, an empty diff, a capability the engine lacks.
3. **Run** the returned `command` verbatim — one `node …/run-worker.mjs <dir>` line, the same in bash, zsh, PowerShell or cmd, on the machine that holds the checkout (not a WSL shell over a Windows checkout). It launches the engine, stops it and everything it started at `workerTimeoutSeconds`, records the outcome and prints the report. A worker takes minutes: where the shell tool has a short limit, run it in the background and wait for it to finish (Claude Code: `run_in_background`, then the completion notification) — a call the tool moves to the background is still running, and `inspect_dispatch` says `running` until it ends. Never compose into the task meanwhile.
4. **Inspect.** `inspect_dispatch` with the task id, then act on `verdict.mechanical`:
   - **`reject`** → the result is not accepted, whatever the report says. Each reason names the failure — nonzero exit, empty report, a denied action (the refused target is in the report), a change outside scope, a commit on the worker branch, a subagent call. Fix the cause (a grant, an input inlined instead of read from outside the worktree, a narrower brief) and re-dispatch, or `human-checkpoint`. Never re-send an unchanged brief: the same inputs fail the same way — with one exception. When the verdict carries `transient: true`, the engine ended the run after rejecting its own malformed tool call (measured on agy); the brief was not the cause, so re-dispatch once unchanged. A second transient failure is a `human-checkpoint`, not a third try.
   - **`incomplete`** → it has not run or not finished — or it is a developer dispatch that declared `test_paths` and its Red is not proven yet. Run `red.command` — Green with the implementation, the architecture check, then Red without it (exit 0 proven; 1 not green, architecture failing, refuted or timed out; 2 a phase could not run) — read the output tail it prints, and inspect again. Never commit in the worktree before this: the check compares the working tree against `base_sha`.
   - **`pass`** → nothing computable is wrong, which is not the same as the work being right. Read the report at `report.path` and judge it against what the command defines as done — numbered findings with a `Checked:` line for a review, a proven Red plus a green suite and architecture check for a developer case. Weigh `verdict.warnings` too: on agy and codex the audit lists reads outside the workspace and skills the worker opened but was not sent — for a reviewer, either can mean it read the author's material, and then its independence is gone. Claude workers have no transcript to audit, but their denied tool calls come back as warnings too.
5. **Decide.** `record_decision` with `accepted` or `rejected` and the one-sentence reason — for every finished dispatch, rejections included. Accepting anything but a `pass` needs `override_mechanical: true` and a reason that answers each rejection reason; if you cannot write that sentence, you are not accepting it. For a review dispatch, also pass `findings` (counts raised per severity, and per disposition once you have disposed of them — record the decision again then) and `reviewed_task_ids`; that is what lets `dispatch_stats` report whether a review role earns its tokens. Undecided attempts are what make `dispatch_stats` meaningless.
6. **Integrate** an accepted write role: stage exactly its `owned_paths` in its worktree, commit with the message you passed, then merge `worker/<id>` into your branch with a plain `git merge` — never `--ff-only`, because the worktree branched from an older HEAD whenever your branch has moved since. Resolve conflicts per `git-recovery` and keep the merge commit. A path the worker reported as superseded is yours to `git rm` in the same commit: workers cannot delete files. Lines under the report's `Follow-ups:` (todos, wiki-todos) are yours to append in that commit too.
7. **Clean up.** `remove_worktree` once the work is integrated — unless the next dispatch reuses it (step 1) — or once a rejected attempt's worktree holds nothing you still need. A refusal means read before retrying; never force it. The dispatch record outlives the worktree.

## Resuming an interrupted dispatch

`list_worktrees` shows what exists; `inspect_dispatch` per task gives `state`, `attempt`, `base_sha`, `owned_paths`, `decision` and the report path. Resume from the state: `prepared` → step 2; `composed` → step 3; `finished` with no decision → step 4; `accepted` but not merged (`worktree.merged: false`) → step 6.

## Changing which engine a role runs on

Call `dispatch_stats` first and compare, for that role, accepted over finished, retries, and median duration per engine — on real cycles, not a single run. A change to `.agents/config.json` with no stats behind it is a guess; if you make one anyway, say so in its log entry.

## Anti-patterns

- **Accepting on the exit code, or on the report's own claim of success.** Measured: `exit 0` + `SUCCESS` + a denied read, and a Red "confirmed" by a green suite that never reached the code.
- **Dispatching into a worktree whose setup failed.** Every result from it measures the environment, not the change.
- **Leaving attempts undecided.**
- **Running a long command raw in your shell** — a test suite, an install, a setup step. It has no limit, and a shell tool that gives up on it can stop the shell and leave its children running (measured: a stopped shell's grep ran on for an hour and a half). Run it as `node tools/workflow-mcp/bounded.mjs [--timeout <s>] -- "<command>"`: its whole tree stops at the limit or when the runner itself is stopped, and it prints a bounded tail. Workers, red checks and setup already run this way.
- **Running a role through your own native subagent tool.** It inherits your context and your checkout (`AGENTS.md`, Delegating work).
