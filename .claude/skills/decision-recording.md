---
name: decision-recording
description: How to file an Architectural Decision Record (ADR) when making a non-trivial design choice. Use when picking between reasonable alternatives that will be hard to change later. Trigger on "ADR", "decision", "design choice", "architecture decision", "we decided", "why we picked".
type: skill
---

# Recording a Decision

ADRs exist for design choices a future reader will second-guess. They live in `docs/wiki/decisions/`. Each is small, dated, and irreversible-by-default: you supersede, you don't edit.

## When to file an ADR

File one when:
- You picked between two reasonable alternatives and the choice will shape future work.
- A constraint forced a non-obvious answer (compliance, performance, dependency limits).
- The implementation deviates from what the wiki previously said.
- A `/review` finding requires a stance going forward.

Do **not** file an ADR for:
- A choice that's obvious from the requirements or architecture page.
- A small refactor that doesn't change interfaces.
- A workaround for an upstream bug (that's a gotcha, not a decision).

## Procedure

1. Pick a slug. Format: `YYYY-MM-DD-<short-kebab-name>` — e.g. `2026-05-11-pick-postgres-over-sqlite`.

2. Create `docs/wiki/decisions/<slug>.md` with this structure:

```markdown
---
name: <slug>
description: <one line — what was decided>
type: wiki-decision
updated: YYYY-MM-DD
status: proposed | accepted | superseded | deprecated
tags: [decision, <domain>]
---

# <Title — one line>

## Status
Accepted as of YYYY-MM-DD.

## Context
2–4 sentences: what problem is this decision answering, what forces are in play, what constraints exist?

## Decision
1–3 sentences: what is the choice, stated as an active assertion ("We will use X for Y because Z").

## Consequences
- **Positive:** ...
- **Negative:** ...
- **Follow-ups:** [[todos]] items this creates.

## Alternatives considered
- **Option A:** rejected because …
- **Option B:** rejected because …

## References
- Relates to: [[entities/<slug>]], [[concepts/<pattern>]]
- Supersedes: [[decisions/<previous-slug>]] (if applicable)
- Sources: [docs/raw/<file>](../../raw/<file>) (if applicable)
```

3. Update `docs/wiki/index.md` — add a one-liner under the decisions section.

4. Backlink from affected entity pages: under their `## Related`, add `[[decisions/<slug>]]`.

5. If the decision created new work, file todos in `docs/wiki/todos.md`.

6. Commit with `docs: add ADR <slug>`.

## Superseding an ADR

Never edit an accepted ADR's body. To change direction:

1. Create a new ADR explaining the new decision.
2. In the new ADR's `## References`, add `Supersedes: [[decisions/<old-slug>]]`.
3. Update the old ADR's frontmatter `status: superseded` and add at the top: `**Superseded by [[decisions/<new-slug>]] on YYYY-MM-DD.**`
4. Update entity backlinks from old to new.

## Anti-patterns

- **ADRs as long essays.** Four short sections. If you need more, file a `concepts/` page and link from the ADR.
- **ADRs for trivial choices.** "We named the variable `user_id`" is not an ADR. Choose battles.
- **ADRs without alternatives.** If you didn't consider an alternative, the decision wasn't necessary.
- **Editing accepted ADRs.** Supersede instead — preserves the history.
