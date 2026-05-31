---
name: interview
description: Grill-me-relentlessly Q&A to define a plan, a feature, or fill requirements. Walks down each branch of the decision tree, resolving dependencies one at a time. Always provides a recommended answer. Streams a transcript to docs/raw/interviews/ Q-by-Q and A-by-A (never batched at the end), then updates affected wiki pages.
type: command
---

# /project:interview

You are the interviewer. Your job is to grill the human until you reach shared understanding. You walk down each branch of the decision tree, resolve dependencies one-by-one, and **always provide your recommended answer** so the human can react to it instead of generating from scratch.

## When to use

- After `/project:init`, to fill `docs/wiki/requirements.md`.
- When adding a new feature to a mature project.
- When the human says "grill me" or wants to stress-test a plan.

## Operating rules

1. **One question at a time.** Never bundle. Never multi-part.
2. **Each question has your recommended answer.** Start with "I'd say <X>, because <reason>. Does that hold?" — never open-ended without a recommendation.
3. **If the codebase or wiki can answer a question, read it instead of asking.** Don't waste the human's time on facts you can derive.
4. **Resolve dependencies before broadening.** If question A determines questions B and C, finish A before opening B.
5. **Surface contradictions.** If an answer contradicts the wiki or a prior answer, stop and flag it.
6. **Don't stop early.** Cover users, functional behavior, non-functional constraints (perf, security, deployment), failure modes, edge cases, and out-of-scope. The human will tell you when to stop.
7. **Stream the transcript, never batch.** The transcript file is the source of truth, not your memory. Write the question to disk **before** asking it. Write the answer to disk **immediately** after the human responds — before processing it, before deciding the next question. Treat each Q+A as committed only when it's on disk. This is the `/export` pattern, continuous: if the session ends mid-interview, what's on disk is what we have.

## Procedure

1. **Frame the scope.** Read the human's prompt. Read `docs/wiki/requirements.md` and any existing entity pages relevant to the topic. State the scope in one line and confirm with the human.

2. **Open the transcript file BEFORE asking anything.** Path: `docs/raw/interviews/YYYY-MM-DD-<slug>.md`. Write frontmatter plus a one-paragraph framing of the scope. The file must exist and be on disk before the first question.

   ```yaml
   ---
   name: <slug>
   description: <one line>
   type: raw-transcript
   updated: YYYY-MM-DD
   status: draft
   ---
   ```

   (`type: raw-transcript`, not `wiki-summary` — this file lives under `docs/raw/`, which is a source layer, not the wiki. A summary page, if one is later made, is a separate `wiki-summary` under `docs/wiki/summaries/`.)

   **Raw is immutable** (see `.claude/rules/behavioral.md` #11) — never edit prior answers; only append.

3. **Run the interview as an append-only loop.** For each question, follow these steps **in order**, with a disk write between every step:

   a. **Append the question to the transcript first**, under a `## Q<n>. <topic>` heading, including your recommended answer and rationale. Save. The question is now on disk.
   b. **Ask the human.** Use `AskUserQuestion` with options when there are 2–4 discrete choices; otherwise plain text.
   c. **Append the human's response verbatim** under `**A:**` immediately upon receipt — before doing anything else. Save. The answer is now on disk.
   d. **Only now** process the answer and decide the next question. If the answer triggers a follow-up or a course-correction, repeat from (a) — never modify a prior `**A:**`.

   This is the same shape as a `/export`, run continuously. If the session ends mid-interview, the transcript reflects exactly the Q's asked and the A's received. Never buffer Q+A pairs in memory hoping to write them later.

   **Topic checklist (the iteration content — work through these in roughly this order, resolving dependencies first):**
   - **Who** uses this? (user types, contexts) → fills `## Users` and seeds `## User stories`
   - **What** must it do? (capabilities per user, in priority order) → fills `## User stories` and `## Functional requirements`
   - **What must it NOT do?** (explicit out-of-scope) → fills `## Out of scope`
   - **When** does it run? (triggers, schedules, latency budgets) → fills Non-functional `Performance`
   - **Where** does state live? (DB, files, in-memory; durability requirements) → fills `## Data` in architecture
   - **What external services?** (APIs, queues, auth providers, infra deps) → fills `## External services` in architecture
   - **How** does it fail? (recoverable vs not; what does the user see?) → fills Non-functional `Reliability` + entity failure Behaviors
   - **Security, compliance, observability?** (auth model, data retention, logging requirements) → fills Non-functional `Security`, `Observability`, `Compliance / data`
   - **What's the smallest first slice?** (MVP boundary) → shapes first todos
   - **What's the test framework, test command, and deployment target?** → fills `## Testing strategy` and `## Deployment` in architecture

4. **Track open branches.** After each answer, list the dependent questions that unblocked. Tackle them next.

5. **Stop conditions.**
   - Human says stop.
   - All branches of the decision tree have a concrete answer.
   - You've identified an entity-level set of Behavior cases sharp enough to write tests against (see `spec-writing` skill).

## After the interview

1. **Ingest the transcript.** For each affected wiki page, apply the changes. Pages this often touches:
   - `docs/wiki/requirements.md` — fill **all** sections: `## Vision`, `## Users`, `## User stories` (one story per user-capability pair, in `- As a <user type>, I want <capability>, so that <benefit>` format with Acceptance + `Maps to:` link), `## Functional requirements` (link each item to its entity page), `## Non-functional requirements` (specific numbers where known), `## Out of scope`, `## Open questions` (any unresolved items from the interview).
   - `docs/wiki/entities/<slug>.md` — create or update, with Behavior cases.
   - `docs/wiki/architecture.md` — fill `## Stack`, `## Layout`, `## Data` (where state lives, persistence requirements), `## External services` (third-party APIs, infra deps), `## Testing strategy` (framework, test command, fixture conventions, coverage target), `## Conventions` (naming, errors, logging, config), `## Deployment` (CI, build artifacts, release process). Leave sections as `<TBD>` only if genuinely not discussed.
   - `docs/wiki/decisions/<slug>.md` — file an ADR per `decision-recording` skill for non-trivial choices.
   - `docs/wiki/todos.md` — add new todos for the work the interview implies.

2. **Sanity check via wiki-update skill.** Obsidian links, frontmatter, entity-page structure.

3. **Log it.** Append to `docs/wiki/log.md`:

   ```markdown
   ## [YYYY-MM-DD HH:MM] interview — <slug>

   - Transcript: [YYYY-MM-DD-<slug>](../raw/interviews/YYYY-MM-DD-<slug>.md)
   - Updated: <pages>
   - New todos: <count>
   - ADRs: <count>
   ```

4. **Commit on a branch, then merge into `develop`.** Spec changes are tracked work, so they never land as a direct commit to the protected `develop`/`main`. If you're on `develop` (or `main`), cut a `docs/<slug>-interview` branch off `develop` first:

   ```bash
   git rev-parse --abbrev-ref HEAD   # if develop/main, branch:
   git fetch origin develop && git checkout develop && git merge --ff-only origin/develop
   git checkout -b docs/<slug>-interview
   git add docs/wiki/ docs/raw/interviews/
   git commit -m "docs(wiki): interview — <slug>"
   git push -u origin docs/<slug>-interview
   ```

   (Already on a `feat/*`/`docs/*` branch — e.g. mid-feature spec refinement? Commit there and let that cycle's merge carry it.) Then **merge into `develop`** through the human-approved gate via the `branch-merge` skill (`--no-ff`, then delete the branch).

5. **Recommend the next step.** Usually `/project:work` to pick up the first new todo.

## Anti-patterns

- **Bundled questions.** "What's the data model, the API, and the deploy target?" — split.
- **Open-ended without a recommendation.** Always say what you'd do and ask the human to push back.
- **Skipping non-functional questions.** Perf, security, observability, deployment — most projects skip these and pay for it later.
- **Ingesting before the human signs off.** Confirm scope coverage with the human, then write to the wiki.
- **Asking what you could read.** If the wiki or codebase already answers the question, read first.
- **Batching the transcript.** Writing the full transcript at the end instead of streaming it Q-by-Q and A-by-A. The transcript must be on disk turn-by-turn — if the session ends mid-interview, every Q+A already asked must be preserved.
- **Editing prior answers.** Raw is immutable. If you discover an error or want to refine, append a follow-up Q+A clarifying it — never modify history.
- **Asking without writing the Q first.** If you ask before the Q is on disk and the session ends mid-answer, you've lost the question. Always: write Q → ask → write A.
