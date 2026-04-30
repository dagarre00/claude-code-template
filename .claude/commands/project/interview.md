---
name: project-interview
description: Guided requirements Q&A. Writes a transcript to docs/raw/interviews/, then ingests it into docs/wiki/requirements.md.
type: command
---

Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask the questions one at a time.

If a question can be answered by exploring the codebase, explore the codebase instead.

Conduct the requirements interview **inline in the main context** (no sub-agent).

**First:** invoke `superpowers:using-superpowers` to load the full superpowers context before proceeding.

## Protocol

1. Read `docs/wiki/requirements.md` to see what's already captured.
2. If a question can be answered by exploring the codebase, do that instead of asking.
3. Open (create if needed) a transcript file at `docs/raw/interviews/YYYY-MM-DD-<slug>.md`.
4. Ask **ONE question at a time**. For each question, provide your recommended answer. Append each Q and A to the transcript immediately — don't batch.
5. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one.
6. After each phase completes, pause and read back what you captured for confirmation.

## Phases

- **Vision** — What does it do? Who is it for? What problem does it solve?
- **User Stories** — Walk through the user journey end-to-end. Generate `As a [user], I can [action]` bullets.
- **Functional Requirements** — For each story, what must the system do? Group by feature area.
- **Non-Functional** — Stack, performance (push back on vague answers), testing, CI/CD, deployment.
- **Constraints** — Budget, timeline, infrastructure, team size.
- **Out of Scope** — What are we explicitly NOT building in this version?

## After the interview

1. Read back the full transcript and ask: "Is this accurate? Anything to add/remove/change?"
2. Once the user says yes, **ingest**:
   - Set the transcript's status to `ingested` in `docs/raw/index.md`.
   - Write a summary page at `docs/wiki/summaries/<same-slug>.md`.
   - Rewrite `docs/wiki/requirements.md` from the transcript, preserving the exact section structure (Vision, User Stories, Functional Requirements, Non-Functional, Constraints, Out of Scope). Set `status: approved` in frontmatter.
   - Create one `docs/wiki/entities/<feature-slug>.md` stub per functional-requirements feature area.
   - Seed `docs/wiki/todos.md` with a prioritized TODO row per feature — user confirms priorities.
   - Update `docs/wiki/index.md` to list new entity pages.
   - Append to `docs/wiki/log.md`: `## [YYYY-MM-DD] ingest | interview: <slug>`.

3. **Bootstrap the template into a real project** — this is the moment the generic template files become project-specific. Follow the `## Template → Project bootstrap` checklist in `CLAUDE.md`:
   - Specialize `CLAUDE.md` (intro paragraph + `## Project context` section).
   - Specialize `HUMAN.md` and `SETUP.md`.
   - Append project conventions to `tester.md` and `implementer.md` (or note that none are needed).
   - Verify `code-style` and `git-conventions` skills' linked architecture page now has real content.
   - Clear example gotchas in `docs/wiki/gotchas.md`.
   - Create a project-specific `README.md`.
   - Commit as `chore: bootstrap template for <project-name>`.

Skipping this step leaves agents reading template-generic instructions — they will produce template-generic code. **Do not skip.**

Never edit the transcript after it's written — it's a raw source. All refinement goes into the wiki pages.
