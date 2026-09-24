---
name: decision-recording
description: How to file an Architectural Decision Record (ADR) for a non-trivial design choice — picking between reasonable alternatives that will be hard to change later. Trigger on "ADR", "decision", "design choice", "architecture decision", "we decided", "why we picked".
type: skill
---

# Recording a Decision

ADRs record the design choices a future reader will second-guess. They live in `docs/wiki/decisions/`, are small and dated, and are superseded rather than edited.

## When

File one when you chose between reasonable alternatives that will shape future work, a constraint forced a non-obvious answer (compliance, performance, a dependency limit), the implementation departs from what the wiki said, or a whole-repo review finding needs a standing answer. Not for a choice the requirements or architecture already make obvious, a refactor that changes no interface, or a workaround for an upstream bug (that is a gotcha).

## Procedure

1. Name it `YYYY-MM-DD-<short-kebab-name>` (e.g. `2026-05-11-pick-postgres-over-sqlite`) and create `docs/wiki/decisions/<slug>.md`:

   ```markdown
   ---
   aliases: []
   type: decision
   domains: [<domain>]
   status: accepted          # proposed | accepted | superseded | deprecated
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
   > What was decided and why it matters, in one or two sentences.

   ## Context

   Two to four sentences: the problem, the forces, the constraints.

   ## Decision

   "We will use X for Y because Z."

   ## Consequences

   - **Positive:** …
   - **Negative:** …
   - **Follow-ups:** the todos this creates.

   ## Alternatives considered

   - **Option A:** rejected because …
   ```

   Longer than that → put the depth in a `concepts/` page and link it. No alternative considered → the decision wasn't needed.
2. **Backlink** from the entity page you are working on (a frontmatter relation or a body link) — that is what makes the ADR reachable. Other pages that should link to it are a wiki-todo, not an edit outside your scope. An ADR resolving a `contradicts` pair states the resolution and names both pages in a wiki-todo.
3. New work it creates → a todo line for `docs/wiki/todos.md`; todo and wiki-todo lines go in the file if it is yours to edit, otherwise under `Follow-ups:` in your report.
4. **Ship it with the change that made the decision**, never on its own — beside the code, listed with the case's other paths.
5. **Architecture rules are decisions.** Changing a layer, an allowed dependency or the architecture check's configuration always takes an ADR, and those files are never a worker's to edit — report the need.

## Superseding

Never edit an accepted ADR's body. File a new one with `supersedes: ["[[decisions/<old-slug>]]"]`; set the old one's `status: superseded` and `superseded_by: ["[[decisions/<new-slug>]]"]`, with `**Superseded by [[decisions/<new-slug>]] on YYYY-MM-DD.**` at the top of its body; move entity backlinks to the new one.
