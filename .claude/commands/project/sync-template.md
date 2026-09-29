---
description: Pull the generic workflow — roles, skills, commands and rules under .claude/ — from a template checkout into this adopting project, leaving project-owned files alone. Run in an adopting project, never in the template. Use when the template has fixes this project lacks, or a cycle here rediscovers a bug already fixed upstream.
argument-hint: '[template source — e.g. "../claude-code-template" | "skills only" | empty to reuse the last one from the log]'
disable-model-invocation: true
---

# /project:sync-template

**Argument:** `$ARGUMENTS`

The argument names **where the template is and how much to take**. A path sets the source for this run. A narrowing phrase (`skills only`, `roles only`) limits step 5 to those rows of the table. Both may appear together. Empty → the source from the last `sync-template` entry in `docs/wiki/log.md`, taking everything generic; with no such entry, ask via `human-checkpoint` rather than guess a path. Nothing bypasses the overwrite checkpoint (step 4) or the validation (step 6).

## State at invocation

Branch: !`git branch --show-current`

```!
git status --short
```

A one-directional pull: generic files are copied from the template, and nothing is ever written back. Use it when the template has fixes this project lacks, when a finding here turns out to be fixed upstream, or before a large piece of work.

## Preconditions

- **This is not the template:** the `# Project` fields in `CLAUDE.md` have been filled in, and the source is not this checkout. Syncing a template into itself corrupts both sides of the comparison.
- On `develop`, or the active branch mid-cycle (rule 19 — the workflow is living operations).
- A clean tree, **and clean because you left it so**: every line of the state block accounted for (rule 21).
- The source is a real checkout of the Claude Code template: it has `.claude/agents/` and `.claude/rules/workflow.md`.

Any failure → `human-checkpoint`.

## What is generic and what is yours

This table is the whole decision; getting it wrong either drops the project's configuration or leaves the lag in place.

| Path | Action | Why |
| --- | --- | --- |
| `.claude/skills/**` | **Copy**, subject to step 4 | Procedures — usually identical, occasionally diverged on purpose. |
| `.claude/agents/*.md` | **Copy**, subject to step 4 | The roles. Their `model`, `effort` and `skills:` lines are the likeliest local changes (`/project:init` steps 0a and 5), so expect step 4 to stop on them. |
| `.claude/commands/project/*.md` | **Copy**, subject to step 4 | The entry points. |
| `.claude/rules/behavioral.md`, `.claude/rules/workflow.md` | **Copy**, subject to step 4 | Shared discipline and the workflow map. |
| `.claude/settings.json`, `.claude/settings.local.json` | **Never** — step 7 reports template allow rules missing here | This project's permissions, including its allowlisted commands. |
| `CLAUDE.md` | **Never** | This project's identity. |
| `.gitignore`, `.gitattributes` | **Never** — step 7 reports template lines missing here | Project files the workflow relies on. |
| `docs/**`, source, tests | **Never** | Yours. |
| Files under `.claude/` that exist only here | **Leave, and report** (step 7) | A project may add its own roles, skills and rules; never delete to make the trees match. |

## Steps

1. **Resolve and pin the source.** Record its SHA and branch (`git -C <source> rev-parse --short HEAD`, `git -C <source> branch --show-current`) — the SHA goes in the log entry and is what lets the next run say how far behind this project was. Say so if the source is behind its own remote: a stale checkout syncs old text that looks new.
2. **Refuse to sync into itself.** Same path as this checkout → stop.
3. **Classify before copying.** Diff the trees over the **Copy** rows with `diff -rq --strip-trailing-cr` — a Windows checkout is CRLF, and a plain diff flags files that are identical: files that differ, files only upstream, files only here. Report the counts.
4. **Checkpoint customization.** For each file that differs, compare the project's copy with the template at the SHA the last `sync-template` log entry recorded: `git -C <source> show <sha>:<path> | diff --strip-trailing-cr - <path>`. No difference → the project never changed it: *stale*, safe to overwrite. A difference → *customized*, as is a path absent at that SHA or a SHA the source cannot resolve — nothing proves otherwise. Anything you cannot confidently call stale goes to the human via `human-checkpoint`, with its diff, before it is overwritten; for a role whose only local change is its `model`, `effort` or `skills:` lines, offer to take the template's file and re-apply those lines. An empty argument is not consent — this step still runs.
5. **Copy, never delete.** Write the classified files (a narrowing argument → those rows alone). A file only here is never deleted.
6. **Validate before committing.** Read the frontmatter of every changed file: it must parse as YAML — a skill or command whose frontmatter fails loads with no fields set (a command then loses `disable-model-invocation`), and a role needs its `name` and `description` to load at all. `claude plugin validate` is lenient and has passed malformed YAML, so it is not enough on its own. Every name in a role's `skills:` list exists under `.claude/skills/`. A failure is **blocking**: report the file and the error, and stop.
7. **Report what was left behind:** files only here, and generic files kept customized in step 4 — the reasons the next sync will show drift again. Then name the **project-side setup the new version expects but this project lacks**, since project files are never synced: allow rules in the template's `.claude/settings.json` missing from this one, `.gitignore` or `.gitattributes` lines the template has and this project lacks, the test or architecture command missing from the allowlist, no `## Layers` in `docs/wiki/architecture.md`. Recommend them — `/project:init` steps 5a–5c cover most — don't do them here. Changed roles load only in a new session: tell the human to restart Claude Code.
8. **Log, commit and push** per [`log-and-commit.md`](../../skills/feature-branching/log-and-commit.md) — kind `chore`, subject `chore(workflow): sync <scope> from the template`, fields `Source: <path> @ <sha>`, `Changed: <N> files`, `Kept local: <list or none>`.

## Failure modes

- **A customized file silently overwritten** — the expensive one; it surfaces later as "the workflow stopped doing what we set it up to do". Step 4 is the guard; `git diff HEAD~1` on this commit is the recovery.
- **The old roles still answering** — the session loaded them before the copy. Nothing is wrong on disk; restart the session.

## What you do NOT do

- **No writes to the template.** A fix it needs is made there.
- **No `.claude/settings.json` or `CLAUDE.md`** — not even the parts that look generic.
- **No deletions to make the trees match.** Report the extras; the human decides.
- **No wiki work** — drift between this project's wiki and code is `/project:review` and `/project:wiki`.
