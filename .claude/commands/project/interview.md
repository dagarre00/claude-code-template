---
name: interview
description: Grill-me-relentlessly Q&A over product logic and gaps — never over the stack. Walks each branch of the decision tree, resolving dependencies one at a time, always with a recommended answer. Streams a transcript to docs/raw/interviews/ Q-by-Q and A-by-A, then updates the wiki and cuts slices.
argument-hint: [topic — e.g. "the sync logic" | "what happens on a duplicate" | "stress-test the idea"]
type: command
---

# /project:interview

**Argument:** `$ARGUMENTS`

The argument is the **scope of the interview** — the feature, area, or question to grill on. It becomes the scope line in step 1 and the transcript slug. If it names an entity that already has a page, read that page first so you refine rather than restart. If empty, infer the scope from `docs/wiki/todos.md` and `## Open questions` in `requirements.md`, then confirm with the human before opening the transcript.

You are the interviewer. Your job is to find the **holes in the logic** before they become holes in the prototype: the cases the human hasn't thought about, the contradictions between two things they said, the "what happens when both of those are true at once". You always offer your recommended answer so they can react instead of generating from scratch.

## Operating rules

1. **One question at a time.** Never bundle. Never multi-part.
2. **Each question carries your recommended answer.** "I'd say <X>, because <reason>. Does that hold?" — never open-ended.
3. **Product only — never plumbing.** Language, framework, storage, config, ports, deployment, testing, monitoring, scaling: not their problem (behavioral rule 6). If a technical question feels necessary, it is almost always a product question in disguise — ask *that* instead. "Should uploads survive a restart?" yes; "SQLite or Postgres?" no.
4. **Hunt gaps, don't collect wishes.** A feature list is the easy part. Spend the interview on: what happens on the empty input, the duplicate, the second user, the interrupted run, the thing arriving twice, the thing never arriving. Those are what sink prototypes.
5. **If the wiki or the code can answer it, read it instead of asking.**
6. **Resolve dependencies before broadening.** If A determines B and C, finish A first.
7. **Surface contradictions immediately.** If an answer contradicts the wiki or an earlier answer, stop and put both to them.
8. **Stream the transcript, never batch.** Write the question to disk **before** asking it; write the answer to disk **immediately** on receipt, before processing it. If the session dies mid-interview, what's on disk is what we have.
9. **Stop when you can cut slices.** The exit condition is not "every question answered" — it's "I can write three to six demonstrable slices" (`slice-writing`). Prototypes learn the rest by running.

## Preconditions

- Working tree clean (the transcript and the wiki updates are tracked files). If dirty: `human-checkpoint`.

## Procedure

1. **Frame the scope.** Read `docs/wiki/requirements.md` and any relevant entity page. State the scope in one line, confirm it, derive the transcript slug (`the sync logic` → `sync-logic`).

1a. **Branch before writing anything** — the transcript is written turn-by-turn, so branching afterwards means the first Q+A already landed on the wrong branch:

   ```bash
   git fetch origin main
   git checkout main && git merge --ff-only origin/main
   git checkout -b docs/interview-<slug>
   ```

   No remote? Branch straight off local `main`. **Already on a `proto/*` branch** whose feature this refines? Stay there.

2. **Open the transcript BEFORE asking anything.** Path: `docs/raw/interviews/YYYY-MM-DD-<slug>.md`. Frontmatter plus a one-paragraph framing:

   ```yaml
   ---
   name: <slug>
   description: <one line>
   type: raw-transcript
   updated: YYYY-MM-DD
   status: draft
   ---
   ```

   **Raw is immutable** (behavioral rule 11) — never edit prior answers; only append.

3. **Run the loop.** Per question, in order, with a disk write between each step:

   a. **Append the question** under `## Q<n>. <topic>`, including your recommended answer and rationale. Save.
   b. **Ask the human.** `AskUserQuestion` when there are 2–4 discrete choices; plain text otherwise.
   c. **Append the answer verbatim** under `**A:**` immediately on receipt. Save.
   d. **Only now** process it and pick the next question. Never modify a prior `**A:**`.

   **Topic checklist — work down it, dependencies first:**
   - **Who operates this, and in what situation?** → `## Users`
   - **What must it do, in priority order?** → `## User stories`, `## Functional requirements`
   - **What must it explicitly not do?** → `## Out of scope` (the most valuable answers in a prototype)
   - **What's the input, really?** — where it comes from, how big, how messy, how often
   - **What's the output, and who reads it?** — the surface where the human sees it working
   - **The gap sweep:** empty input, malformed input, duplicate, concurrent second run, interrupted halfway, dependency unavailable, ran twice by accident. For each: what *should* happen — and is it worth a slice, or does it go straight to `## Shortcuts` as "not handled"?
   - **What state has to survive a restart?** (product question, not storage question)
   - **How will you know it worked?** — the observable check that makes a demonstration meaningful
   - **What's the thinnest version worth seeing run?** → S1
   - **What would make you throw it away?** → what the prototype is actually testing

4. **Track open branches.** After each answer, note which dependent questions unblocked, and take those next.

5. **Stop conditions.** The human says stop; every branch has a concrete answer; or you can cut three to six demonstrable slices.

## After the interview

1. **Ingest the transcript** into the wiki:
   - `docs/wiki/requirements.md` — Vision, Users, User stories (with the acceptance check), Functional requirements, Out of scope, Open questions. Non-functional stays at assumed defaults unless the human gave a number.
   - `docs/wiki/entities/<slug>.md` — create or update, with `## Slices` per `slice-writing`. Every gap the sweep found is either a slice or a declared `## Shortcuts` line — never silently dropped.
   - `docs/wiki/architecture.md` — only if an answer changes a technical assumption you made.
   - `docs/wiki/decisions/<slug>.md` — an ADR for a genuine product fork (`decision-recording`).
   - `docs/wiki/todos.md` — todos for the slices the interview implies.

2. **Sanity check** via `wiki-update` (links, frontmatter, page structure).

3. **Log it:**

   ```markdown
   ## [YYYY-MM-DD HH:MM] interview — <slug>

   - Transcript: [YYYY-MM-DD-<slug>](../raw/interviews/YYYY-MM-DD-<slug>.md)
   - Updated: <pages>
   - Slices cut: <count>
   - Gaps found: <count> (<n> slices, <n> declared shortcuts)
   ```

4. **Commit and push** onto the branch from step 1a (behavioral rule 19):

   ```bash
   git add docs/wiki/ docs/raw/interviews/
   git commit -m "docs(wiki): interview — <slug>"
   git push -u origin "$(git branch --show-current)"
   ```

   Verify with `git branch --show-current` that you're not on `main`. If you are, you skipped step 1a — branch now (the changes come along) and commit there.

5. **Merge or continue.** If step 1a created a `docs/interview-<slug>` branch, offer to merge it to `main` (`feature-branching`) — an interview has nothing to demonstrate, so the human's "yes, that's the shape" is the gate. If you stayed on a `proto/*` branch, leave it there.

6. **Recommend the next step** — usually `/project:work` on the first new slice.

## Anti-patterns

- **Asking about the stack.** Workflow violation (behavioral rule 6). Decide it yourself.
- **Bundled questions.** Split them.
- **Open-ended without a recommendation.** Always say what you'd do and invite pushback.
- **Collecting features instead of hunting gaps.** The feature list is the easy half; the edge cases are why prototypes get thrown away.
- **Interviewing to exhaustion.** Stop when you can cut slices. The prototype answers the rest by running.
- **Batching the transcript** or **asking before the Q is on disk.** Write Q → ask → write A.
- **Editing prior answers.** Raw is immutable — append a clarifying follow-up instead.
