---
name: project-feature
description: Scoped feature interview. Interviews user about a single new feature, defines its spec, appends to requirements.md, creates entity page with Behavior test contract, seeds TODOs. Use for adding features to an existing project.
type: command
---

Interview me relentlessly about every aspect of this feature until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask the questions one at a time.

If a question can be answered by exploring the codebase, explore the codebase instead.

Define a **new feature** for an existing project via a focused interview, then wire it into the wiki and TODO queue.

## Protocol

0. **Load superpowers** — invoke `superpowers:using-superpowers` first to establish available skills before proceeding.
1. **Brainstorm first** — invoke `superpowers:brainstorming` to explore design, propose approaches, and produce an approved spec before the interview. Skip this step only if the user explicitly brings a pre-formed spec.
2. Read `docs/wiki/requirements.md` and `docs/wiki/entities/` to understand what already exists — avoid redefining covered ground. If a question can be answered from the codebase or wiki, do that instead of asking.
3. Open a transcript at `docs/raw/interviews/YYYY-MM-DD-feature-<slug>.md`.
4. Ask **ONE question at a time**. For each question, provide your recommended answer. Append each Q and A immediately — no batching.
5. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one.
6. After each phase, read back what you captured and confirm before moving to the next phase.

## Interview phases

- **Goal** — What does this feature do? What user problem does it solve? Who uses it?
- **User stories** — Walk the user journey for this feature only. Generate `As a [user], I can [action]` bullets.
- **Behavior spec** — For each story, define Given/When/Then cases. These become the test contract verbatim.
- **Interface** — API shape, UI entry points, inputs/outputs, error states and messages.
- **Constraints** — Integration with existing components? Performance, security, or compliance requirements?
- **Out of scope** — What is explicitly excluded from this version of the feature?
- **Priority & sizing** — How many TODO items does this break into? Simple or complex? What order?

## After the interview

1. Read back the full transcript and ask: "Is this accurate? Anything to add, remove, or change?"
2. Once confirmed, ingest:
   - Set transcript status to `ingested` in `docs/raw/index.md`.
   - Write `docs/wiki/summaries/feature-<slug>.md`.
   - **Append** the new feature to `docs/wiki/requirements.md` under the matching section (Functional Requirements, Non-Functional, etc.). Never rewrite — only add. Flag contradictions with existing requirements inline: `> ⚠ contradicts [[requirements#<section>]]: <one-line>`.
   - Create `docs/wiki/entities/<slug>.md`. Populate `## Behavior` with the Given/When/Then cases from the interview — this is the test contract the tester agent will use.
   - If the feature introduces a non-trivial design choice (auth strategy, data model, external service), create `docs/wiki/decisions/<slug>.md`.
   - Seed `docs/wiki/todos.md` with prioritized TODO rows for this feature. Confirm order with user before writing.
   - Update `docs/wiki/index.md` to list any new pages.
   - Append to `docs/wiki/log.md`: `## [YYYY-MM-DD] feature | <slug>`.

## Difference from `/project:interview`

`/project:interview` is for **initial project setup** — it covers the full project (vision, stack, constraints) and rewrites `requirements.md` from a blank slate.

`/project:feature` is for **incremental feature addition** — it is scoped to one feature and only appends. Use this whenever the project already exists.
