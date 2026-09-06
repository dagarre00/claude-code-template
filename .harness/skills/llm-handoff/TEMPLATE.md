<!--
Template for the conductor. Replace every uppercase placeholder from current
canonical sources and exact project evidence, then delete this comment.
Do not copy this template directly into a worker without filling it.
-->

# Worker brief: {{SLUG}} — {{TITLE}}

Prepared: {{DATE}}
Source commit: {{SOURCE_SHA}}
Role: {{ROLE}}

## Execution boundary

The coordination MCP server assigns your worktree and branch. Run only there.
The conductor has already selected the task and handles dispatch, monitoring,
integration, remote pushes, and PRs. Do not recursively delegate or run project
commands. If this prompt is not running in its assigned isolated worker context,
stop and ask the conductor to dispatch it correctly.

Return a blocker when a human decision or unavailable capability prevents safe
progress. Do not interpret a headless session or silence as approval.

## Original user context

{{USER_CONTEXT}}

## Task and ownership

### Selected todo lines

{{TODO_LINES}}

### Behavior cases

{{CASE_IDS}}

### Owned repository-relative paths

{{OWNED_PATHS}}

### Out of scope

{{OUT_OF_SCOPE}}

### Dependencies already integrated

{{DEPENDENCIES}}

## Project evidence

### Entity/concept spec — verbatim

{{ENTITY_PAGE_VERBATIM}}

### Requirements — relevant exact excerpts

{{REQUIREMENTS_EXCERPT}}

### Architecture — relevant exact excerpts

{{ARCHITECTURE_EXCERPT}}

### Gotchas and related wiki evidence

{{RELATED_WIKI_EXCERPTS}}

### Verified commands

{{COMMANDS_VERBATIM}}

## Implementation plan

{{PLAN_SECTION}}

## Current canonical worker contract

{{WORKER_CONTRACT_VERBATIM}}

## Current canonical role instructions

{{ROLE_BODY_VERBATIM}}

## Required procedures — current canonical excerpts

{{PROCEDURES_VERBATIM}}

## Completion report

Return the complete report to the conductor, not only a path:

- Completed Behavior IDs and any remaining scope.
- Per-case local commit SHAs and explicitly changed paths.
- Red/Green commands, observed failure reasons, and final verification results.
- Plan deviations, dependencies, uncertainty, and any unavailable verification.
- Any dirty or untracked residue and blockers needing human direction.
- Exact conductor-owned wiki/log updates needed, when excluded from your scope.

Read-only report roles produce no commits or file changes. Writing roles commit
verified work locally with explicit path staging. Never push, open a PR, merge,
switch branches, tag/reset/stash, or clean up the worktree.
