---
name: interview
description: Grill-me Q&A that defines a feature, a plan or the requirements — one question at a time, each with a recommended answer, resolving dependencies first; streams the transcript to docs/raw/interviews/ question by question and answer by answer, then updates the affected wiki pages.
argument-hint: [topic — e.g. "the auth flow" | "fill requirements" | "stress-test the sync plan"]
type: command
---

# /project:interview

**Argument:** `$ARGUMENTS`

The argument is the **scope** — a feature, area or question (`the auth flow`, `fill non-functional requirements`, `stress-test the offline sync plan`). It becomes the scope line and the transcript slug. If it names an entity with a page, read that page first so you refine rather than restart it. Empty → infer the scope from `docs/wiki/todos.md` and `requirements.md § Open questions`, and confirm it before opening the transcript.

You grill the human until you reach shared understanding, walking each branch of the decision tree and **always offering your recommended answer** so they react instead of generating from scratch. Use it after `/project:init`, for a new feature, or whenever the human wants a plan stress-tested.

## Operating rules

1. **One question at a time** — never bundled, never multi-part.
2. **Every question carries your recommendation:** "I'd say <X>, because <reason>. Does that hold?"
3. **Read instead of asking** when the codebase or wiki can answer.
4. **Resolve dependencies before broadening.** If A decides B and C, finish A first.
5. **Surface contradictions** with the wiki or an earlier answer the moment they appear.
6. **Don't stop early.** Cover users, behavior, non-functional constraints (performance, security, observability, deployment — the ones projects skip and pay for), failure modes, edge cases and out-of-scope. The human says when to stop.
7. **Stream the transcript.** It is the source of truth, not your memory: write each question to disk **before** asking it, and each answer **immediately** after it arrives — before processing it. If the session ends mid-interview, what is on disk is what we have.

## Preconditions

A clean working tree — the transcript and wiki updates land as tracked files. Dirty → `human-checkpoint`.

## Procedure

1. **Sync develop** with the guarded block in `.agents/skills/feature-branching/sync-develop.md` (its stop conditions apply), so you read a current wiki.

2. **Frame the scope.** Read `docs/wiki/requirements.md` and the relevant entity pages, state the scope in one line, and confirm it. Slug it (`the auth flow` → `auth-flow`).

3. **Open the transcript before the first question:** `docs/raw/interviews/YYYY-MM-DD-<slug>.md`, with this frontmatter and a one-paragraph framing:

   ```yaml
   ---
   name: <slug>
   description: <one line>
   type: raw-transcript
   updated: YYYY-MM-DD
   status: draft
   ---
   ```

   It lives in `docs/raw/`, so it is immutable (rule 11): append only, never edit a prior answer — a correction is a new follow-up Q+A.

4. **Loop, with a disk write between every step:**

   a. Append `## Q<n>. <topic>` with the question, your recommendation and its rationale. Save.
   b. Ask — `AskUserQuestion` for 2–4 discrete options, plain text otherwise.
   c. Append the response verbatim under `**A:**`. Save.
   d. Only now process it: list the questions it unblocked and pick the next one.

   **Topics**, dependencies first:
   - **Who** uses it → `## Users`, seeds `## User stories`
   - **What** it must do, per user, in priority order → `## User stories`, `## Functional requirements`
   - **What it must not do** → `## Out of scope`
   - **When** it runs — triggers, schedules, latency budgets → non-functional Performance
   - **Where** state lives, and durability → architecture `## Data`
   - **External services** → architecture `## External services`
   - **How it fails** — recoverable or not, what the user sees → non-functional Reliability, entity failure cases
   - **Security, compliance, observability** → the matching non-functional items
   - **The smallest first slice** → the first todos
   - **Test framework, test command, deployment target** → architecture `## Testing strategy`, `## Deployment`

5. **Stop** when the human says so, every branch has a concrete answer, and an entity has Behavior cases sharp enough to test (`spec-writing` skill).

## After the interview

1. **Confirm scope coverage with the human, then ingest the transcript** into every affected page:
   - `requirements.md` — `## Vision`, `## Users`, `## User stories` (`- As a <user type>, I want <capability>, so that <benefit>.` with Acceptance and `Maps to:`), `## Functional requirements` (each linked to its entity), `## Non-functional requirements` (numbers where known), `## Out of scope`, `## Open questions`.
   - `entities/<slug>.md` — created or updated, with Behavior cases.
   - `architecture.md` — the sections the answers touched. A change to the `## Layers` table is an ADR and re-runs `/project:init` step 5b. `<TBD>` only for what was genuinely not discussed.
   - `decisions/` — an ADR per non-trivial choice (`decision-recording` skill).
   - `todos.md` — the work the interview implies.
2. **Check structure** with the `wiki-update` skill: links, frontmatter, entity layout.
3. **Log, commit and push** per [`log-and-commit.md`](../skills/feature-branching/log-and-commit.md) — kind `interview`, fields `Transcript: [YYYY-MM-DD-<slug>](../raw/interviews/YYYY-MM-DD-<slug>.md)`, `Updated: <pages>`, `New todos: <count>`, `ADRs: <count>`. Stage `docs/wiki/` and `docs/raw/interviews/`; subject `docs(wiki): interview — <slug>`.
4. **Recommend the next step** — usually `/project:work`.
