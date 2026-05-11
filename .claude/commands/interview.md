---
name: interview
description: Grill-me-relentlessly Q&A to define a plan, a feature, or fill requirements. Walks down each branch of the decision tree, resolving dependencies one at a time. Always provides a recommended answer. Writes a transcript to docs/raw/interviews/ and updates affected wiki pages.
type: command
---

# /interview

You are the interviewer. Your job is to grill the human until you reach shared understanding. You walk down each branch of the decision tree, resolve dependencies one-by-one, and **always provide your recommended answer** so the human can react to it instead of generating from scratch.

## When to use

- After `/init`, to fill `docs/wiki/requirements.md`.
- When adding a new feature to a mature project.
- When the human says "grill me" or wants to stress-test a plan.

## Operating rules

1. **One question at a time.** Never bundle. Never multi-part.
2. **Each question has your recommended answer.** Start with "I'd say <X>, because <reason>. Does that hold?" — never open-ended without a recommendation.
3. **If the codebase or wiki can answer a question, read it instead of asking.** Don't waste the human's time on facts you can derive.
4. **Resolve dependencies before broadening.** If question A determines questions B and C, finish A before opening B.
5. **Surface contradictions.** If an answer contradicts the wiki or a prior answer, stop and flag it.
6. **Don't stop early.** Cover users, functional behavior, non-functional constraints (perf, security, deployment), failure modes, edge cases, and out-of-scope. The human will tell you when to stop.

## Procedure

1. **Frame the scope.** Read the human's prompt. Read `docs/wiki/requirements.md` and any existing entity pages relevant to the topic. State the scope in one line and confirm with the human.

2. **Open a transcript file:** `docs/raw/interviews/YYYY-MM-DD-<slug>.md` with frontmatter:
   ```yaml
   ---
   name: <slug>
   description: <one line>
   type: wiki-summary
   updated: YYYY-MM-DD
   status: draft
   ---
   ```
   Append each Q+A as you go. **Raw is immutable** — never edit prior answers, only append.

3. **Ask questions, one at a time, in this rough order:**
   - **Who** uses this? (user types, contexts)
   - **What** must it do? (capabilities, in priority order)
   - **What must it NOT do?** (explicit out-of-scope)
   - **When** does it run? (triggers, schedules, latency budgets)
   - **Where** does state live? (DB, files, in-memory; durability requirements)
   - **How** does it fail? (recoverable vs not; what does the user see?)
   - **What's the smallest first slice?** (MVP boundary)
   - **What's the test command and the deployment target?**

   Use `AskUserQuestion` with options when there are 2–4 discrete choices. Otherwise plain text.

4. **Track open branches.** After each answer, list the dependent questions that unblocked. Tackle them next.

5. **Stop conditions.**
   - Human says stop.
   - All branches of the decision tree have a concrete answer.
   - You've identified an entity-level set of Behavior cases sharp enough to write tests against (see `spec-writing` skill).

## After the interview

1. **Ingest the transcript.** For each affected wiki page, apply the changes. Pages this often touches:
   - `docs/wiki/requirements.md` — update vision/users/functional/non-functional.
   - `docs/wiki/entities/<slug>.md` — create or update, with Behavior cases.
   - `docs/wiki/architecture.md` — record any new stack/tooling choices.
   - `docs/wiki/decisions/<slug>.md` — file an ADR per `decision-recording` skill for non-trivial choices.
   - `docs/wiki/todos.md` — add new todos for the work the interview implies.

2. **Sanity check via wiki-update skill.** Obsidian links, frontmatter, entity-page structure.

3. **Log it.** Append to `docs/wiki/log.md`:
   ```markdown
   ## [YYYY-MM-DD HH:MM] interview — <slug>
   - Transcript: [[summaries/YYYY-MM-DD-<slug>]] (or embedded in raw)
   - Updated: <pages>
   - New todos: <count>
   - ADRs: <count>
   ```

4. **Recommend the next step.** Usually `/work` to pick up the first new todo.

## Anti-patterns

- **Bundled questions.** "What's the data model, the API, and the deploy target?" — split.
- **Open-ended without a recommendation.** Always say what you'd do and ask the human to push back.
- **Skipping non-functional questions.** Perf, security, observability, deployment — most projects skip these and pay for it later.
- **Ingesting before the human signs off.** Confirm scope coverage with the human, then write to the wiki.
- **Asking what you could read.** If the wiki or codebase already answers the question, read first.
