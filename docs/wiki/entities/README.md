---
name: entities-index
description: Index of feature, module, and component pages. Each feature in requirements.md should have a page here.
type: wiki-index
updated: 2026-04-15
---

# Entities

One page per feature / module / component. The implementer reads the entity page before coding and updates it after.

## Naming

- `<feature-slug>.md` in kebab-case (e.g., `user-auth.md`, `payment-webhooks.md`)
- Title inside the page should match the feature name in [[../requirements]]

## Template

Every entity page uses this structure:

```markdown
---
name: <feature-slug>
description: <one-line summary for orchestrator discovery>
type: wiki-entity
status: draft | approved | shipped | deprecated
sources: [../raw/...]
updated: YYYY-MM-DD
---

# <Feature Name>

## Purpose
What this feature exists for, in one paragraph.

## Behavior

Test cases — the tester agent derives tests directly from this section.

- **Given** <precondition>, **when** <action>, **then** <outcome>
- **Given** <precondition>, **when** <action>, **then** <outcome>
- **Error:** <invalid input> → returns/throws <error>
- **Edge:** <boundary condition> → <expected behavior>

*(Each bullet = ≥1 test. Vague bullets block the Red phase — be specific.)*

## Interface
API signatures, CLI surface, UI components — whatever applies.

## Design
How it's built. Key modules, data flow, dependencies on other entities.

## Related
- [[../requirements#<section>]]
- [[<other-entity>]]
- [[../decisions/<decision-slug>]]

## Open questions
Anything unresolved.
```

## Pages

*(none yet — created as features are specified)*
