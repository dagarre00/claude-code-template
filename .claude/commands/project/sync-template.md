---
description: Pull the generic workflow — roles, skills, commands and rules under .claude/ — from a template checkout into this adopting project, leaving project-owned files alone. Run in an adopting project, never in the template. Use when the template has fixes this project lacks, or a cycle here rediscovers a bug already fixed upstream.
argument-hint: '[template source — e.g. "../claude-code-template" | "skills only" | empty to reuse the last one from the log]'
disable-model-invocation: true
---

# /project:sync-template

**Argument:** `$ARGUMENTS`

The argument names the **template source path** and optional **scope filter** (`skills only`, `roles only`). Empty → reuse the source path from the last sync's `Source:` line:

```bash
grep -h '^- Source: ' docs/wiki/summaries/log-archive-*.md docs/wiki/log.md 2>/dev/null | tail -1
```

If no prior `Source:` line exists and none was given, ask via `human-checkpoint`.

## State at invocation

Branch: !`git branch --show-current`

```!
git status --short
```

One-directional pull of generic `.claude/` workflow files from a template checkout into an adopting project.

## Preconditions

- **Not the template itself:** `# Project` fields in `CLAUDE.md` are populated and `<source>` is a different checkout containing `.claude/agents/` and `.claude/rules/workflow.md`.
- On `develop` or the active branch mid-cycle (rule 19).
- Clean working tree, with all lines accounted for (rule 21).

Any failure → `human-checkpoint`.

## What is generic and what is yours

| Path | Action | Why |
| --- | --- | --- |
| `.claude/skills/**` | **Copy**, subject to step 4 | Generic workflow procedures. |
| `.claude/agents/*.md` | **Copy**, subject to step 4 | Roles (`model`, `effort`, and `skills:` may have local edits from `/project:init`). |
| `.claude/commands/project/*.md` | **Copy**, subject to step 4 | Slash commands. |
| `.claude/rules/behavioral.md`, `.claude/rules/workflow.md` | **Copy**, subject to step 4 | Shared rules and workflow map. |
| `.claude/settings.json`, `.claude/settings.local.json` | **Never copy** — report missing allow/plugin entries in step 7 | Project-specific permissions. |
| `CLAUDE.md`, `.gitignore`, `.gitattributes`, `docs/**`, source, tests | **Never copy** — report missing `.gitignore`/`.gitattributes` lines in step 7 | Project-owned files. |
| Files under `.claude/` existing only in this project | **Keep and report** (step 7) | Project-added roles, skills, or rules. |

## Steps

1. **Resolve and pin `<source>`:** record `git -C <source> rev-parse --short HEAD` and `git -C <source> branch --show-current` (warn if `<source>` is behind its remote).
2. **Refuse self-sync** if `<source>` resolves to this checkout.
3. **Classify before copying:** run `diff -rq --strip-trailing-cr` across the **Copy** rows and count files that differ, exist only upstream, or exist only locally.
4. **Checkpoint customizations:** for each differing file, compare the local file against the template at the previous sync's `<sha>` (`git -C <source> show <sha>:<path> | diff --strip-trailing-cr - <path>`). If unchanged locally since `<sha>`, it is *stale* and safe to overwrite. If modified locally (or `<sha>` is unknown), treat it as *customized* and ask via `human-checkpoint` with the diff before overwriting (for role files where only `model`, `effort`, or `skills:` changed, offer to take the upstream file and re-apply those frontmatter lines).
5. **Copy (never delete):** write the approved files for the selected rows. Never delete local-only files.
6. **Validate before committing:** parse the YAML frontmatter of every changed `.claude/` file and verify every skill in each role's `skills:` list exists under `.claude/skills/`. Stop on any error.
7. **Report what was left behind and missing project setup:** list local-only files, kept customizations, and any missing `.claude/settings.json` allow/plugin entries, `.gitignore`/`.gitattributes` lines, or `architecture.md § Layers` setup (recommend `/project:init` steps 0 or 5a–5c). Remind the human to restart Claude Code if `.claude/agents/` changed.
8. **Log, commit and push** per [`log-and-commit.md`](../../skills/feature-branching/log-and-commit.md) — kind `chore`, subject `chore(workflow): sync <scope> from the template`, fields `Source: <path> @ <sha>`, `Changed: <N> files`, `Kept local: <list or none>`.

## Failure modes

- **Customized file overwritten without step 4 check** → recover via `git diff HEAD~1`.
- **Updated roles not active** → restart the Claude Code session.

## What you do NOT do

- **No writes to the template checkout.**
- **No overwriting `.claude/settings.json` or `CLAUDE.md`.**
- **No deleting local-only `.claude/` files** and **no wiki edits.**
