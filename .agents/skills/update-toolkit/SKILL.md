---
name: "update-toolkit"
description: "Add, change, or retire canonical commands, skills, and agent roles, then regenerate Claude Code, Codex, and Antigravity CLI adapters. Use whenever the project workflow or agent toolkit changes."
---

<!-- Generated from .harness/skills/update-toolkit/SKILL.md; DO NOT EDIT. Run node scripts/sync-harness.mjs. -->

# Update the toolkit

Author under `.harness/`; the generator delivers native formats. Read
`docs/harnesses.md`, the existing artifact, and two similar canonical artifacts.
Do not edit generated files, even when a harness opens its discovered copy.

If running as an MCP worker, first read `.harness/worker-contract.md`. Toolkit
writes and regenerated outputs must be in your owned scope. Commit locally and
return the result; do not execute conductor-only commands, push, or integrate.

## Choose the artifact

- Procedure loaded on demand: `.harness/skills/<name>/SKILL.md`.
- Human-invoked orchestration: `.harness/commands/project/<name>.md`.
- A role requiring distinct context or conflicting invariants: `.harness/agents/<name>.md`.
- Shared session instructions: `.harness/instructions.md`; project facts:
  `.harness/project.md`; binding constraints: `.harness/rules/behavioral.md`.
- Worker runtime contract: `.harness/worker-contract.md`; orchestration procedure:
  `.harness/skills/mcp-coordination/SKILL.md`.
- Engine/profile settings and per-role overrides: `.harness/settings.json`.
- Knowledge about the application: a wiki page, using `wiki-update`.

Prefer a skill for domain knowledge. Keep one developer responsible for the TDD
cycle. Do not add domain agents that duplicate that responsibility.

## Add or modify a skill

1. Use lowercase kebab-case `name` matching the directory and a precise
   `description`. Metadata is one scalar per line; quote descriptions using JSON
   string syntax (valid YAML). No multiline YAML values, nested fields, or `type`.
2. Write a procedure: entry reads → executable steps → wiki updates →
   project-specific pitfalls. Do not explain general concepts.
3. Place templates, scripts, and other resources beside `SKILL.md`. Scripts and
   binary resources are copied byte-for-byte; Markdown is rendered per harness.
   Prefer paths rooted at the repository in prose. Relative Markdown links resolve
   from the canonical source and are rebased by the generator.
4. Follow the verification and commit procedure below. Reserve names beginning
   `project-` for generated command skills; do not create colliding names.

## Add or modify a command

1. Copy `.harness/templates/command.md.tmpl` to
   `.harness/commands/project/<name>.md`. Fill `name`, `description`, and
   `argument-hint` with single-line values. The filename must match `name`.
2. Preserve the canonical argument token shown in the template. Specify what the
   argument selects, its empty-input behavior, and which steps consume it. Forward
   the user's context verbatim to subagents. Never insert it into shell code.
3. For cross-command references, copy the canonical command-token syntax from
   `.harness/commands/project/work.md` with the referenced command's name.
   Do not hard-code a harness invocation in portable procedures.
4. Keep commands conductor-only. Delegate through the coordination MCP tools and
   `mcp-coordination`; never add native subagent dispatch or shell-spawn fallbacks.
   State preconditions, orchestration steps, failure handling, and outputs.
   Heavy procedures belong in skills. The generator builds the native command
   catalog automatically from the canonical files; no hand-maintained root table.
5. Follow the verification and commit procedure below.

## Add or modify an agent

1. Add `.harness/agents/<name>.md` with single-line `name`, `description`,
   `profile` (`reasoning`, `balanced`, or `fast`), and `access`
   (`read-only` or `write`). The filename must match `name`.
2. Body: role → entry reads → procedure → output contract → prohibited actions.
   Read-only agents return their output to the caller, which persists it; do not
   grant write tools merely to create a mailbox or report.
3. Keep provider model names and native tool names out of the role body.
   Configure them once in `.harness/settings.json`: engine profile mappings in
   `engines[engine].models` / `effort`, role overrides in `roles[role]`. The
   default engine inherits the conductor CLI. Native generated roles and MCP
   dispatch consume this same configuration; do not maintain parallel settings.
   Check official docs and runtime/native discovery when changing mappings.
4. Do not claim hard isolation from prompt instructions alone. Codex read-only
   agents receive a read-only sandbox default; parent policy can override it.
   Claude/Antigravity read-only tool lists include shell access for git inspection;
   their instruction and permission rules must still prohibit shell writes.
5. Apply `.harness/worker-contract.md` to every role. Planners and review roles
   return full reports without writes; writing roles commit scoped output locally.
   No worker dispatches, pushes, opens PRs, or cleans up a worktree.
   Check role descriptions for overlapping routing. Regeneration emits the catalog
   and all native role definitions.

## Retire an artifact

Search canonical sources and documentation for references. Remove or update those
references and remove only the canonical artifact. Run synchronization: it deletes
only formerly generated files recorded in its manifest, preserving unrelated files.
If an output has manual edits, first reconcile them into the source. Never delete a
whole generated directory to retire one asset.

## Verify and commit

1. Run `node scripts/sync-harness.mjs`. It validates all inputs before writing.
   A manual-edit conflict means preserve the edited output, merge the intended
   change into its canonical source, and regenerate. Use `--force` only when the
   managed output's current contents are already preserved or deliberately disposable.
2. Run `node scripts/sync-harness.mjs --check` and
   `node --test tests/harness.test.mjs`. Inspect every failure. Check the rendered
   instruction and actual native discovery for changed harness interfaces.
3. Stage the changed canonical paths, `.harness/generated.json`, and all changed
   native outputs (`AGENTS.md`, `CLAUDE.md`, `.claude/commands/`,
   `.claude/skills/`, `.claude/agents/`, `.agents/skills/`, `.agents/agents/`,
   `.codex/agents/`). Stage paths deliberately; preserve unrelated user settings.
4. In an initialized application, include required wiki updates and log entry in
   the same commit. While maintaining this blank template, preserve the wiki/raw
   scaffolds and record validation in the commit message instead.
5. Commit with the project's conventional format. Workers commit locally and
   return SHAs; the conductor integrates through MCP and pushes the integration
   branch according to project conventions.
