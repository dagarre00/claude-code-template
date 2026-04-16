---
name: project-feature
description: Clarify a feature request through targeted Q&A, evaluate viability against the current codebase, produce a spec file, ingest it into the wiki, and seed a TODO ready for /project:work.
type: command
---

Conduct a **feature scoping session** inline (no sub-agent). The output is a structured spec file in `docs/raw/feature-requests/` that feeds into the wiki and produces a concrete, implementation-ready TODO.

## Before asking anything

Read the following to understand the existing system:

1. `docs/wiki/requirements.md` — what's already planned or built
2. `docs/wiki/architecture.md` — stack and design patterns
3. `docs/wiki/gotchas.md` — known failure points
4. Any `docs/wiki/entities/*.md` page whose name or description is related to the request
5. `docs/wiki/todos.md` — check whether this feature (or something like it) is already queued

If the feature touches something that already has an entity page or a pending TODO, say so upfront and ask whether this is an enhancement to that feature or something new.

## Phase 1 — Understand the request

Ask ONE question at a time. Start with:

1. Describe what you want the feature to do. (Free-form — let them explain it in their own words.)
2. Who uses this feature, and in what situation do they reach for it?
3. What does success look like — what can the user do after this is built that they can't do today?
4. Is there an existing feature this extends, or is this entirely new?

## Phase 2 — Define behavior precisely

For each key action the feature involves, ask:

1. Walk me through the exact steps a user takes. What do they input? What happens? What do they see?
2. What should happen when the input is invalid or the operation fails?
3. Are there edge cases you already know about? (e.g., empty state, concurrent access, large data)
4. Are there any rules or constraints on this behavior? (rate limits, permissions, validation rules)

## Phase 3 — Define the interface

1. Where does this feature live — API endpoint, CLI flag, UI component, background job?
2. What are the inputs and outputs? (field names, types, shapes if known)
3. Does it need to integrate with any external service or existing internal module?
4. Are there any constraints on the interface? (must match an existing pattern, must be backwards-compatible)

## Phase 4 — Set acceptance criteria

Generate a list of testable acceptance criteria from what you've heard. Read them back and ask:
- "Are these correct?"
- "Am I missing anything important?"
- "Is there a criterion that's vague or untestable that we should make more specific?"

## Phase 5 — Scope boundaries

1. What is explicitly NOT in this version of the feature? (helps prevent scope creep)
2. Are there follow-on features that would naturally come after this one?

## Phase 6 — Viability assessment (agent-driven)

**Do not ask the user for this phase.** Use what you read in Step 0 to assess:

- **Conflicts**: Does this contradict any existing requirement or entity design? If yes, flag it explicitly.
- **Affected entities**: Which `docs/wiki/entities/*.md` pages need to be updated or created?
- **Affected files**: Based on the architecture and file-map, which source directories or files are likely involved?
- **Complexity**: Low (isolated new function/endpoint), Medium (touches multiple modules or existing interfaces), High (requires refactoring, migration, or new infrastructure).
- **Risks**: Apply gotchas from `docs/wiki/gotchas.md`. Are there known failure modes that apply here?
- **Dependencies**: Does this require another feature to be built first? Is that feature pending or already shipped?

Present the viability summary to the user. If there are conflicts or high risks, explicitly ask: "Given these risks, do you want to proceed, adjust the scope, or park this?"

## After scoping is complete

1. Confirm: "Here's what I'm going to write up. Does this match what you want?"
2. Write the spec file to `docs/raw/feature-requests/YYYY-MM-DD-<slug>.md` using the format below.
3. The `raw-index-sync` hook will register it in `docs/raw/index.md` automatically.
4. Dispatch the **wiki-maintainer** agent to ingest it:
   - Creates or updates `docs/wiki/entities/<slug>.md` with the behavior, interface, and acceptance criteria from the spec.
   - Adds an ADR to `docs/wiki/decisions/` if the viability assessment flagged a non-trivial design choice.
   - Adds a row to `docs/wiki/todos.md` (priority based on the assessment — P0 if blocks other features, P1 for core functionality, P2 for enhancements).
   - Updates `docs/wiki/requirements.md` if this feature adds new functional requirements.
   - Appends `## [YYYY-MM-DD] ingest | feature-request: <slug>` to `docs/wiki/log.md`.
5. Tell the user: "Spec saved and wiki updated. Run `/project:work` when ready to implement — it will pick this up as the next TODO."

## Spec file format

```markdown
---
name: <feature-slug>
type: feature-request
requested: YYYY-MM-DD
status: pending
---

# Feature Request: <Feature Name>

## Summary
One paragraph: what is being requested and why.

## Behavior
What the feature does from the user's perspective. Numbered steps for flows.

## Interface
API endpoints / CLI flags / UI components being added or changed. Include field names and types where known.

## Acceptance criteria
- [ ] <Specific, testable criterion>
- [ ] <Specific, testable criterion>

## Dependencies
- Requires [[../wiki/entities/<x>]] to exist (if not yet shipped)
- External: <library, service>

## Out of scope (this iteration)
- <Explicit exclusion 1>
- <Explicit exclusion 2>

## Viability assessment

**Conflicts with existing design:** <none / description of conflict>
**Affected entities:** <list>
**Files likely affected:** <top-level paths>
**Estimated complexity:** Low / Medium / High
**Risks / gotchas:** <list>

## Open questions
- <Anything unresolved needing a decision before implementation>
```
