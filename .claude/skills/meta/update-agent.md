---
name: update-agent
description: How to add, modify, or retire an agent in this project. Use when the workflow needs a new specialist role, an existing agent's responsibilities shift, or an agent is no longer needed. Trigger on "new agent", "add agent", "modify agent", "agent prompt", "agent role".
type: skill
---

# Updating an Agent

Use this when you need a new role, an existing agent's prompt has drifted from its actual job, or an agent is unused. Don't quietly fold new responsibilities into an existing agent — split if the role is genuinely different.

## Decide first: does this warrant a new agent?

Default to **no**. Reasons to create a new agent are narrow:

- The task needs **a different scope of context** than existing agents (e.g. fresh-context audit vs in-loop implementation).
- The role has **strict invariants** that conflict with an existing agent's invariants (e.g. "never write code" + "always write code").

If it's just "the developer needs to know more about databases," that's a **skill**, not an agent. Use `update-skill` instead. This is the progressive-disclosure principle: domain knowledge belongs in skills the developer loads, not in new agents.

## Procedure — adding an agent

1. **Locate examples.** Read at least two existing agents in `.claude/agents/` to mirror tone, length, and structure.

2. **Draft the frontmatter:**

   ```yaml
   ---
   name: <kebab-case-name>
   description: <one line: what triggers it, what it does — used by Claude Code to decide when to dispatch>
   type: agent
   ---
   ```

   The `description` is matched against task content — make it precise. Bad: "helps with code". Good: "Fresh-context auditor: reviews code against the wiki in an isolated worktree, flags drift and missing tests."

3. **Write the body in this order:**
   - Role statement (1–2 sentences).
   - **Entry checklist** — files to read before doing anything. Always include the relevant wiki pages.
   - Procedure — the actual steps.
   - Wiki updates the agent must make.
   - **What you do NOT do** — invariants. Make conflicts with other agents explicit here.

4. **Update `CLAUDE.md`** — add a row to the "Agent routing" table.

5. **Verify routing.** Re-read every existing agent's `description` and the new one. If two descriptions could match the same task, tighten them.

6. **Commit** with `feat: add <name> agent` and reference the requirements section that justified the new agent.

## Procedure — modifying an agent

1. Read the current file end-to-end. Know what you're changing.
2. If you're changing the role (not just wording), update the `description` first. The description is the routing key.
3. Update only the section that needs changing. Don't refactor "while you're in there."
4. If the change touches what the agent _won't_ do, update the "What you do NOT do" section explicitly.
5. Commit with `refactor: <name> agent — <reason>`.

## Procedure — retiring an agent

1. Confirm no command references it (`grep -r "<agent-name>" .claude/commands/`).
2. Delete the file.
3. Remove its row from CLAUDE.md's routing table.
4. Append to `docs/wiki/log.md` why it was retired.
5. Commit with `chore: retire <name> agent`.

## Anti-patterns

- **Domain agents.** No "backend agent", no "frontend agent". That's what skills are for.
- **Long preambles.** Agents are read every dispatch — every paragraph costs context. Be terse.
- **"What is X" content.** Never explain what testing or refactoring is. The LLM knows. Tell it the _procedure for this project_.
- **Duplicate invariants.** The `developer` owns the whole Red→Green→refactor loop. If you add a new agent that also writes tests or production code, you've split a cycle that's meant to live in one agent — reconsider whether it should be a skill instead.
