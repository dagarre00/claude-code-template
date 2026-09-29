---
name: update-toolkit
description: Conductor-only meta skill. How to add, modify or retire a role, a skill, a command or a rule as the project grows. Use when the workflow needs a new procedure, entry point or specialist role, when one drifts, or when one goes unused.
when_to_use: Trigger on "new agent", "add agent", "modify agent", "agent role", "new skill", "add skill", "modify skill", "skill drift", "missing how-to", "new command", "add command", "slash command", "modify command", "new rule".
user-invocable: false
---

# Updating the Toolkit

## Decide which artifact first

- **Skill** — a procedure, loaded by task content: "when X, do these steps". Almost always the answer for new domain knowledge ("the developer needs to know databases" is a skill).
- **Command** — a named entry point the human types, orchestrating branches, dispatches and wiki updates. Thin: heavy lifting lives in roles and skills.
- **Role** — a distinct context scope (fresh-context audit vs in-loop implementation) or invariants that conflict with an existing role ("never write code" vs "always write code"). **Default to no.** No domain roles ("backend agent").
- **Rule** — a discipline every session must hold: the next number in `.claude/rules/behavioral.md`, never a renumbering. A project-specific trap is a gotcha instead.
- **Wiki page**, not this skill — facts about the system (`docs/wiki/concepts/`).

Read 2–3 existing files of the kind first and match their tone, length and structure. Every paragraph is paid for on every load — a role's body on every dispatch, a preloaded skill in every subagent that carries it, a command on every run, a rule in every session and subagent — so keep bodies short, and lift any procedure a command *teaches* into a skill.

## Skills

**Add:**
1. `.claude/skills/<name>/SKILL.md` — a directory per skill; a flat `.claude/skills/<name>.md` is not a skill. Supporting files (templates) sit beside `SKILL.md`, linked from it and read only when needed.
2. Frontmatter: `name` (kebab-case); a precise `description` — what it does, key use first, since the skill listing truncates; `when_to_use` with trigger phrases; and `user-invocable: false`, because the human's entry points are the `/project:*` commands. Bad: "skill for backend". Good: "How to add an HTTP endpoint in this project" with `when_to_use: Trigger on "add endpoint", "new route", "API handler".` Could a real task contain those words? If not, rewrite it. Never `disable-model-invocation: true` on a skill a role preloads — it cannot be preloaded then.
3. Body = procedure (rule 14): a line on when it fires → **Read first** → numbered **Steps** → the wiki pages to update → this project's **Anti-patterns**. If a paragraph could appear in a textbook, delete it. Rationale ("measured on…", "this exists because…") goes in the log entry or an ADR, not the body.
4. **Who reads it?** A skill in a role's `skills:` list is injected whole into that subagent, so it must be obeyable there: no repo-changing git, no writes to the conductor's queues (`todos.md`, `wiki-todos.md`, `log.md` → `Follow-ups:`), nothing outside the role's tools and scope. A procedure with a subagent half and a conductor half is two skills (`adversarial-review` / `finding-disposition`). Mark each in its `description`: `Conductor-only.` or `Subagent-side, preloaded into <role>.`
5. **Give it to a role** by adding it to that role's `skills:` list. Two roles never share a procedure skill — only `subagent-contract` is common to all. A skill the developer needs only sometimes can stay off its list: the developer has the Skill tool and loads skills by description.
6. List it in `.claude/rules/workflow.md § Skills`. A wiki page it cites that doesn't exist → a `wiki-todos.md` line. Commit `feat: add <name> skill — <reason>`.

**Modify:** read it whole; change `description` first if the trigger changes; confirm the pages it cites exist. `refactor: <name> skill — <reason>`.
**Retire:** grep `.claude/` and `docs/wiki/` for references (every role's `skills:` list included), delete the directory, log it, `chore: retire <name> skill`.

Skills reload live. A skill or command whose frontmatter does not parse still loads, with no fields set, and a role needs its `name` and `description` to load at all — so read the frontmatter back after every edit, and quote any value that contains `: ` or ` #`, or starts with `[`, `{` or a quote. `claude plugin validate` is lenient and has passed malformed YAML; don't rely on it alone.

## Commands

**Add:**
1. `.claude/commands/project/<name>.md`, which Claude Code serves as `/project:<name>`.
2. Frontmatter: a one-line `description`; a **quoted** `argument-hint` (`'[scope — e.g. "the auth module" | "security only"]'` — unquoted brackets parse as a YAML list); and `disable-model-invocation: true`, because a command is the human's to start, never Claude's.
3. **Every command takes an argument.** Under the H1 write `**Argument:** \`$ARGUMENTS\``, then what it does: the step it overrides, its two or three shapes, what empty means, what it can never bypass (preconditions, Red, human checkpoints). Wire it into the step it changes — an echo nothing consumes silently drops the human's instruction. A dispatched role gets it verbatim when it belongs in the brief.
4. Body: **Preconditions** → numbered **Steps** (one action each) → **Failure modes** → wiki updates → where it pauses for the human. Live state the command always needs can be injected: a line `` Branch: !`git branch --show-current` `` arrives with the command's output in place. Keep injected commands read-only and quick — one that fails aborts the whole command.
5. Add it to `.claude/rules/workflow.md § Commands`, update `docs/wiki/commands.md` if the human can run shell pieces of it, and commit `feat: add /project:<name> — <reason>`.

**Modify:** re-read it; if its contract changes, update `description` and the workflow map. A changed argument meaning updates `argument-hint`, the `**Argument:**` block and the consuming step together. `refactor: /project:<name> — <reason>`.
**Retire:** grep `.claude/` for references, delete the file, drop its row from the map, log it, `chore: retire /project:<name>`.

## Roles

**Add:**
1. `.claude/agents/<name>.md` — a Claude Code subagent, dispatched by `subagent_type` from a command step.
2. Frontmatter:
   - `name`, and a `description` precise enough that nothing else routes to it — name the command step that dispatches it.
   - `model` — `opus` for rare, high-leverage reasoning; `sonnet` for work that runs every cycle. `effort` — `medium` for well-specified work, `high` where edge cases or verification matter, `xhigh` only for rare decisions whose mistakes cost whole cycles.
   - `tools` — always an explicit list. A read-only role gets `Read, Grep, Glob, Bash, PowerShell` and nothing that edits; no role gets `Agent`, so subagents stay leaves.
   - `permissionMode` — `dontAsk` for a read-only role, or for one whose writes an allow rule in `.claude/settings.json` can bound (`Edit(/docs/wiki/**)`): anything unlisted is then denied rather than prompted. `acceptEdits` for a role that writes source.
   - `skills` — `subagent-contract` first, then the role's own procedures.
   - `maxTurns` — a generous ceiling; the conductor resumes a partial result.
   - `color` — one no other role uses.

   Leave out `memory` — the wiki is the project's memory, and a reviewer that remembers past rounds loses its fresh context — and `isolation: worktree`, since roles share this checkout one writer at a time (`subagent-dispatch`).
3. Body: role statement (1–2 sentences) → **Entry checklist** (files to read first, including the wiki pages) → procedure → **Report** (what its final message holds) → **What you do NOT do** (name conflicts with other roles).
4. Add it to `.claude/rules/workflow.md § Roles`, wire it into the command step that dispatches it, and re-read every role's `description` — two that could match one task get tightened. Roles load at session start: restart Claude Code to use it.
5. Commit `feat: add <name> role`, citing the requirement that justified it.

**Modify:** read it end to end; change `description` first if the role changes; update "What you do NOT do" when invariants shift. A model or effort change follows `subagent-dispatch` § Changing a role's model or effort. `refactor: <name> role — <reason>`.
**Retire:** confirm no command dispatches it, delete the file, drop its row from the map, log it, `chore: retire <name> role`.

## Anti-patterns

- **What-is content** — explaining testing or migrations instead of this project's procedure.
- **Generic descriptions** — "helps with code" routes on everything.
- **Duplicate procedures** — two skills with the same steps get merged; a new role that also writes tests or production code splits the `developer`'s cycle.
- **Edit tools "just in case"** on a role that should only read — read-only is enforced by the tools list, not by the prompt.
