---
name: update-toolkit
description: Conductor-only meta skill. How to add, modify or retire a role, skill, slash command, or behavioral rule as the project grows. Use when the workflow needs a new procedure, entry point, or specialist role, or when one drifts or goes unused.
user-invocable: false
---

# Updating the Toolkit

## Decide which artifact first

- **Skill** — a procedure loaded by task content ("when X, do these steps"). Default choice for domain knowledge.
- **Command** — a human-invoked `/project:*` entry point orchestrating branches, dispatches, and wiki updates. Keep thin; put procedures in skills.
- **Role** — a subagent with a distinct context scope or conflicting invariants ("never write code" vs "always write code"). **Default to no**; never create domain roles ("backend agent").
- **Rule** — a universal session invariant added as the next number in `.claude/rules/behavioral.md` (never renumber). Project-specific traps go in `docs/wiki/gotchas.md`.
- **Wiki page** — facts about the system (`docs/wiki/concepts/`).

Read 2–3 existing files of the target kind first to match tone and structure. Keep bodies concise: every line is paid for on load. Commit each add/modify/retire with a `chore` log entry per [`log-and-commit.md`](../feature-branching/log-and-commit.md) (rule 19) and push.

## Skills

**Add:**
1. Create `.claude/skills/<name>/SKILL.md` (directory per skill; supporting templates sit beside `SKILL.md`).
2. Frontmatter: `name` (kebab-case), a specific `description` starting with `Conductor-only.` or `Subagent-side, preloaded into <role>.` (or `Subagent-side, loaded on demand by <role>.`) followed by what it does and trigger phrases, and `user-invocable: false`. Never set `disable-model-invocation: true` on a preloaded skill.
3. Body = procedure (rule 14): when it fires → **Read first** → numbered **Steps** → wiki updates → project-specific **Anti-patterns**. Omit textbook explanations and historical rationale.
4. **Scope discipline:** A skill preloaded into or invoked by a subagent must obey that role's constraints (no git commits, no direct edits to `todos.md`/`wiki-todos.md`/`log.md` → use `Follow-ups:`). Split procedures with both subagent and conductor steps into two skills (e.g. `adversarial-review` / `finding-disposition`).
5. **Attach to a role:** Preload in `skills:` only if needed on almost every dispatch of that role; if needed only occasionally by `developer`, leave it off `skills:` so `developer` loads it on demand via the `Skill` tool. Two roles never share a procedure skill (only `subagent-contract` is shared).
6. List in `.claude/rules/workflow.md § Skills` and commit `feat: add <name> skill — <reason>`.

**Modify:** Update `description` if triggers change; verify cited wiki pages exist. Commit `refactor: <name> skill — <reason>`.
**Retire:** Grep `.claude/` and `docs/wiki/` (including role `skills:` lists), delete the directory, commit `chore: retire <name> skill`.

Always re-read frontmatter after editing and quote values containing `: ` or ` #` or starting with `[`, `{`, or quotes.

## Commands

**Add:**
1. Create `.claude/commands/project/<name>.md` (served as `/project:<name>`).
2. Frontmatter: one-line `description`, quoted `argument-hint` (`'[scope — e.g. "the auth module"]'`), and `disable-model-invocation: true`.
3. Under H1, write `**Argument:** \`$ARGUMENTS\`` and specify what it overrides, its shapes, what empty means, and what it cannot bypass (preconditions, Red, human checkpoints). Wire `$ARGUMENTS` into the consuming step.
4. Body: **Preconditions** → numbered **Steps** → **Failure modes** → wiki updates → human checkpoints. Keep `!`backtick`` live-state injections fast and read-only.
5. Add to `.claude/rules/workflow.md § Commands`, update `docs/wiki/commands.md` if applicable, and commit `feat: add /project:<name> — <reason>`.

**Modify:** Keep `argument-hint`, `**Argument:**`, and consuming steps in sync. Commit `refactor: /project:<name> — <reason>`.
**Retire:** Grep `.claude/`, delete file, remove from `workflow.md`, commit `chore: retire /project:<name>`.

## Roles

**Add:**
1. Create `.claude/agents/<name>.md`.
2. Frontmatter:
   - `name` and `description` naming the command step that dispatches it.
   - `model` (`opus` for high-leverage reasoning; `sonnet` for per-cycle execution) and `effort` (`medium`, `high`, or `xhigh`).
   - `tools`: explicit list (read-only roles get `Read, Grep, Glob, Bash, PowerShell`; never grant `Agent`).
   - `permissionMode`: `dontAsk` for read-only roles or roles bounded by `.claude/settings.json` path allowlists (`Edit(/docs/wiki/**)`, `Edit(/docs/raw/research/**)`); `acceptEdits` for source writers.
   - `skills`: `subagent-contract` first, then role-specific preloads.
   - `maxTurns` and a unique `color`. Omit `memory` and `isolation: worktree`.
3. Body: role statement → **Entry checklist** → procedure → **Report** format → **What you do NOT do**.
4. Add to `.claude/rules/workflow.md § Roles`, wire into the dispatching command, and restart Claude Code to load. Commit `feat: add <name> role`.

**Modify:** Follow `subagent-dispatch § Changing a role's model or effort` for model/effort changes. Commit `refactor: <name> role — <reason>`.
**Retire:** Confirm no command dispatches it, delete file, remove from `workflow.md`, commit `chore: retire <name> role`.

## Anti-patterns

- **What-is textbook prose** instead of project procedure.
- **Generic descriptions** that route on unrelated tasks.
- **Duplicate procedures** across skills or roles.
- **Granting Edit tools to read-only roles.**
