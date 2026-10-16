---
description: Grill-me Q&A that defines a feature, a plan or the requirements — one question at a time, each with a recommended answer, resolving dependencies first; streams the transcript to docs/raw/interviews/ question by question and answer by answer, then updates the affected wiki pages.
argument-hint: '[topic — e.g. "the auth flow" | "fill requirements" | "stress-test the sync plan"]'
disable-model-invocation: true
---

# /project:interview

**Argument:** `$ARGUMENTS`

The argument sets the **scope** (a feature, area, or question) and the transcript slug. If it names an existing entity page, read that page first so you refine rather than restart it. Empty → infer scope from `docs/wiki/todos.md` and `requirements.md § Open questions`, and confirm before opening the transcript.

## State at invocation

Branch: !`git branch --show-current`

```!
git status --short
```

Grill the human one question at a time, walking each branch of the decision tree and **always offering a recommended answer**.

## Operating rules

1. **One question at a time** — never bundled or multi-part.
2. **Every question carries a recommendation:** `"I'd say <X>, because <reason>. Does that hold?"`
3. **Read instead of asking** whenever the codebase or wiki already answers it.
4. **Resolve dependencies first** (if A decides B and C, settle A first).
5. **Surface contradictions** with the wiki or an earlier answer immediately.
6. **Cover the whole tree** — users, behavior, non-functional constraints (performance, security, observability, deployment), failure modes, edge cases, and out-of-scope.
7. **Stream the transcript to disk:** write each question **before** asking it and each answer **immediately** upon receipt, before processing the next question.

## Preconditions

A clean working tree (dirty → `human-checkpoint`).

## Procedure

1. **Sync develop** via [`sync-develop.md`](../../skills/feature-branching/sync-develop.md).
2. **Frame the scope:** read `docs/wiki/requirements.md` and relevant entity pages, state the scope in one line, confirm it, and derive `<slug>`.
3. **Open the transcript before the first question** at `docs/raw/interviews/YYYY-MM-DD-<slug>.md` (append `-2`, `-3` on same-day collision; append-only per rule 11):

   ```yaml
   ---
   name: <slug>
   description: <one line>
   type: raw-transcript
   updated: YYYY-MM-DD
   status: draft
   ---
   ```

4. **Loop with a disk write at every step:**
   - Append `## Q<n>. <topic>` with the question, recommendation, and rationale → save.
   - Ask via `AskUserQuestion` (for 2–4 discrete options, recommendation first) or plain text.
   - Append the response verbatim under `**A:**` → save.
   - Process the response and pick the next question across these topics (dependencies first):
     - **Who** uses it → `## Users`, `## User stories`
     - **What** it must do (prioritized) → `## User stories`, `## Functional requirements`
     - **What it must not do** → `## Out of scope`
     - **When** it runs (triggers, latency budgets) → non-functional Performance
     - **Where** state lives and durability → `architecture.md § Data`
     - **External services** → `architecture.md § External services`
     - **How it fails** → non-functional Reliability, entity error cases
     - **Security, compliance, observability** → `architecture.md § Security` and `§ Observability`
     - **Smallest first slice** → initial todos
     - **Test framework/command and deployment** → `architecture.md § Testing strategy`, `§ Deployment`, `§ Environments`
5. **Stop** when the human says so, all branches have concrete answers, and the target entity has testable Behavior cases (`spec-writing`).

## After the interview

1. **Confirm coverage and update affected wiki pages:**
   - `requirements.md` (`## Vision`, `## Users`, `## User stories`, `## Functional requirements`, `## Non-functional requirements`, `## Out of scope`, `## Open questions`).
   - `entities/<slug>.md` (or `[infra]` `concepts/<slug>.md`) with Behavior cases (`spec-writing`).
   - `architecture.md` (if `## Layers` changes, file an ADR and re-run `/project:init` step 5b).
   - `decisions/` (`decision-recording`) and `todos.md`.
2. **Validate structure** per `wiki-update` (frontmatter, links, entity layout).
3. **Log, commit and push** per [`log-and-commit.md`](../../skills/feature-branching/log-and-commit.md) — kind `interview`, fields `Transcript: [YYYY-MM-DD-<slug>](../raw/interviews/YYYY-MM-DD-<slug>.md)`, `Updated: <pages>`, `New todos: <count>`, `ADRs: <count>`. Stage `docs/wiki/` and `docs/raw/interviews/`; subject `docs(wiki): interview — <slug>`.
4. **Recommend next step** (usually `/project:work`).
