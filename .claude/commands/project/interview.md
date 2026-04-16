---
name: project-interview
description: Guided requirements Q&A. Writes a transcript to docs/raw/interviews/, then ingests it into docs/wiki/requirements.md.
type: command
---

Conduct the requirements interview **inline in the main context** (no sub-agent).

## Before starting

Read `docs/wiki/requirements.md` to see what's already captured. Also check whether this is an **existing project** by looking for:
- Code in `src/`, `app/`, `lib/`, or equivalent directories
- An existing `README.md`
- Git history (`git log --oneline -10`)

If it is an existing project, **read those files first** and pre-fill what you can before asking any questions. Ask the user to confirm and correct pre-filled answers rather than asking them to repeat what the code already shows.

## Protocol

1. Open (create if needed) a transcript file at `docs/raw/interviews/YYYY-MM-DD-<slug>.md` where slug is a 2-3 word kebab description of the project.
2. Ask **ONE question at a time**. Append each Q and A to the transcript immediately — don't batch.
3. After each phase completes, read back what you captured and ask: "Is this accurate? Anything to add or change?"
4. Never move to the next phase until the user confirms the current one.

## Phase questions

Work through each phase in order. These are the core questions — adapt wording to the conversation, skip any that the code/docs already answer clearly.

### Phase 1 — Vision
- What does this project do in one sentence?
- Who are the primary users?
- What problem does it solve for them that isn't solved today?
- What does success look like in 3–6 months?

### Phase 2 — User Stories
Walk through the user journey end-to-end. For each user type identified in Phase 1:
- What is the first thing the user does when they open the product?
- What is the most important action they take? What does that flow look like step by step?
- What do they do when something goes wrong?
- Are there admin or internal users with different workflows?

Generate `As a [user], I can [action]` bullets from their answers. Read them back and ask: "Did I miss any important action?"

### Phase 3 — Functional Requirements
For each user story:
- What must the system do to support this story? (ask for the system-side behavior, not UI)
- Are there any rules or constraints on this behavior? (validation, limits, permissions)
- What should happen when invalid input is provided?
- What integrations does this feature depend on? (third-party APIs, other services)

Group answers by feature area. Read back and confirm.

### Phase 4 — Non-Functional Requirements
- **Stack**: What language and framework? (If already detected, confirm.) Any constraints on technology choices?
- **Performance**: What response time is acceptable for the most common operations? At what user volume?
- **Reliability**: What uptime is required? What happens during an outage?
- **Testing**: Unit tests only, or integration and E2E as well? Coverage targets?
- **CI/CD**: Where does the code run in production? How is it deployed today (or how should it be)?
- **Security**: Any authentication, authorization, or compliance requirements (GDPR, SOC2, HIPAA)?

Push back on vague answers: "< 1 second" is fine; "fast" is not.

### Phase 5 — Constraints
- What is the timeline for a first usable version?
- How many engineers are working on this?
- Are there any infrastructure or budget constraints?
- Are there existing systems this must integrate with or not break?

### Phase 6 — Out of Scope
- What are we explicitly NOT building in this version?
- Is there a feature that users will ask for that we've decided to defer?

## Priority framework for TODOs

When seeding `docs/wiki/todos.md`, assign priorities using this framework:

- **P0** — required for the product to be usable at all (auth, core data model, primary user action)
- **P1** — core features that make the product useful for its stated purpose
- **P2** — quality-of-life improvements, secondary features, polish
- **P3** — nice-to-have, post-launch ideas, future scope

Ask the user to confirm priorities after you've assigned them: "I've marked auth as P0 and the export feature as P2. Does that match your priorities?"

## After the interview

1. Read back the full transcript and ask: "Is this accurate? Anything to add, remove, or change?"
2. Once the user confirms, **ingest**:
   - Set the transcript's status to `ingested` in `docs/raw/index.md`.
   - Write a summary page at `docs/wiki/summaries/<same-slug>.md`.
   - Rewrite `docs/wiki/requirements.md` from the transcript, preserving the exact section structure (Vision, User Stories, Functional Requirements, Non-Functional, Constraints, Out of Scope). Set `status: approved` in frontmatter.
   - Create one `docs/wiki/entities/<feature-slug>.md` stub per functional-requirements feature area. Use a slug that matches the feature name in requirements (e.g., `user-auth`, `payment-flow`). Set `status: draft`.
   - Seed `docs/wiki/todos.md` with one row per feature stub, priority assigned by the framework above. Present the list and ask the user to confirm or reorder.
   - Update `docs/wiki/index.md` to list new entity pages.
   - Append to `docs/wiki/log.md`: `## [YYYY-MM-DD] ingest | interview: <slug>`.

Never edit the transcript after it's written — it's a raw source. All refinement goes into the wiki pages.
