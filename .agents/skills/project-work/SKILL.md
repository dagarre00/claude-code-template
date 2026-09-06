---
name: "project-work"
description: "Conductor-only TDD workflow. Select scoped work, create an integration feature branch, dispatch isolated MCP planner/developer/adversary workers, verify and integrate local commits, then push and open the completed feature PR."
---

<!-- Generated from .harness/commands/project/work.md; DO NOT EDIT. Run node scripts/sync-harness.mjs. -->

# project-work

**Argument:** `user-provided context following this skill invocation (empty if omitted)`

**Conductor only.** Follow `mcp-coordination` for every dispatch, monitor,
cancellation, and worker merge. Workers must return results, not invoke this
command. If MCP is missing, report the blocker rather than using native delegation.

The argument selects a todo/entity or batch instead of the top todo. Match it
against `docs/wiki/todos.md` and entity slugs; no match means stop and name what
you checked. Carry constraints and original context verbatim into the worker's
instructions. Empty input takes the top eligible todo. A scope argument does not
bypass the spec, Red, ownership, permissions, or human checkpoints.

You conduct the cycle; one developer owns tests and implementation. You inspect
and integrate worker results, preserve per-case commits, and own remote pushes
and PR creation. Workers never push or open PRs.

## Preconditions and resume

- Inspect `list_workers()`, Git status, branch, and any prior task records before
  starting. Reconnect to known tasks; never duplicate a running or preserved task.
- The integration checkout is clean and on the intended branch. Account for every
  dirty path. Do not stash, discard, or reset user work. A worker starts from
  committed HEAD; dirty integration content cannot be dispatched implicitly.
- An initialized wiki supplies a real todo, precise Behavior cases, and a runnable
  application test command. Run the command once; pre-existing failure or a
  placeholder means stop and recommend `project-init` or `project-interview`.
- Blank-template maintenance never invents application requirements, todos,
  entities, ADRs, or logs just to satisfy these preconditions.
- On an active feature branch, resume its unfinished scope. All cases ticked and
  pushed does not mean its remote PR was merged. Confirm actual merge status
  before returning to develop or deleting that feature branch.
- An interrupted worker may have local commits or dirty files even after its CLI
  exited. Preserve them and inspect the task report; do not spawn a replacement
  assuming uncommitted work will transfer. Escalate recovery when necessary.

## Steps

1. **Select the work and contract.**
   - Fetch remote develop when a remote exists; check the candidate has not
     already shipped. Follow `feature-branching` for guarded synchronization.
   - Skip `[wiki]` lines; they belong to `project-wiki-lint`.
   - The target must name an entity page with precise Behavior cases. An
     `[infra]` todo may instead name a concept page with verifiable operational
     Behavior assertions; infrastructure still needs failing tests.
   - Propose a batch only for related, coherent work. Non-obvious batching goes
     to the human. Complex or two-or-more-todo batches require a planner.
   - If the argument skips P0 work, count open P0 entries against `P0_MAX`
     in `docs/wiki/todos.md`. At saturation, ask before skipping that queue.

2. **Prepare the integration branch.** Follow `feature-branching` to create or
   resume `feat/<slug>` (or the appropriate fix/chore type) from develop. Only
   the conductor does this. A diverged branch or failed fast-forward means stop,
   never rebase or force-push. A repository without a remote stays local; say so.
   Commit any authorized source/spec changes before spawning a worker.

3. **Confirm verification and ownership.** Name the Behavior case IDs, the exact
   application test command, and the files/directories each writing task owns:
   implementation, tests, entity updates, and any shared ledgers. Do not split
   test writing from implementation. Parallelize only independent work with
   disjoint ownership; if both tasks need `todos.md`, `log.md`, or an interface,
   serialize them or assign those shared updates to the conductor. Commit shared
   interface decisions before dependents start.

4. **Plan complex/batched work.** Through `spawn_worker`, dispatch `planner`
   with the original user context, entity/infra pages, case IDs, batch contents,
   and test command. Poll to completion and collect its **complete returned
   plan**, including owned paths and dependencies. It creates no files.
   Sanity-check coverage and scope; request one corrected plan if needed, then
   checkpoint if the plan still fails. Persist scratch only in the conductor's
   checkout if useful. Collect the report before normal read-only cleanup.
   Skip this step for one simple todo.

5. **Dispatch the developer.** Call `spawn_worker` with role `developer`,
   bounded instructions and explicit `owned_paths`. Include the user's original
   context, exact Behavior IDs, test command, applicable constraints, and the
   **full plan text** if one exists—not a path in your ignored scratch directory.
   The developer runs Red → Green → Refactor → wiki update → local commit for
   each case, then returns SHAs, verification evidence, changed paths, and
   remaining work. No worker push, branch change, recursive dispatch, or cleanup.

6. **Verify and integrate the completed worker.** Inspect status, report, diff,
   local commits, and ownership. Confirm that Red failed for the claimed reason,
   Green passed, and commits are per-case. An exit code alone proves none of this.
   A blocker or dirty/failed task is preserved, not silently merged.
   Follow `mcp-coordination`: record exact target/worker HEADs, call
   `merge_and_cleanup_worker` with both expected SHAs, then run the full suite
   on the integrated tree. Inspect failed validation or merge conflicts before
   proceeding. Never force-remove a refused worktree.
   For dependent tasks, integrate the prerequisite first and then dispatch from
   the updated committed HEAD. Local integration does not merge the remote PR.

7. **Check wiki consistency.** Confirm implemented cases are `[x]`, the
   Implementation and Tests sections match files, and only completed todo scope
   is removed. Make conductor-owned ledger updates explicitly; workers cannot
   write a ledger excluded from their scope. Do not delete unfinished todo parts.

7a. **Independent adversarial review for complex/batched cycles.** If step 4 ran,
   follow `adversarial-review` using a fresh MCP `adversary` on the integrated
   commit range. Review one case or a few tightly related cases at a time.
   Pass only range, relevant spec paths/case IDs, and test command—never the plan,
   author reasoning, or transcript. Collect the complete returned findings;
   the conductor writes the mailbox.
   The developer can recommend dispositions in a bounded report-only task.
   The conductor owns human checkpoints, queue entries, and the round-closing
   disposition commit. Approved code fixes go through a new scoped developer
   worker, TDD, and local MCP integration. Re-review only fix commits, at most
   once. Filed findings remain visible work, not an implicit success claim.
   Skip this step for one simple todo unless the human requests it.

8. **Record the application cycle.** Append the log entry with todo scope,
   Behavior IDs, integration branch, worker task IDs/SHAs, verification, and
   adversary counts if applicable. Per-finding dispositions live in the round
   commit body, not only a count. During blank-template maintenance, skip wiki
   population and record evidence in tests and commit messages instead.

9. **Commit and push integration work.** Worker case commits are already
   preserved by local integration. Commit only remaining conductor-owned updates,
   with explicit path staging. Push the integration branch following the
   project's convention; workers never push their task branches. Report a missing
   remote or bounded retry failure with exact local-only SHAs. Keep reports until
   verification and durable disposition recording are complete; remove only
   conductor-owned scratch files whose purpose is finished.

10. **Check feature completion.** Re-read the entity Behavior section. If any
    cases remain open, report remaining work without opening a completion PR.
    If all are complete, proceed to step 11.

11. **Open the feature PR.** Follow `pr-create`, targeting develop (or the
    explicitly established stacked base). Use an available GitHub integration or
    `gh pr create`; if unavailable, provide the drafted body and pushed branch.
    Log and commit the PR reference for initialized applications. The human owns
    merging this remote PR; do not confuse this with MCP's local worker merges.
    Return to develop only when the integration checkout is clean and no active
    worker is pinned to that integration branch.

12. **Report and surface maintenance cadence.** Summarize completed scope,
    verification, task/integration status, remote PR, and next work. Lead with
    unresolved critical/major findings, retained dirty worktrees, or failed pushes.
    Recommend—but never auto-run—periodic `project-review` after about five
    work cycles, or `project-wiki-lint` after five cycles, ten queued wiki items,
    or `FINDINGS_MAX` saturation. Count each cadence from its own last log entry.
    Recommend `project-agent-scout` when stack additions or repeated improvised
    procedures expose a toolkit gap. The wiki-maintainer remains manual only.

## Failure handling

- Missing CLI/model/authentication or quota: report the actual engine failure.
  Do not silently switch provider or bypass permissions.
- Worker checkpoint: return the specific decision to the human, retaining task
  state. No autonomous worker can approve a reset or change application scope.
- A second failure on one mechanism: preserve both attempts and invoke
  `human-checkpoint`. Never reset/tag inside a worker or retry indefinitely.
- Read-only worker writes: invalidate that review and preserve the evidence.
  Never restore the tree merely to hide the violation.
- Merge conflict, dirty target, moved SHA, or rejected ownership: inspect and
  resolve through the conductor; preserve work until authorization is clear.
- Lost session: task records and local branches may still exist. Local work is
  not a remote backup. Inspect `list_workers()` and the actual Git history;
  do not claim `git ls-remote` provides a remote reflog.
