---
aliases: [Entities guide]
type: reference
domains: [knowledge]
status: stable
sources: []
contradicts: []
open_questions: []
created: 2026-04-15
updated: 2026-09-23
---

# Entities

> [!abstract] Essence
> One page per feature, module or component — the **spec** for that piece. Its Behavior cases become the failing tests the `developer` writes.

- **Template:** the `wiki-update` skill — frontmatter, Essence, `## Behavior` (`B<N>:` cases), `## Implementation`, `## Tests`, `## Boundaries`, `## Provenance`.
- **Creating one:** usually during `/project:interview`. Run the placement check first (the concept may exist under another alias), and write the cases with the `spec-writing` skill.
- **Naming:** `<slug>.md`, kebab-case, none of `* " \ / < > : | ? # ^ [ ]`. The slug is also the branch (`feat/<slug>`) and the plan scratch (`.handoff/<slug>-plan.md`) name, and tests reference it — pick it once.
