---
name: update-toolkit
description: How to add, modify, or retire an agent, a skill, or a slash command in this project — the meta skill that evolves the agent's own toolkit. Use when the workflow needs a new specialist role, a new how-to procedure, or a new repeatable entry point; when an existing one drifts; or when one is unused. Trigger on "new agent", "add agent", "modify agent", "agent role", "new skill", "add skill", "modify skill", "skill drift", "missing how-to", "new command", "add command", "slash command", "modify command".
type: skill
---

# Updating the Toolkit — Agents, Skills, Commands

This project's agents, skills, and commands are not fixed — the agent evolves them as the project grows. This skill is the procedure for all three. **First decide which artifact you actually need**, then follow the matching section.

## Decide first: which artifact?

- **Skill** = a procedure the agent runs, auto-loaded by task content. "Always do these steps when…". Lives in `.claude/skills/<name>/SKILL.md`. This is almost always the right answer for new domain knowledge (progressive disclosure — domain knowledge belongs in skills the developer loads, not in new agents).
- **Command** = a human-invoked, named entry point that orchestrates work (branch, dispatch agents, touch the wiki). "The human types `/foo`". Lives in `.claude/commands/project/<name>.md`. Commands stay thin — heavy lifting lives in agents and skills.
- **Agent** = a distinct role with its own context scope or conflicting invariants. **Default to no.** Only create one when the task needs a genuinely different scope of context (e.g. fresh-context audit vs in-loop implementation) or strict invariants that conflict with an existing agent ("never write code" + "always write code"). "The developer needs to know more about databases" is a **skill**, not an agent.
- **Wiki page** (not this skill) = knowledge the agent reads, not a procedure it runs. "Facts about the system" → a `docs/wiki/concepts/` page.

Read 2–3 existing files of the target kind before writing, to mirror tone, length, and structure.

---

## Skills

### Add a skill

1. **Frontmatter.** `name` (kebab-case), `type: skill`, and a precise `description` — this is everything, because Claude Code uses it to auto-load. Bad: "skill for backend". Good: "Use when adding an HTTP endpoint. Trigger on 'add endpoint', 'new route', 'API handler'."
2. **Body = procedure, not explanation.** Structure: 1–2 sentence opening (when it fires, what it produces) → **Read first** (wiki pages/files to load) → **Steps** (numbered, executable) → **Wiki update** (pages to touch when done) → **Anti-patterns** (this project's footguns).
3. **Placement.** Every skill is a directory with a `SKILL.md` entrypoint: `.claude/skills/<name>/SKILL.md`. A flat `.claude/skills/<name>.md` or a grouping subfolder (`.claude/skills/meta/<name>/SKILL.md`) is **silently ignored** — the skill never loads and nothing tells you why. Supporting files (templates, scripts) live next to `SKILL.md`.
4. **Test the trigger.** Could a real session task contain the `description`'s words? If not, rewrite.
5. **Cross-link.** If the skill points at a wiki page that doesn't exist yet, file a `docs/wiki/wiki-todos.md` line.
6. **Commit** `feat: add <name> skill — <one-line reason>`.

### The "how-to not what-is" rule

If a paragraph could appear in a textbook chapter on the topic, **delete it**. Assume the LLM knows the topic; tell it how *this project* handles it. Bad: "TDD means writing a test first, seeing it fail…". Good: "Write one failing test per Behavior case, run `<test-command>`, confirm it fails for the right reason, then write the smallest code to pass."

### Modify / retire a skill

- **Modify:** read the whole skill first; if the trigger changes, update `description` first; verify referenced wiki pages still exist. Commit `refactor: <name> skill — <reason>`.
- **Retire:** grep `.claude/` and `docs/wiki/` for references, delete the `.claude/skills/<name>/` directory, append to `docs/wiki/log.md`, commit `chore: retire <name> skill`.

---

## Commands

### Add a command

1. **Frontmatter.** `name` (kebab-case), `type: command`, one-line `description` (shown in listings).
2. **Body = the procedure the orchestrator follows:** **Preconditions** (check first) → **Steps** (numbered; one action each — pick todo, branch, dispatch agent) → **Failure modes** → **Wiki updates** → **Human checkpoints** (where it pauses).
3. **Placement.** `.claude/commands/project/<name>.md`. The sub-folder is the namespace: `commands/project/work.md` → `/project:work`; a flat `commands/<name>.md` → `/<name>`. Keep new ones under `project:` unless you deliberately want un-namespaced.
4. **Update `CLAUDE.md`** — add a row to the Slash commands table.
5. **Update `docs/wiki/commands.md`** if the human can run shell pieces of it.
6. **Commit** `feat: add /<name> command — <reason>`.

### Modify / retire a command

- **Modify:** re-read the file; if preconditions/output contract change, update `description` and the CLAUDE.md row. Commit `refactor: /<name> — <reason>`.
- **Retire:** grep `.claude/` for references, delete the file, remove the CLAUDE.md row, append to `docs/wiki/log.md`, commit `chore: retire /<name>`.

---

## Agents

### Add an agent

1. **Frontmatter.** `name`, `type: agent`, `model` (`sonnet` default / `opus` reasoning-heavy / `haiku` cheap mechanical), `tools:` allowlist **or** `disallowedTools:` denylist (grant only what the role needs; omit both for all tools), and a precise `description` matched against task content. Bad: "helps with code". Good: "Fresh-context auditor: reviews code against the wiki in an isolated worktree, flags drift and missing tests."
2. **Body in order:** role statement (1–2 sentences) → **Entry checklist** (files to read first, always including relevant wiki pages) → Procedure → wiki updates the agent must make → **What you do NOT do** (invariants; make conflicts with other agents explicit).
3. **Update `CLAUDE.md`** — add a row to the Agent routing table.
4. **Verify routing.** Re-read every agent's `description`; if two could match the same task, tighten them.
5. **Commit** `feat: add <name> agent` referencing the requirement that justified it.

### Modify / retire an agent

- **Modify:** read the file end-to-end; if the role changes, update `description` (the routing key) first; update "What you do NOT do" if invariants shift. Commit `refactor: <name> agent — <reason>`.
- **Retire:** confirm no command references it (`grep -r "<agent-name>" .claude/commands/`), delete the file, remove the CLAUDE.md row, append to `docs/wiki/log.md`, commit `chore: retire <name> agent`.

---

## Anti-patterns (all three)

- **Domain agents.** No "backend agent", no "frontend agent" — that's what skills are for.
- **What-is content.** Never explain what testing/refactoring/migrations *are*. Tell the agent the procedure for this project.
- **Long bodies.** Agents are read every dispatch; commands longer than ~40 lines are hiding skill content — lift it into a skill. Every paragraph costs context.
- **Generic descriptions.** "Helps with code" loads/routes on everything — useless. Be specific about the trigger.
- **Duplicate procedures / invariants.** Two skills with the same steps → merge. A new agent that also writes tests or production code splits a cycle meant to live in the `developer` — reconsider whether it should be a skill.
