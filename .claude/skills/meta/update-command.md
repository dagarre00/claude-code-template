---
name: update-command
description: How to add, modify, or retire a slash command. Use when the workflow needs a new repeatable entry point, an existing command's behavior shifts, or a command is unused. Trigger on "new command", "add command", "slash command", "modify command".
type: skill
---

# Updating a Slash Command

Slash commands are repeatable, named entry points the human invokes (`/work`, `/review`, `/interview`). They orchestrate — pulling todos, dispatching agents, branching, running hooks. Commands themselves should be thin; the heavy lifting lives in agents and skills.

## Decide first: command or skill?

- **Command** = human-invoked, orchestrates work. Has a one-line intent ("pick the top todo and run TDD"). Almost always touches branch / wiki / multiple agents.
- **Skill** = auto-invoked by task content, single procedure. Quiet, in-flow.

If the human will type `/foo`, it's a command. If the agent should *just know how to do foo* when the task mentions it, it's a skill.

## Procedure — adding a command

1. **Read 2 existing commands** in `.claude/commands/` to mirror style.

2. **Draft the frontmatter:**
   ```yaml
   ---
   name: <kebab-case>
   description: <one line — shown in command listings, used by the human to remember what it does>
   type: command
   ---
   ```

3. **Write the body** as a procedure the orchestrator (you, when the command fires) follows:
   - **Preconditions**: branch state, files that must exist, env state. Check them first.
   - **Steps**: numbered. Each step is one action — pick todo, create branch, dispatch agent, etc.
   - **Failure modes**: what to do if step N fails.
   - **Wiki updates**: what gets touched.
   - **Human checkpoints**: where the command must pause for human confirmation.

4. **Place the file** at `.claude/commands/<name>.md` (flat — sub-folders only when there are 10+ commands).

5. **Update `CLAUDE.md`** — add a row to the "Slash commands" table.

6. **Update `docs/wiki/commands.md`** — add the shell-side command line if the user can also run shell pieces of it.

7. **Commit** with `feat: add /<name> command — <reason>`.

## Procedure — modifying a command

1. Re-read the file.
2. If the command's preconditions or output contract changes, update the description first.
3. Update the CLAUDE.md row if the one-liner changed.
4. Commit with `refactor: /<name> — <reason>`.

## Procedure — retiring a command

1. Grep `.claude/` for references.
2. Delete the file.
3. Remove the CLAUDE.md row.
4. Append to `docs/wiki/log.md`.
5. Commit `chore: retire /<name>`.

## Anti-patterns

- **Big command bodies.** If you're writing a procedure longer than ~40 lines, you're hiding skill content in the command. Lift the procedure into a skill and have the command invoke it.
- **Commands that touch code directly.** Commands orchestrate; agents and skills touch code.
- **Commands without human checkpoints.** Long-running commands (`/work`, `/review`) must have at least one explicit "pause and report" step.
- **Duplicate commands.** Two commands that mostly do the same thing → merge with a flag.
