---
name: worker-dispatch
description: How the conductor runs one worker through the workflow MCP and decides whether to accept its result — check the setup, prepare the worktree and run its setup commands, compose, run the returned command, inspect the dispatch, record the decision, integrate, clean up, and resume an interrupted dispatch. Use for every dispatch any command makes. Trigger on "dispatch", "prepare_worktree", "build_worker_prompt", "inspect_dispatch", "record_decision", "dispatch_stats", "run the worker", "retry the worker", "resume a dispatch", "worker failed", "accept the report", "change a role's engine".
type: skill
---

# Worker Dispatch

One procedure for every dispatch — `/project:work`, `/project:adversary`, `/project:review`, `/project:wiki`. A command decides *which* role gets *what* brief; this decides how the worker runs and whether its result is accepted. It is conductor-side only: no worker ever receives it.

## Read first

- `tools/workflow-mcp/engine-setup.md` — only the section for an engine `check` reports a problem with.

## Once per cycle, before the first dispatch

1. **Call `check`** and act on every field before composing anything:
   - `ok: false` → regenerate with `sync`. If the MCP server predates an edit to `tools/workflow-mcp/`, run `generate.mjs` directly instead (gotcha: the server caches its own source).
   - A role you are about to dispatch appears in `roles_without_an_available_engine` → `human-checkpoint`.
   - An engine that role resolves to has `setup.ok: false` → `human-checkpoint` naming its `missing_command_grants`. A worker on it dies on its first command.
   - The role appears in `capability_gaps` for its first engine → dispatch it with `cli_engine` set to an engine not listed there.
   - `architecture.enforced: false` on a project whose `docs/wiki/architecture.md § Layers` is filled → say so in the cycle report; the layers are then enforced by review alone.

## Per dispatch

1. **Prepare.** `prepare_worktree` with a task id. If it returns `setup_commands`, run each one inside the returned `workspace`, in order, and read the output. A failing setup command is a blocker — never dispatch into a half-built worktree. Whatever setup creates must be gitignored; otherwise inspection reads it as worker output.
2. **Compose.** `build_worker_prompt` with the role, `instructions` or `instructions_file`, the `workspace` and the same `task_id` — plus `owned_paths` and `commit_message` for a write role, and `diff_range` for any review. Re-composing into a task whose last attempt already ran archives that attempt (with the verdict it had) and counts this one as a retry; a retry in a fresh worktree passes `retry_of: <previous task id>`. Composing into a task whose attempt is still running is refused — a live process would finish into the new attempt's record — so wait and inspect it, or pass `abandon_running: true` only once you know that process is gone. Read the `warnings`: a fallback engine, a shared quota, an empty diff, a capability the engine lacks.
3. **Run** the returned `command` verbatim, on a POSIX shell that shares the checkout's filesystem — Git Bash on Windows, never WSL. The command records its own outcome. Launching from the structured `executable`/`args`/`cwd`/`stdin_file` fields skips that record, so use them only when no such shell exists, and judge that dispatch by hand.
4. **Inspect.** `inspect_dispatch` with the task id, then act on `verdict.mechanical`:
   - **`reject`** → the result is not accepted, whatever the report says. Each reason names the failure — nonzero exit, empty report, a denied action (the refused target is in the report), a change outside scope, a commit on the worker branch, a subagent call. Fix the cause (a grant, an input inlined instead of read from outside the worktree, a narrower brief) and re-dispatch, or `human-checkpoint`. Never re-send an unchanged brief: the same inputs fail the same way — with one exception. When the verdict carries `transient: true`, the engine ended the run after rejecting its own malformed tool call (measured on agy); the brief was not the cause, so re-dispatch once unchanged. A second transient failure is a `human-checkpoint`, not a third try.
   - **`incomplete`** → it has not run or not finished — or it is a developer dispatch that declared `test_paths` and its Red is not proven yet. Run `red.command` (exit 0 proven, 1 refuted, 2 the check failed), read its output tail, and inspect again. Never commit in the worktree before this: the check compares the working tree against `base_sha`.
   - **`pass`** → nothing computable is wrong, which is not the same as the work being right. Read the report at `report.path` and judge it against what the command defines as done — numbered findings with a `Checked:` line for a review, a proven Red plus a green suite and architecture check for a developer case. Weigh `verdict.warnings` too: on agy and codex the audit lists reads outside the workspace and skills the worker opened but was not sent — for a reviewer, either can mean it read the author's material, and then its independence is gone. Claude workers have no transcript to audit.
5. **Decide.** `record_decision` with `accepted` or `rejected` and the one-sentence reason — for every finished dispatch, rejections included. Accepting anything but a `pass` needs `override_mechanical: true` and a reason that answers each rejection reason; if you cannot write that sentence, you are not accepting it. For a review dispatch, also pass `findings` (counts raised per severity, and per disposition once you have disposed of them — record the decision again then) and `reviewed_task_ids`; that is what lets `dispatch_stats` report whether a review role earns its tokens. Undecided attempts are what make `dispatch_stats` meaningless.
6. **Integrate** an accepted write role: stage exactly its `owned_paths` in its worktree, commit with the message you passed, then merge `worker/<id>` into your branch with a plain `git merge` — never `--ff-only`, because the worktree branched from an older HEAD whenever your branch has moved since. Resolve conflicts per `git-recovery` and keep the merge commit. A path the worker reported as superseded is yours to `git rm` in the same commit: workers cannot delete files. Lines under the report's `Follow-ups:` (todos, wiki-todos) are yours to append in that commit too.
7. **Clean up.** `remove_worktree` once the work is integrated, or once a rejected attempt's worktree holds nothing you still need. A refusal means read before retrying; never force it. The dispatch record outlives the worktree.

## Resuming an interrupted dispatch

`list_worktrees` shows what exists; `inspect_dispatch` per task gives `state`, `attempt`, `base_sha`, `owned_paths`, `decision` and the report path. Resume from the state: `prepared` → step 2; `composed` → step 3; `finished` with no decision → step 4; `accepted` but not merged (`worktree.merged: false`) → step 6.

## Changing which engine a role runs on

Call `dispatch_stats` first and compare, for that role, accepted over finished, retries, and median duration per engine — on real cycles, not a single run. A change to `.agents/config.json` with no stats behind it is a guess; if you make one anyway, say so in its log entry.

## Anti-patterns

- **Accepting on the exit code, or on the report's own claim of success.** Measured: `exit 0` + `SUCCESS` + a denied read, and a Red "confirmed" by a green suite that never reached the code.
- **Dispatching into a worktree whose setup failed.** Every result from it measures the environment, not the change.
- **Leaving attempts undecided.**
- **Running a role through your own native subagent tool.** It inherits your context and your checkout — `AGENTS.md § Delegating work`.
