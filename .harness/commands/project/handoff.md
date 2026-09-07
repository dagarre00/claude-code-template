---
name: handoff
description: "Package scoped work as a self-contained execution brief for a later MCP worker. Inline the current canonical worker procedure and project evidence; orchestration, integration, and remote PRs remain with the conductor."
argument-hint: "[todo, entity, or scope — e.g. \"the login endpoint\" | \"batch the auth todos\"]"
---

# {{cmd:handoff}}

**Conductor only.** Follow `mcp-coordination` for any planner dispatch. A worker
must return its result or blocker, never invoke this command.

**Argument:** `{{arguments}}`

The argument selects the todo/entity/batch to package; empty input selects the
top eligible todo. No match means stop and name what you checked. Include the
user's original context verbatim and preserve constraints. This command creates
a brief, **not an implementation worker or PR**.

## Preconditions

- Initialized project facts, a todo mapped to an entity (or infrastructure
  concept), precise Behavior IDs, and a verified runnable application test command.
- A clean integration checkout. Follow the conductor-only guarded develop sync
  in `feature-branching/sync-develop.md` before packaging.
- No unresolved decisions that would force a worker to invent scope or behavior.
- During blank-template maintenance, do not manufacture facts or log entries.

## Steps

1. Match the selected scope against the todo queue, relevant wiki page, and
   committed history. Do not package already shipped work.
2. For complex/batched work, dispatch the read-only `planner` through MCP.
   Collect the complete returned plan and inspect it; do not rely on ignored
   scratch paths. Normal cleanup happens after report collection.
3. Follow `llm-handoff` to fill `TEMPLATE.md` from current canonical
   instructions and verbatim project evidence. Write only conductor-owned scratch
   at `.harness/handoff/<slug>-handoff.md`.
4. Verify every placeholder is resolved, required excerpts are inline, ownership
   is explicit, and no copied instruction tells the worker to branch, orchestrate,
   push, merge, open a PR, tag/reset/stash, or clean up.
5. Give the human the brief path and source commit. To execute later, the
   conductor verifies that source commit still matches the intended committed
   input, then passes the **file contents** as `spawn_worker` instructions with
   the selected role/engine and owned paths. Do not paste it as an unrestricted
   agent prompt in the integration checkout.
6. In an initialized application, record the packaging event in `docs/wiki/log.md`
   with scope, source SHA, and intended role; commit/push conductor-owned changes
   following project conventions. A log-only packaging commit need not invalidate
   the brief, but any changed spec, implementation, settings, or instructions does.
7. Report that execution has not started, what the brief covers, and which
   conductor checks are required before dispatch and integration.

## When the result returns

Follow `mcp-coordination` and `{{cmd:work}}` for commit subject and Red evidence,
scope and wiki checks, expected-SHA local integration, independent review where
required, full verification, integration push, and eventual feature PR. The
worker reports its output; it does not perform those conductor responsibilities.

## Failure handling

Missing or vague Behavior, a failing baseline test command, unresolved decisions,
stale source excerpts, or remaining placeholders block dispatch. Refine through
`{{cmd:interview}}` or regenerate the brief; never ask a headless worker to
guess. Preserve failed worktrees and reports instead of resetting them.
