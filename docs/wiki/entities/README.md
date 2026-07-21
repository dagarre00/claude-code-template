---
aliases: [Entities guide]
type: reference
domains: [knowledge]
status: stable
sources: []
contradicts: []
open_questions: []
created: 2026-04-15
updated: 2026-07-21
---

# Entities

> [!abstract] Essence
> One page per feature / module / component. Each page is the **spec** for that piece — Behavior cases here drive the failing tests the `developer` agent writes.

## Page template

See the `wiki-update` skill (`.claude/skills/wiki-update/SKILL.md`) for the canonical entity-page structure: Obsidian-standard frontmatter (`type: entity`, facets, relations as quoted solitary wikilinks), then `> [!abstract] Essence`, `## Behavior` (with `B<N>:` cases), `## Implementation`, `## Tests`, `## Boundaries`, `## Provenance`.

## Creating an entity

Most entity pages come out of `/project:interview`. Before creating one, run the placement check (`wiki-update` skill) — the concept may already exist under another name in `aliases`. Use the `spec-writing` skill for the Behavior cases — sharp cases → sharp tests → narrow code.

## Naming

Files: `<slug>.md` in kebab-case, no illegal characters (`* " \ / < > : | ? # ^ [ ]`). The slug is what the branch name uses (`feat/<slug>`), what the plan scratch uses (`.claude/handoff/<slug>-plan.md`), and what the tests reference. Pick once, keep it stable.
