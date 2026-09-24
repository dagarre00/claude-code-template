---
name: update-toolkit
description: Conductor-only meta skill. How to add, modify or retire a role, a skill or a slash command as the project grows. Use when the workflow needs a new procedure, entry point or specialist role, when one drifts, or when one goes unused. Trigger on "new agent", "add agent", "modify agent", "agent role", "new skill", "add skill", "modify skill", "skill drift", "missing how-to", "new command", "add command", "slash command", "modify command".
type: skill
---

# Updating the Toolkit

## Decide which artifact first

- **Skill** — a procedure, loaded by task content: "when X, do these steps". Almost always the answer for new domain knowledge ("the developer needs to know databases" is a skill).
- **Command** — a named entry point the human types, orchestrating branches, dispatches and wiki updates. Thin: heavy lifting lives in roles and skills.
- **Role** — a distinct context scope (fresh-context audit vs in-loop implementation) or invariants that conflict with an existing role ("never write code" vs "always write code"). **Default to no.** No domain roles ("backend agent").
- **Wiki page**, not this skill — facts about the system (`docs/wiki/concepts/`).

Read 2–3 existing files of the kind first and match their tone, length and structure. Every paragraph is paid for on every load — a role on every dispatch, a command on every run — so keep bodies short, and lift any procedure a command *teaches* into a skill.

## Skills

**Add:**
1. `.agents/skills/<name>/SKILL.md` — a directory per skill. A flat `.agents/skills/<name>.md` or a grouping subfolder is **silently ignored**. Supporting files (templates) sit beside `SKILL.md`; workers see them listed, never inlined.
2. Frontmatter `name` (kebab-case), `type: skill`, and a precise `description` — it is the loading trigger. Bad: "skill for backend". Good: "Use when adding an HTTP endpoint. Trigger on 'add endpoint', 'new route', 'API handler'." Could a real task contain those words? If not, rewrite it.
3. Body = procedure (rule 14): a line on when it fires → **Read first** → numbered **Steps** → the wiki pages to update → this project's **Anti-patterns**. If a paragraph could appear in a textbook, delete it. Rationale ("measured on…", "this exists because…") goes in the log entry or an ADR, not the body.
4. **Who reads it?** A skill a command declares for a role is inlined into that worker's prompt, so it must be obeyable there: no skill the role isn't sent, no repo-changing git command, no path outside its worktree (`.handoff/`), no writes to the conductor's queues (`todos.md`, `wiki-todos.md`, `log.md` → `Follow-ups:`). `tools/workflow-mcp/test/canonical.test.mjs` catches the first three. A procedure with a worker half and a conductor half is two skills (`adversarial-review` / `finding-disposition`). Mark a conductor-only skill so in its `description`.
5. A wiki page it cites that doesn't exist → a `wiki-todos.md` line. Commit `feat: add <name> skill — <reason>`.

**Modify:** read it whole; change `description` first if the trigger changes; confirm the pages it cites exist. `refactor: <name> skill — <reason>`.
**Retire:** grep `.agents/` and `docs/wiki/` for references, delete the directory, log it, `chore: retire <name> skill`.

## Commands

**Add:**
1. `.agents/commands/<name>.md`, flat. The `project` plugin (`.agents/.claude-plugin/plugin.json`) makes it `/project:<name>`; commands have no MCP surface — don't add one.
2. Frontmatter `name`, `type: command`, a one-line `description`, an `argument-hint` (`[scope — e.g. "the auth module" | "security only"]`), and — if it dispatches workers — `skills:`, either a list or a per-role map (`developer: [tdd-loop]`). Two roles of one command never share a skill. A skill only this project's roles need goes in `roles.<role>.extraSkills` in `.agents/config.json`, not in a command file — commands are generic text `/project:sync-template` overwrites.
3. **Every command takes an argument.** Under the H1 write `**Argument:** \`$ARGUMENTS\``, then what it does: the step it overrides, its two or three shapes, what empty means, what it can never bypass (preconditions, Red, human checkpoints). Wire it into the step it changes — an echo nothing consumes silently drops the human's instruction. A dispatched role gets it verbatim.
4. Body: **Preconditions** → numbered **Steps** (one action each) → **Failure modes** → wiki updates → where it pauses for the human.
5. Run `sync` (the `AGENTS.md` catalog is generated; `check` fails if you forget), update `docs/wiki/commands.md` if the human can run shell pieces of it, and commit `feat: add /<name> command — <reason>`.

**Modify:** re-read it; if its contract changes, update `description` and `sync`. A changed argument meaning updates `argument-hint`, the `**Argument:**` block and the consuming step together. `refactor: /<name> — <reason>`.
**Retire:** grep `.agents/` for references, delete the file, `sync`, log it, `chore: retire /<name>`.

## Roles

**Add:**
1. `.agents/roles/<name>.md` — never `.agents/agents/`, which the plugin loader would publish as a native subagent that bypasses the MCP.
2. Frontmatter `name`, `type: agent`, `profile` (`reasoning`/`balanced`/`fast`), `access` (`read-only`/`write`), optional `capabilities: [web]`, and a `description` precise enough to route on. Model, effort and tools are **not** frontmatter and are refused there: the profile picks the model and effort from `.agents/config.json`, and each engine adapter turns `access` into its sandbox.
3. Body: role statement (1–2 sentences) → **Entry checklist** (files to read first, including the wiki pages) → procedure → the wiki updates it makes → **What you do NOT do** (name conflicts with other roles).
4. Add it to `roles` in `.agents/config.json` (pin `engine`/`models`/`effort` if it should not follow the conductor), run `sync`, and re-read every role's `description` — two that could match one task get tightened.
5. Commit `feat: add <name> agent`, citing the requirement that justified it.

**Modify:** read it end to end; change `description` first if the role changes; update "What you do NOT do" when invariants shift. `refactor: <name> agent — <reason>`.
**Retire:** confirm no command references it, delete the file, drop its `config.json` entry, `sync`, log it, `chore: retire <name> agent`.

## Anti-patterns

- **What-is content** — explaining testing or migrations instead of this project's procedure.
- **Generic descriptions** — "helps with code" routes on everything.
- **Duplicate procedures** — two skills with the same steps get merged; a new role that also writes tests or production code splits the `developer`'s cycle.
