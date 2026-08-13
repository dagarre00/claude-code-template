---
aliases: [Entities guide]
type: reference
domains: [knowledge]
status: stable
sources: []
contradicts: []
open_questions: []
created: 2026-04-15
updated: 2026-08-13
---

# Entities

> [!abstract] Essence
> One page per feature / module / component. Each page is the **spec** for that piece — `## Slices` here drive what the `builder` builds, `## Demonstrations` is the evidence it worked, and `## Shortcuts` is the honest account of what's faked underneath.

## Page template

See the `wiki-update` skill (`.claude/skills/wiki-update/SKILL.md`) for the canonical entity-page structure: Obsidian-standard frontmatter (`type: entity`, facets, relations as quoted solitary wikilinks), then `> [!abstract] Essence`, `## Slices` (with `S<N>:` lines naming their demo command), `## Demonstrations`, `## Shortcuts`, `## Implementation`, `## Boundaries`, `## Provenance`.

There is no `## Tests` section — this template has no suite. `## Demonstrations` is what stands in its place, and a `[x]` slice with no demonstration under it is a lint failure.

## Creating an entity

Most entity pages come out of `/project:interview`. Before creating one, run the placement check (`wiki-update` skill) — the concept may already exist under another name in `aliases`. Use the `slice-writing` skill for the slices: three to six at a time, each naming the command that will show it working.

## Naming

Files: `<slug>.md` in kebab-case, no illegal characters (`* " \ / < > : | ? # ^ [ ]`). The slug is what the branch name uses (`proto/<slug>`) and what commit scopes reference. Pick once, keep it stable.
