---
name: update-skill
description: How to add, modify, or retire a skill in this project. Use when the agent encounters a domain or pattern it doesn't have a how-to for, when an existing skill drifts, or when a skill is no longer needed. Trigger on "new skill", "add skill", "modify skill", "skill drift", "missing how-to".
type: skill
---

# Updating a Skill

Skills are how the project encodes "the way we do X here." When the developer hits a domain it has no skill for (e.g. first time adding a Postgres migration in this project), the right move is to **create the skill**, not stuff the knowledge into a one-off prompt. The skill compounds — next time, it auto-loads.

## Decide first: skill or wiki page?

- **Skill** = procedure the agent runs. Lives in `.claude/skills/`. Triggered by task content. "Here's the steps to add an X."
- **Wiki page** = knowledge the agent reads. Lives in `docs/wiki/`. Read on demand by the agent. "Here's what X is and where the pieces are."

If you'd describe it as "always do these steps when…", it's a skill. If it's "facts about the system," it's a wiki page (probably a `concepts/` page).

## Procedure — adding a skill

1. **Read 2–3 existing skills.** Match the style — terse, procedural, project-specific.

2. **Draft the frontmatter:**

   ```yaml
   ---
   name: <kebab-case>
   description: <when it triggers, what procedure it provides — Claude Code uses this to auto-load>
   type: skill
   ---
   ```

   The `description` is everything. Bad: "skill for backend". Good: "Use when adding an HTTP endpoint to the backend. Trigger on 'add endpoint', 'new route', 'API handler'."

3. **Write the body as a procedure**, not an explanation. Structure:
   - 1–2 sentence opening: when this skill fires and what it produces.
   - **Read first**: which wiki pages or files to load (e.g. `docs/wiki/architecture.md`, `docs/wiki/entities/<slug>.md`).
   - **Steps**: numbered, executable steps. Code/command examples where useful.
   - **Wiki update**: which pages the agent must touch when done.
   - **Anti-patterns**: what _not_ to do — the project's specific footguns.

4. **Place the file.**
   - Meta skills → `.claude/skills/meta/<name>.md`.
   - Everything else → `.claude/skills/<name>.md` (flat). Don't pre-organize folders until there are 8+ skills.

5. **Test the trigger.** Read the `description`. Could a session task reasonably contain those exact words? If not, rewrite.

6. **Cross-link.** If the skill points at a wiki page that doesn't exist yet, file a `docs/wiki/wiki-todos.md` line so the maintainer creates it.

7. **Commit** with `feat: add <name> skill — <one-line reason>`.

## Procedure — modifying a skill

1. Read the whole skill before editing.
2. If the trigger changes, update `description` first — that's how the skill gets loaded.
3. Skill bodies decay; check that referenced wiki pages still exist and the procedure still matches reality. Don't update a skill while ignoring a broken reference.
4. Commit with `refactor: <name> skill — <reason>`.

## Procedure — retiring a skill

1. Grep `.claude/` and `docs/wiki/` for references.
2. Delete the file.
3. Append to `docs/wiki/log.md`.
4. Commit `chore: retire <name> skill`.

## The "how-to not what-is" rule

If a paragraph could appear in a textbook chapter on the topic, **delete it**. Skills are project-specific procedure. Assume the LLM knows the topic; tell it how this project handles it.

Bad (what-is): "TDD stands for Test-Driven Development. You write a test first, see it fail, then write code to make it pass…"

Good (how-to): "Write one failing test per Behavior case, run `<test-command-from-docs/wiki/commands.md>`, and confirm it fails for the right reason. Then write the smallest code to make it pass."

## Anti-patterns

- **Skill explains the concept.** Cut it; the LLM knows.
- **Skill references files that don't exist.** Fix before committing.
- **Skill duplicates another skill's procedure.** Merge or split — pick one home for each step.
- **Description is too generic.** "Helps with code" loads on everything; useless. Be specific about the trigger.
