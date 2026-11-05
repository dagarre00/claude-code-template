---
name: decision-recording
description: Subagent-side (loaded on demand by developer) or conductor. How to file an Architectural Decision Record (ADR) in docs/wiki/decisions/ for a non-trivial design choice between reasonable alternatives. Trigger on "ADR", "decision", "design choice", "why we picked".
user-invocable: false
---

# Recording a Decision

ADRs record non-obvious design choices in `docs/wiki/decisions/<YYYY-MM-DD-short-kebab-name>.md`. They are superseded rather than edited in place.

## When

File an ADR when choosing between reasonable alternatives that shape future work, when a constraint forces a non-obvious design, when implementation departs from the wiki, or when changing an architecture rule (rule 23). Skip for choices already dictated by `requirements.md`/`architecture.md`, internal refactors, or upstream bug workarounds (`gotchas.md`).

## Procedure

1. Create `docs/wiki/decisions/YYYY-MM-DD-<short-kebab-name>.md`:

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

2. **Backlink** from the active entity page (frontmatter relation or body link) so the ADR is not an orphan. Queue cross-links from out-of-scope pages in `wiki-todos.md` (via `Follow-ups:` if running as a subagent).
3. Queue any follow-up work for `docs/wiki/todos.md` (`Follow-ups:` if subagent).
4. **Ship with the code change** that made the decision (include the ADR path in the case's changed files).
5. **Architecture rule changes** (`architecture.md § Layers`) always require human approval + an ADR; subagents report the need rather than editing rule files.

## Superseding

Never rewrite an accepted ADR's body. Create a new ADR with `supersedes: ["[[decisions/<old-slug>]]"]`, update the old ADR to `status: superseded` and `superseded_by: ["[[decisions/<new-slug>]]"]` with `**Superseded by [[decisions/<new-slug>]] on YYYY-MM-DD.**` at the top of its body, and update backlinks on the active entity page.
