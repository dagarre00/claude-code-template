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
- A periodic whole-repo review finding requires a stance going forward.

Do **not** file an ADR for:

- A choice that's obvious from the requirements or architecture page.
- A small refactor that doesn't change interfaces.
- A workaround for an upstream bug (that's a gotcha, not a decision).

## Procedure

1. Pick a slug. Format: `YYYY-MM-DD-<short-kebab-name>` — e.g. `2026-05-11-pick-postgres-over-sqlite`.

2. Create `docs/wiki/decisions/<slug>.md` with this structure (frontmatter per the Obsidian standard — flat, identity = filename, wikilinks in properties quoted and solitary):

```markdown
---
aliases: []
type: decision
domains: [<domain>]
status: proposed          # proposed | accepted | superseded | deprecated
sources:
  - docs/raw/<file>       # if applicable
supersedes: []            # e.g. - "[[decisions/<previous-slug>]]"
superseded_by: []
contradicts: []
open_questions: []
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# <Title — one line>

> [!abstract] Essence
> One or two sentences: what was decided and why it matters.

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
```

3. Backlink from the entity page you are working on: add `"[[decisions/<slug>]]"` to its frontmatter relations or reference it in the body — that is what makes the ADR reachable (there is no central index). Other pages that should link to it are a wiki-todo, not an edit outside your scope. If the ADR resolves a `contradicts` pair, state the resolution here and name both pages in a wiki-todo.

4. If the decision creates new work, write the todo line for `docs/wiki/todos.md` — appended if that file is yours to edit, otherwise handed back under `Follow-ups:`.

5. **Ship it with the change that made the decision** — never on its own. Leave the new ADR beside the code and list it with the case's other paths in your report.

6. **Architecture rules are decisions.** Changing a layer, an allowed dependency, or the architecture check's configuration always takes an ADR, and those files are never a worker's to edit. Report the need instead.

## Superseding an ADR

Never edit an accepted ADR's body. To change direction:

1. Create a new ADR explaining the new decision, with `supersedes: ["[[decisions/<old-slug>]]"]` in its frontmatter.
2. Update the old ADR's frontmatter: `status: superseded`, `superseded_by: ["[[decisions/<new-slug>]]"]`, and add at the top of the body: `**Superseded by [[decisions/<new-slug>]] on YYYY-MM-DD.**`
3. Update entity backlinks from old to new. (A `status: superseded` ADR without a `superseded_by` link is a lint gap.)

## Anti-patterns

- **ADRs as long essays.** Four short sections. If you need more, file a `concepts/` page and link from the ADR.
- **ADRs for trivial choices.** "We named the variable `user_id`" is not an ADR. Choose battles.
- **ADRs without alternatives.** If you didn't consider an alternative, the decision wasn't necessary.
- **Editing accepted ADRs.** Supersede instead — preserves the history.
