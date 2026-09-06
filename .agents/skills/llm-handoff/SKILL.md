---
name: "llm-handoff"
description: "Build a self-contained execution brief for a later MCP worker, including canonical worker instructions, exact project evidence, ownership, and a prior plan. Use when packaging work for another CLI or model without transferring conductor responsibilities."
---

<!-- Generated from .harness/skills/llm-handoff/SKILL.md; DO NOT EDIT. Run node scripts/sync-harness.mjs. -->

# Package a worker brief

**Conductor only.** Produce `.harness/handoff/<slug>-handoff.md` for later
`spawn_worker` dispatch. Read `mcp-coordination` and the template beside this
skill. The brief delegates implementation, not branch creation, recursive
orchestration, remote actions, or integration.

## Read and select

1. Read the selected todo, its entity/concept Behavior cases, relevant
   requirements and architecture, gotchas, and verified application commands.
   No precise contract or runnable test command means stop; do not invent either.
2. Read current `.harness/worker-contract.md`, the selected canonical agent body,
   and the complete skills that role actually needs. For a developer, include
   `tdd-loop` and applicable wiki-update/spec-writing details. Inline essential
   linked procedures; do not leave a reference as a substitute for its content.
3. Capture the source HEAD and explicit owned paths. Include tests and wiki
   changes, or explicitly reserve shared ledgers for the conductor. Worktree and
   branch locations are allocated by MCP, not chosen by the worker.
4. For complex/batched work, use MCP to dispatch the read-only planner first.
   Collect its full report and pass it inline. Never pass a plan path in another
   checkout's ignored directory.

## Fill the template

Use `TEMPLATE.md` beside this file. Replace its uppercase placeholders with:

- Scope/title/date/source SHA and the original user context verbatim.
- Exact todo lines, Behavior IDs, full entity page, and relevant requirements,
  architecture, gotchas, and related decision/concept excerpts. Preserve the
  spec's wording rather than paraphrasing its behavior.
- Concrete test/install/lint/build commands where applicable, stating unavailable
  commands honestly. Never substitute template maintenance checks for app tests.
- Explicit owned paths, non-goals, dependencies, and the entire approved plan.
- Current canonical worker contract, role body, and relevant procedural skill
  bodies, copied **at packaging time**, not a separately maintained procedure.
  Remove frontmatter and resolve harness command tokens into plain descriptions
  when quoting procedures; a worker cannot invoke conductor commands.

Keep Markdown native: no outer code fence around the whole brief. Resolve
inlined wikilinks by including the relevant excerpt or explanatory file context.
Do not duplicate the entire wiki. The brief should contain enough context for
the bounded task and no author's rationale for an independent review role.

## Verify before handover

1. Search the completed brief for unresolved double-brace placeholders. Every
   template placeholder must be replaced; delete the template's author comment.
2. Read the completed brief as a fresh worker. It must make scope, ownership,
   test procedure, completion report, and blocker handling executable without
   an unavailable skill loader, vendor-specific tool, or another checkout's file.
3. Check copied procedures against the worker contract. Any conductor-only
   sections must be clearly excluded; the worker must never branch, spawn agents,
   push, merge, open PRs, tag/reset/stash, or clean up its worktree.
4. Tell the human the brief is **not running**. Later the conductor passes its
   entire text into `spawn_worker`, with the selected engine from canonical
   settings (or human-approved override). The server provisions the worktree.
5. Recheck source freshness before dispatch. If relevant specs, implementation,
   settings, or canonical instructions changed, regenerate the brief. Do not
   execute stale copied instructions merely because the scratch file exists.
6. For initialized applications, record the packaging event in the application
   log and commit/push conductor-owned changes. Blank template maintenance does
   not populate application data.

## Collect and integrate

The worker returns full results, per-case SHAs, Red/Green evidence, changed
paths, and remaining blockers. Follow `mcp-coordination` to inspect, integrate
with expected target/worker SHAs, and verify. Follow `project-work` for required
independent review and the feature PR; the worker does neither itself.

Do not remove a failed worktree, discard partial work, or infer completion from
exit code alone. Local commits are not a remote backup. The conductor owns the
integration push and the human owns the remote PR merge.
