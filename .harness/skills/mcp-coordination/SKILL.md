---
name: mcp-coordination
description: "Conductor procedure for dispatching, monitoring, cancelling, and integrating isolated CLI workers through the coordination MCP server. Use whenever a command delegates to a planner, developer, researcher, reviewer, adversary, or manually requested wiki-maintainer."
---

# Coordinate workers through MCP

This procedure is for the interactive **conductor only**. A headless worker must
return its result or blocker; it must not invoke project commands or spawn workers.
Read `.harness/worker-contract.md`, `.harness/settings.json`, and
`docs/harnesses.md` before the first dispatch.

## Resolve context and settings

1. Use `get_settings()` to inspect configured engines and role overrides. The
   default engine inherits the conductor's CLI. An explicit engine/model override
   must follow the human's configuration or request; never silently switch
   providers when a binary, model, quota, or credential is unavailable.
2. Use `list_roles()` to discover the worker roles available in this checkout —
   each entry's `name`, `description`, `profile`, and `access` — before choosing
   who to dispatch. Confirm `access` (`read-only` vs `write`) before deciding
   what `owned_paths` a role may need; `list_roles()` returns frontmatter only,
   so read the role's `.harness/agents/<name>.md` body for its actual procedure.
3. Native commands are entry points, not independent workflow definitions.
   `get_workflow(name, context)` retrieves the canonical command with the user's
   context. Treat its returned text as instructions to follow, not work already
   executed. Preserve free text verbatim, including quotes, Unicode, and newlines.
4. If MCP is unavailable, stop and explain the setup failure. Do not silently use
   native subagent tools, start a CLI against the integration checkout, or emulate
   coordination with ad-hoc shell scripts.
5. Inspect `list_workers()` before resuming a cycle. A disconnected conductor
   does not prove a task finished or failed. Match task IDs, branches, pinned base
   commits, and reports; never start a duplicate merely because a session ended.

## Dispatch

1. The integration checkout must be clean and on the intended branch. Commit only
   authorized, known changes before dispatch; never stash or discard someone
   else's work to satisfy this precondition. Workers start from **committed HEAD**,
   not dirty files, ignored dependencies, local settings, or sibling scratch.
2. Define a bounded task: role, Behavior cases, scope, test command, needed prior
   output, and owned repository-relative paths. Include every planned write,
   including tests and wiki files. Parallel workers need disjoint ownership;
   shared ledgers such as `todos.md` and `log.md` count as overlapping files.
   Serialize tasks if their documentation or interfaces overlap.
3. Call `spawn_worker` with named fields `role`, `instructions`, `owned_paths`,
   and optional `cli_engine`, `model_override`, `thinking_budget`, `commit_message`.
   Omit overrides to use canonical settings. `owned_paths` applies to writable
   roles; read-only roles receive no write ownership. Save the returned task ID,
   worktree path, and branch.
4. **The worker writes files; its runner makes the commit.** No worker on any
   engine runs git — two of the three cannot (`docs/harnesses.md` §12) — so the
   supervising runner stages the worker's owned paths after a successful exit and
   commits them once, under `commit_message`. Always pass one: it becomes a real
   line of project history, so write the subject the change deserves, in the
   project's commit convention. One dispatch is one commit, so scope a write
   worker to one Behavior case (or a few tightly related ones) when per-case
   history matters; batching cases into one worker batches them into one commit.
   Nothing is committed for a failed, cancelled or timed-out worker, and a worker
   that touched anything outside `owned_paths` gets no commit at all — the task
   fails naming those paths, which is evidence to read, not ownership to widen.
5. Pass the complete planner output and other required scratch **as text** in the
   instructions. An ignored file path in the conductor's checkout does not exist
   in the worker's worktree. Pass reviewers only the small commit range, case IDs,
   relevant spec paths, and test command—not the author's plan or reasoning.
6. Worktrees separate checked-out files, not credentials, the Git object store,
   network access, or the OS. CLI permissions still apply; do not describe this
   arrangement as a security sandbox or grant bypass flags to avoid a blocker.

## Monitor and collect

1. Poll `check_worker_status(task_id)`; report meaningful progress to the human
   without a busy loop. A process exit or a commit is not proof of success.
2. Inspect exit status, logs/report, worker Git status, commits, changed paths, and
   verification evidence. Read the full report from the returned log location
   when a status tail is incomplete. Do not treat a truncated tail as a full plan.
3. Read-only planner/reviewer/adversary outputs are reports. Persist them in the
   conductor's scratch or the appropriate application report only when required;
   the worker itself must not write a mailbox, plan file, wiki page, or test residue.
4. A noninteractive human checkpoint is a **blocker**, not a request the worker can
   answer itself. Bring its evidence and recommendation to the human. Preserve
   the worker branch, logs, and dirty files. Do not claim success from exit code
   alone or invent an answer to keep a process running.
5. Use `kill_worker(task_id)` only for the selected task when cancellation is
   requested or needed. Cancellation preserves its worktree and local work; it
   does not authorize deleting files or treating partial commits as complete.

## Verify, integrate, and clean up

1. Wait for the worker to finish. Inspect its exact commit range and claimed
   test results. For write roles that is the one supervisor commit: read its diff
   and confirm it holds the test, the implementation, and the wiki change the
   task called for — a commit exists because the process exited zero, not because
   the work is right. Read-only roles must have no writes; a dirty review is
   invalid, not an excuse for an automatic restore.
2. Record the current integration HEAD and completed worker HEAD. Call
   `merge_and_cleanup_worker(task_id, expected_target_sha, expected_worker_sha)`
   only after approving that exact result for local integration. The expected
   SHAs prevent integrating a moving target; a mismatch means inspect again.
3. The server performs configured pre-merge validation and guarded integration.
   On validation failure, dirty worktree, conflict, or cleanup refusal, preserve
   the returned paths and diagnostics. Do not force-remove, reset, stash, abort,
   or prune merely to make the task look complete. Resolve with the human when
   intent is ambiguous; use `git-recovery` only as conductor with proper scope.
4. A clean read-only worker has no commits to merge; collect its full report
   before requesting normal cleanup. Keep runtime logs as the status evidence.
5. After a successful write integration, run the full application verification
   in the integration checkout. Then push the **integration branch** following
   the project's convention. Worker branches are local execution artifacts and
   are never pushed or opened as PRs by workers.
6. Dispatch a dependent task only after its prerequisite has been integrated.
   It then starts from the updated committed HEAD. Independent tasks can run
   concurrently, but integration is serialized and each merged result is tested.
7. MCP worker merges are local integration, not approval to merge a remote PR.
   The conductor may create the feature PR through `pr-create`; the human owns
   its final merge. No task cleanup grants permission to delete remote branches.

## Blank-template maintenance

Do not populate `docs/wiki/` or `docs/raw/` with template migration tasks,
requirements, logs, reports, ADRs, or transcripts. Keep evidence in tests, runtime
logs, and commit messages. The application procedures fill those scaffolds only
after initialization from real project facts.
