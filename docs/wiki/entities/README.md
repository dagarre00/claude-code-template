---
name: entities-readme
description: Guide to the entities directory — entity page template, naming, and creation.
type: wiki-entity
updated: 2026-05-11
status: approved
---

# Entities

One page per feature / module / component. Each page is the **spec** for that piece — Behavior cases here drive the failing tests the `developer` agent writes.

## Page template

See the `wiki-update` skill (`.claude/skills/wiki-update/SKILL.md`) for the canonical entity-page structure: frontmatter, `## Purpose`, `## Behavior` (with `B<N>:` cases), `## Implementation`, `## Tests`, `## Notes`, `## Related`.

## Creating an entity

Most entity pages come out of `/project:interview`. To create one by hand, use the `spec-writing` skill for the Behavior cases — sharp cases → sharp tests → narrow code.

## Naming

Files: `<slug>.md` in kebab-case. The slug is what the branch name uses (`feat/<slug>`), what the plan scratch uses (`.claude/handoff/<slug>-plan.md`), and what the tests reference. Pick once, keep it stable.
