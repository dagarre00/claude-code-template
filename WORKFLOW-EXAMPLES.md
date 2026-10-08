# Workflow examples — what a conductor session looks like

This guide is for the **human** running the workflow. It walks one made-up project from an empty folder to its first merged feature, so you can see what each `/project:*` command does, where it stops to ask you, and what it leaves in git.

Everything below is **illustrative**: the project, the answers, the hashes and the timings are invented. The steps, the file paths, the commit subjects and the stopping points follow the commands in `.claude/commands/project/` and the skills they load. When the two disagree, the command files win.

**Reading the transcripts:**

- `>` is what you type.
- `●` is the conductor (the main Claude Code session) talking or acting.
- `⎿` is a tool result or a subagent's report, shortened.
- `[ask]` is a question the conductor puts to you, usually as a pick-one menu.

**The example project:** *Linkshelf*, a small HTTP service for saving and tagging bookmarks. Python, FastAPI and SQLite.

---

## Contents

1. [The 30-second model](#1-the-30-second-model)
2. [Session 1 — `/project:init`](#2-session-1--projectinit)
3. [Session 2 — `/project:interview`](#3-session-2--projectinterview)
4. [Session 3 — `/project:work`, the default mode](#4-session-3--projectwork-the-default-mode)
5. [Session 4 — `/project:work fast` on a complex todo](#5-session-4--projectwork-fast-on-a-complex-todo)
6. [Session 5 — `/project:work handoff`](#6-session-5--projectwork-handoff)
7. [When a fast run ends early](#7-when-a-fast-run-ends-early)
8. [Your part — a cheat sheet](#8-your-part--a-cheat-sheet)

---

## 1. The 30-second model

```
        you
         │  /project:work, answers, PR merges
         ▼
   ┌───────────┐  brief (task, inputs, scope, return)   ┌────────────────┐
   │ conductor │ ─────────────────────────────────────▶ │  role (subagent│
   │ main      │ ◀───────────────────────────────────── │  or handoff)   │
   │ session   │        report + files in the tree      └────────────────┘
   └───────────┘
         │  verifies, commits, pushes, logs, opens PRs
         ▼
   git: develop ◀── feat/<slug> (one commit per Behavior case)
```

- **The wiki is the spec.** `docs/wiki/entities/<slug>.md` lists **Behavior cases** (`B1`, `B2`, …). Each case becomes one failing test, then one commit.
- **The conductor writes no code.** It dispatches roles (`planner`, `plan-adversary`, `developer`, `adversary`, `triage`), checks what each one changed, and owns every commit.
- **Reviewers only raise findings.** Each finding gets a written disposition, and that disposition is committed.
- **You decide** genuine forks, risky operations, `critical`/`major` findings and merges.

A normal project's lifecycle:

```
/project:init  →  /project:interview <feature>  →  /project:work  (repeat)  →  you merge the PR
                                                    │
                     every ~5 cycles  ──────────────┼──▶  /project:review
                     every ~5 cycles / 10 wiki-todos┴──▶  /project:wiki
```

---

## 2. Session 1 — `/project:init`

**When to run it:** once, in a fresh copy of the template (after `rm -rf .git`), or to repair a broken layout.

```
$ git clone --branch develop --single-branch https://github.com/dagarre00/claude-code-template.git linkshelf
$ cd linkshelf && rm -rf .git && claude
```

```
> /project:init

● Step 0 — wiring. 8 roles, 7 commands, 2 rule files, every skill in the map;
  settings.json has both allow rules; .gitignore has all 7 workflow lines.
  Roles loaded, wiring intact.

● Step 0a — role models. These are the shipped pins:

    planner          opus   · xhigh     plan-adversary  sonnet · high
    developer        sonnet · medium    adversary       opus   · high
    triage           sonnet · high      reviewer        opus   · high
    wiki-maintainer  sonnet · medium    researcher      sonnet · medium

  I recommend keeping them: Opus runs the rare, high-stakes reads, and Sonnet
  runs every cycle. Note: on Bedrock, Vertex or Foundry the aliases can
  resolve to older models.

[ask] Change any role's model or effort?
      ▸ Keep the shipped defaults (Recommended)
        Change some roles
> Keep the shipped defaults
```

**What happened so far:** nothing has been written. Model changes would be committed in step 8.

```
● Step 1 — not a git repo. git init -b main, kept the shipped .gitignore,
  committed "chore: initial commit".

[ask] Do you have a remote for origin?
> git@github.com:me/linkshelf.git

● Step 2 — stack detection: no manifest, no source. Blank slate.
● Step 3 — pre-interview scan: requirements.md and architecture.md are still
  template placeholders. Every topic is missing, so I'll ask all 12, one at a
  time. Transcript: docs/raw/interviews/2026-10-01-init.md (open now).
```

### The interview inside init

Each question is written to the transcript **before** it is asked, and each answer **before** it is processed. Every question comes with the conductor's recommendation, so you can react instead of starting from scratch.

```
● Q1. Vision — in one sentence, what does it do and why does it exist?
  My guess from the repo name: "A self-hosted bookmark service that lets one
  person save, tag and find links from any device." Does that hold?

> yes, but it's for a small team, not one person

● Q2. Users — I'd say two types: members (save/search) and an admin
  (invites, deletes). Does a team need more than that?

[ask] User types
      ▸ Member + admin (Recommended)
        Members only, no admin
        Member + admin + read-only guest
> Member + admin (Recommended)

  … Q3 user stories, Q4 out of scope ("no browser extension, no public sharing"),
  Q5 stack …

● Q5. Stack — nothing to detect. For a small team HTTP service I'd recommend
  Python 3.12 + FastAPI + SQLite, managed with uv: one file DB, no server to run.

> fine

● Q6. Tests — pytest, run as `uv run pytest`, so the command sets up its own
  environment and the roles can run that exact line.
> ok

  … Q7 data, Q8 external services (none), Q9 deployment (GitHub Actions + a
  Docker image), Q10 non-functional ("API token auth, 200 ms p95, structured
  logs") … Q11 skipped: no UI surface …

● Q12. Architecture — the four layers mapped to this stack:
    domain          src/linkshelf/domain/
    application     src/linkshelf/application/
    adapters        src/linkshelf/adapters/        (FastAPI routes, SQLite repo)
    infrastructure  src/linkshelf/infrastructure/  (settings, wiring)
    composition root src/linkshelf/main.py
  For a service this size I'd keep all four. Does that hold?
> yes
```

### Scaffolding, a runnable test command and enforced layers

```
● Step 5 — wiki scaffolded from your answers: requirements.md, architecture.md
  (including Security, Observability, Environments), git-conventions.md,
  commands.md, todos.md (3 todos seeded), entities/bookmark.md with B1–B4,
  1 ADR. gotchas.md and wiki-todos.md created empty.

● Step 5a — `uv run pytest` does not run: there is no project yet.

  **Why I'm stopping:** the test command needs a skeleton before /project:work
  can start Red.
  **Options:**
  1. Create the minimum: pyproject.toml (pytest as a dev dependency),
     tests/, src/linkshelf/ — no app code, no placeholder test.
  2. Skip — /project:work will refuse to start until a test command runs.
  **My recommendation:** 1.

> 1

● uv sync … done. `uv run pytest` → "no tests ran" (exit 5, empty suite).
  Runnable. Recorded under commands.md § Test, and allowlisted for the roles as
  Bash(uv run pytest) and PowerShell(uv run pytest).

● Step 5b — architecture check. For Python: import-linter with a `layers`
  contract (`uv run lint-imports`). Confirm?
> yes
● Planted src/linkshelf/domain/_probe.py importing linkshelf.infrastructure:
  lint-imports FAILED, naming that import. Probe deleted: PASSED.
  Recorded in commands.md § Architecture, allowlisted, ADR
  decisions/2026-10-01-clean-architecture.md filed.

● Step 5c — .gitattributes has log.md merge=union; wrote
  .github/workflows/verify.yml (install, pytest, lint-imports on every PR).

● Step 6 — CLAUDE.md: Name, Vision, Stack, Application tests filled.
● Step 7 — log entry `## [2026-10-01 14:02] init`.
● Step 8 — committed "chore(init): scaffold the wiki, a runnable test command
  and the project facts", pushed to main.
● Step 8a — created develop and pushed it.

● Report
  - Stack: Python 3.12 · FastAPI · SQLite · uv. Test command `uv run pytest`,
    verified to run.
  - Architecture: import-linter, proven on a planted violation.
  - Role models: shipped defaults.
  - Pages: 9 created, 0 already present. ADRs: 2.
  - Next: /project:work for the first todo.
```

**Afterwards in git:** `main` has two commits, and `develop` exists and is checked out. `docs/wiki/todos.md` looks like this:

```markdown
## Now (P0 — next)
- [ ] Save a bookmark — entities/bookmark B1–B4
## Next (P1)
- [ ] [complex] API token auth — entities/auth-token
- [ ] Tag bookmarks — entities/bookmark-tags (needs interview)
```

---

## 3. Session 2 — `/project:interview`

**When to run it:** before working a feature whose entity page is missing or vague. `/project:work` stops and sends you here if the cases aren't sharp enough to test.

```
> /project:interview the bookmark tags feature

● Synced develop (ff-only, already up to date).
● Read requirements.md and found no entities/bookmark-tags.md.
  Scope: "How members tag bookmarks and filter by tag." Slug: bookmark-tags.
[ask] Is that the scope?
> yes
● Transcript opened: docs/raw/interviews/2026-10-02-bookmark-tags.md

● Q1. Who tags? I'd say any member can tag any bookmark they can see, because
  the team shares one shelf. Does that hold?
> only the bookmark's owner and admins

● Q2. That makes ownership matter. Today bookmark has no owner field, which
  contradicts entities/bookmark B1 ("saved bookmarks are visible to the team").
  I'd add an owner and keep visibility team-wide. Ownership decides who edits,
  not who sees. OK?
> yes, exactly
```

Q2 shows rule 5 of the interview: **contradictions with the wiki are raised the moment they appear.** It continues:

```
● Q3. Tag format — lowercase, 1–32 chars of [a-z0-9-], normalised on save
  ("Python " → "python"). Reject rather than silently fix anything else?
[ask] Invalid tags
      ▸ Normalise case/whitespace, reject the rest (Recommended)
        Reject anything not already canonical
        Silently strip invalid characters
> Normalise case/whitespace, reject the rest (Recommended)

  … Q4 max tags per bookmark (10), Q5 filter semantics (AND across tags),
  Q6 what happens to tags when a bookmark is deleted, Q7 performance
  ("filter under 200 ms at 50k bookmarks" → an index), Q8 the smallest
  first slice ("add/remove tags only; filtering is a second todo") …

> that's enough, stop

● Coverage: users, behavior, failure modes, perf and first slice are answered;
  observability not discussed (marked <TBD>). OK to ingest?
> ok

● Updated:
  - requirements.md: 2 user stories, 3 functional requirements, 1 NFR
  - entities/bookmark-tags.md (new): B1–B5
  - entities/bookmark.md: owner field, a new B5
  - decisions/2026-10-02-tag-normalisation.md
  - todos.md: +2 (tag add/remove; filter by tags)
● Committed "docs(wiki): interview — bookmark-tags" on develop, pushed.
  Next: /project:work.
```

**What the entity page looks like now** (abridged). This is what the developer builds against:

```markdown
## Behavior
- [ ] B1 — Adding "Python " to a bookmark stores the tag "python".
- [ ] B2 — A tag outside [a-z0-9-]{1,32} after normalising is rejected with 422 and nothing is stored.
- [ ] B3 — An 11th tag on one bookmark is rejected with 422.
- [ ] B4 — A member who does not own the bookmark gets 403 when adding a tag; an admin succeeds.
- [ ] B5 — Removing a tag the bookmark does not have is a no-op returning 204.
```

Note that the interview transcript in `docs/raw/` is **immutable**. If you change your mind later, that becomes a new Q&A in a new interview, never an edit to the old one.

---

## 4. Session 3 — `/project:work`, the default mode

With no mode word, the conductor **asks you at each dispatch** whether to run the role natively or as a handoff file. This example works the top todo, a simple (non-`[complex]`) one.

```
> /project:work

● Preconditions: on develop, tree clean, 3 todos, `uv run pytest` runs
  (no tests ran — empty suite), test and architecture commands allowlisted.

● Step 1 — fetched origin/develop. Top todo: "Save a bookmark —
  entities/bookmark B1–B4". Not shipped. Entity page exists.
● Step 2 — branched feat/bookmark from develop, pushed.
● Step 3 — open cases: B1–B4, all concrete.
● Step 4 — not [complex], not a batch: no planner.
```

### Step 4a — the brief review (every cycle)

```
[ask] Dispatch plan-adversary (read-only) how?
      ▸ Native (Recommended)
        Handoff file
        Native for the rest of this run
        Handoff for the rest of this run
> Native for the rest of this run

● Dispatching plan-adversary. Brief:
    Task: Review the brief for todo "Save a bookmark" before any test exists
    Inputs: todo line verbatim; entity bookmark; cases B1–B4; test command
            `uv run pytest`; branch feat/bookmark
    Scope: read-only
    Return: your report format

  ⎿ plan-adversary: 3 findings
    P1 — blocker — testability — B3 ("a duplicate URL is rejected") needs a
         stored bookmark first; the brief doesn't say whether the test seeds
         it through the API (depends on B1) or a repository fake.
    P2 — risk — testability — B4's "returns the bookmark" names no fields.
    P3 — note — scope — no case covers deleting a bookmark.

● HEAD and tree unchanged (read-only check passed).
```

The conductor sent the reviewer the todo line and IDs and **nothing else**: not its own opinion, and not what it expects. Here is how it disposes of the three findings:

```
● P1 Applied: the brief now says B3's test seeds through the API, since B1
  lands first.
● P2 Applied: B4 returns id, url, title, created_at (from the entity's
  ## Data); added to the todo's brief.
● P3 Rejected: deletion is entity bookmark's later todo, not this cycle's cases.

● Opened the work log entry with the Plan review block, committed alone:
  "docs(bookmark): plan review", pushed. Nothing is tested yet.
```

If a finding had shown that **the spec itself** was wrong (two live readings of a case), it would have been **Escalated** instead. The conductor stops the cycle and recommends `/project:interview`; [section 7](#7-when-a-fast-run-ends-early) shows that path. A `blocker` the conductor disagrees with is never quietly rejected. It comes to you as a checkpoint.

> **Why commit before any test?** A simple cycle has no plan file, and a complex cycle's plan is gitignored scratch. So the dispositions exist nowhere else, and a recycled container would lose them (rule 20).

### Steps 5–6 — one developer dispatch per case, then the conductor's proof

```
● Dispatching developer for B1. Brief:
    Task: Implement B1 of entities/bookmark
    Inputs: entity bookmark; case B1; branch feat/bookmark; `uv run pytest`;
            brief additions from plan review
    Scope: src/linkshelf/**, tests/**, docs/wiki/entities/bookmark.md,
           docs/wiki/gotchas.md, docs/wiki/decisions/
    Return: test paths and implementation paths separately, quoted Red,
            final suite + lint-imports output, Follow-ups

  ⎿ developer: B1 done.
    Test paths: tests/bookmark/
    Implementation: src/linkshelf/domain/bookmark.py,
      src/linkshelf/application/save_bookmark.py,
      src/linkshelf/adapters/http/bookmarks.py, …, docs/wiki/entities/bookmark.md
    Red: "AssertionError: expected 201, got 404"
    Suite: 3 passed. lint-imports: 1 contract kept.
    Follow-ups: none

● HEAD unchanged; every changed path is inside scope.
● Proving B1:
    uv run pytest           → 3 passed          (Green)
    uv run lint-imports     → kept              (architecture)
    git commit              "feat(bookmark): B1 — save a bookmark with a valid URL"
    restore everything but tests/bookmark/ from HEAD~1
    uv run pytest           → 3 failed: ModuleNotFoundError linkshelf.application
                              .save_bookmark … AssertionError 404   (Red ✓ —
                              the not-yet-written symbol, not a broken fixture)
    restore HEAD, tree clean
    git push
```

You don't need to do anything here. That loop runs once per case: **B2, B3 and B4** each get a dispatch, a proof, one commit and a push. If Red had been *refuted* (the tests still pass with the implementation removed), the conductor would uncommit the case and send it back with that output. A second failure on the same mechanism stops the cycle under rule 5.

### Steps 7–11 — wiki check, log, PR, report

```
● Step 7 — B1–B4 ticked [x]; ## Implementation and ## Tests match the files;
  todo line removed in B4's commit.
● Step 7a — simple single todo: no diff review. (You can run /project:adversary.)
● Step 8 — completed the work log entry, committed "docs(bookmark): log cycle".
  git log develop..HEAD:
    9e1c… docs(bookmark): log cycle
    77ab… feat(bookmark): B4 — return the saved bookmark's fields
    51f0… feat(bookmark): B3 — reject a duplicate URL with 409
    2c3d… feat(bookmark): B2 — reject an invalid URL with 422
    a1b2… feat(bookmark): B1 — save a bookmark with a valid URL
    0f9e… docs(bookmark): plan review
● Step 9–10 — every case [x]: pre-PR checks pass (suite, lint-imports, wiki
  ships with code, log covers the cycle, no broken wikilinks).
  Opened PR #1 feat/bookmark → develop. Back on develop.

● Report
  - Shipped entities/bookmark B1–B4; PR #1 awaits your merge.
  - Plan review: 3 findings — 2 applied, 1 rejected.
  - Cadence: 1 work cycle since review, 1 since wiki, 0 wiki-todos,
    0 open [adversary]. Nothing due.
  - Next: /project:work → "[complex] API token auth".
```

**Your part:** review PR #1 and merge it with a merge commit (not squash), because the per-case history is the evidence that the TDD loop ran. The next `/project:work` checks that the PR merged before it deletes the branch.

The work log entry this cycle produced looks like this:

```markdown
## [2026-10-02 16:40] work — bookmark

- TODO(s): Save a bookmark — entities/bookmark B1–B4
- Cases: B1, B2, B3, B4
- Branch: feat/bookmark
- Plan review: 3 findings — 2 applied, 0 escalated, 1 rejected
  - P1 blocker testability — Applied: B3's test seeds through the API, after B1.
  - P2 risk testability — Applied: B4 names its returned fields.
  - P3 note scope — Rejected: deletion is a later todo of entity bookmark.
```

---

## 5. Session 4 — `/project:work fast` on a complex todo

`fast` runs every role **natively** and **never waits on you**. Checkpoints that have a recorded default take it, and every other checkpoint ends the run. No rule is relaxed: Red first, the read-only checks and the two-strike tag all still apply. Use it when you want to walk away.

The todo is `[complex]`, so this cycle adds the **planner** (step 4) and the **adversary** diff review (step 7a).

```
> /project:work fast

● Mode: fast — native dispatch, no waiting; checkpoints take their recorded
  defaults or end the run.
● Preconditions OK. PR #1 confirmed merged; feat/bookmark deleted.
● Top todo: "[complex] API token auth — entities/auth-token", cases B1–B6.
  Branched feat/auth-token.

● Step 4 — dispatching planner (opus · xhigh):
    Task: Plan entities/auth-token B1–B6
    Inputs: entity auth-token; cases B1–B6; `uv run pytest`;
            write to .handoff/auth-token-plan.md
  ⎿ planner: 6 steps, one per case; new port TokenStore in application/,
    SQLite adapter, FastAPI dependency; risks: timing-safe compare, clock in tests.
● Sanity check: steps cover B1–B6, no scope drift.

● Step 4a — plan-adversary on .handoff/auth-token-plan.md:
  ⎿ 4 findings
    P1 — blocker — order — step 5 (revocation) is tested before step 3
         (issuing) exists in the SQLite adapter.
    P2 — risk — testability — "token expires after 30 days" needs an
         injectable clock; plan uses datetime.now() directly.
    P3 — risk — security — plan logs the token on 401.
    P4 — note — naming — "TokenStore" vs entity's "token repository".

● P1: I disagree. Step 5 uses the in-memory fake, not the adapter.
  Normally that blocker would be a checkpoint for you. Fast mode default:
  Applied over disagreement. Steps 3 and 5 reordered.
● P2 Applied (Clock port added to the plan). P3 Applied (log the token id,
  never the token). P4 Rejected: the entity page's name wins; the plan now says
  "token repository".
● Committed "docs(auth-token): plan review", pushed.
```

Steps 5 and 6 then run six developer cases, exactly as in Session 3. After them:

```
● Step 7a — adversary (opus · high) on a1f3…HEAD (B1–B6), with entity slug,
  case IDs and test command only — never the plan:
  ⎿ 3 findings
    F1 — major — security — token comparison uses ==, not hmac.compare_digest.
    F2 — minor — correctness — revoking an already revoked token returns 500.
    F3 — nit — naming — `tok` in adapters/sqlite/tokens.py.

● triage (second opinion): F1 holds, fix touches one line + a test;
  F2 holds; F3 nit.
● F1 is major. Normally you choose "fix now or queue". Fast mode default:
  Filed at P1.
● F2 Filed at P2. F3 nit: tallied, not filed.
● Committed "docs(auth-token): adversary round 1 — 3 findings, 0 fixed,
  2 filed, 0 rejected, 1 nit", pushed.

● Steps 8–10 — log cycle committed; every case [x]; PR #2 opened.
```

The report puts **the defaults first**, so nothing fast mode decided for you is hidden:

```
● Report
  Fast mode — defaults taken:
  - P1 blocker order — Applied over disagreement: step 5 used the fake, but
    reordering costs nothing.
  - F1 major security — Filed P1 (fast mode, human unreachable): == instead of
    compare_digest on token check. ← you may want this fixed before merging PR #2
  - Shipped entities/auth-token B1–B6; PR #2 awaits your merge.
  - Cadence: 2 work cycles since review. 2 open [adversary] todos.
```

The same lines appear in a `Fast mode:` field of the cycle's log entry and in the round commit, so you can find them later with `git log --grep="adversary round"`.

**What to do with F1:** if you want it fixed before merging, say so (`fix F1`). That is your approval at that scope. The conductor dispatches the developer for a failing test plus the fix, committed as `fix(auth-token): constant-time token compare — adversary F1`.

---

## 6. Session 5 — `/project:work handoff`

`handoff` writes **every dispatch as a file** that you run yourself in another harness: a fresh Claude Code session, Antigravity (`agy`), or anything else. Use it to run a role on another vendor's model, on a different machine's quota, or just to watch a role work in its own window.

```
> /project:work handoff

● Mode: handoff — every dispatch is a file you run.
● Top todo: "Tag bookmarks — add/remove" (entities/bookmark-tags B1–B5).
  Branched feat/bookmark-tags. Simple: no planner.

● Step 4a — wrote .handoff/bookmark-tags-plan-adversary-handoff.md

  Run it in a FRESH session at C:\…\linkshelf (never this one, never one that
  saw the work). Model: sonnet at high effort, or the nearest you have.

    Claude Code (read-only role, report saved to file):
      claude -p --agent plan-adversary --effort high "Read .handoff/bookmark-tags-plan-adversary-handoff.md and follow it." > .handoff/bookmark-tags-plan-adversary-report.md

    Antigravity:
      agy --add-dir . --effort high -i "Read .handoff/bookmark-tags-plan-adversary-handoff.md and follow it."

  Tell me "done" and which harness and model ran it, or paste its final message.
  I'm touching nothing in the checkout until then.
```

What the file contains:

- **A reading list** (`behavioral.md`, `subagent-contract`, the role file, then the role's skills). This stands in for what Claude Code preloads into a native subagent. `claude --agent` does not load preloaded skills.
- **The limits**, written out (read-only, tools, no git writes). Other harnesses don't enforce them.
- **The same four-line brief** a native dispatch would get.

You run it in a second terminal, then come back:

```
> done — claude code, sonnet 5.5

● Read .handoff/bookmark-tags-plan-adversary-report.md: 2 findings, Checked: line
  present. HEAD and tree unchanged vs baseline. ✓
  … dispositions as usual …

● Step 5 — wrote .handoff/bookmark-tags-developer-handoff.md for B1.
  Write role, so run it interactively so you can answer its permission prompts:
    claude --agent developer --effort medium "Read .handoff/bookmark-tags-developer-handoff.md and follow it."
  It writes its report to .handoff/bookmark-tags-developer-report.md.

> done — agy, gemini

● Report read. HEAD unchanged; changed paths inside scope.
  Proving B1 exactly as for a native case: Green, lint-imports, commit, Red, push.
```

**Points that matter in handoff mode:**

- **The report is never trusted on its own.** The other harness enforced none of the role's limits, so the conductor's before/after comparison of `HEAD` and the tree is the only proof the role stayed in scope. A developer case is still re-proven Green and Red.
- **Don't work in the checkout while a handoff is out.** Both sessions share it.
- **A partial result:** tell *the same* session to continue, once. If it is partial again, that's a checkpoint.
- **Send-backs come to you to paste** into the same session.
- **Reviewer harnesses are recorded.** For example, a round commit says "plan-adversary via agy/gemini", so its finding counts aren't credited to the pinned model.
- The conductor **deletes the handoff/report pair** once the result is accepted or thrown away.

**Mixing modes:** with no mode word, every dispatch asks **Native / Handoff file / … for the rest of this run**. For example, you could run the developer natively and send only the adversary to another vendor's model for a truly independent second opinion.

---

## 7. When a fast run ends early

Fast mode only takes defaults where a wrong guess is cheap to undo. Anywhere a guess could lose work or decide the spec, it **ends the run** and leaves you a question:

```
> /project:work fast

● Mode: fast.
● Top todo: "Filter by tags — entities/bookmark-tags B6–B8". Branched.
● Step 4a — plan-adversary:
  ⎿ P1 — blocker — spec-fidelity — B7 "filter returns bookmarks with the tags"
       can mean ALL tags or ANY tag; the interview transcript says AND but
       requirements.md FR-7 says "any of".

● Run ended — fast mode cannot decide the spec.

  **Why I'm stopping:** B7 has two live readings and the wiki contradicts itself.
  **Context:**
  - interview 2026-10-02-bookmark-tags Q5: AND across tags
  - requirements.md FR-7: "any of the selected tags"
  **Options:**
  1. AND: fix FR-7.
  2. OR: re-interview, since the transcript said AND.
  **My recommendation:** 1, since the transcript is the more recent, explicit answer.
  **What I need from you:** pick one, then re-run /project:work.

  State: feat/bookmark-tags-filter pushed; nothing else committed; no tests yet.
```

Other things that end a fast run include:

- a two-strike failure (it tags `checkpoint-<stamp>` first)
- changes in the tree it didn't make
- a failed `--ff-only` or a rejected push
- a test that looks wrong
- ambiguous test output
- failures already present on `develop`
- a Red the developer can't confirm

It **never** stashes, resets or restores to tidy up. Committed work is pushed, and everything else stays exactly where it was.

---

## 8. Your part — a cheat sheet

### Commands and arguments

| You type | It does |
| --- | --- |
| `/project:init` | Once per project. Answer ~12 questions and approve the skeleton. |
| `/project:init review the legacy files` | Reads those paths first and asks only what they don't answer. |
| `/project:interview <feature>` | One question at a time with a recommendation. Say `stop` when you've had enough. |
| `/project:work` | Top todo. Asks native or handoff at each dispatch. |
| `/project:work the login endpoint` | Works that todo or entity. Stops if nothing matches. |
| `/project:work next 3` / `batch the auth todos` | A batch on one branch (planner + adversary run). |
| `/project:work fast …` | Never waits on you. Defaults are recorded, and the run ends at real forks. |
| `/project:work handoff …` | Every dispatch becomes a file you run elsewhere. |
| `/project:adversary` | Read-only diff review of the current change, any time. |
| `/project:review` | Whole-repo audit. About every 5 work cycles, or before a release. |
| `/project:wiki` / `/project:wiki <path>` | Wiki health pass, or ingest one source. |

### Where you're the decider

| Situation | Default mode | Fast mode |
| --- | --- | --- |
| Native or handoff for a dispatch | asked | native |
| A plan-adversary `blocker` the conductor disputes | asked | Applied |
| A `critical`/`major` adversary finding | asked: fix now or queue | Filed at P0/P1, reported first |
| A design fork the wiki doesn't decide | asked | the recommendation, plus an ADR if one is called for |
| A non-obvious batch | asked | no batch |
| The spec is wrong or ambiguous | asked → `/project:interview` | run ends |
| Two strikes, a foreign dirty tree, a rejected push | asked | run ends |
| **Merging a PR** | **always you** | **always you** |

### What a finished cycle leaves in git

```
feat/<slug>
  docs(<slug>): plan review                 ← brief findings + dispositions (log entry)
  feat(<slug>): B1 — …                      ← test + code + entity tick, proven Red/Green
  feat(<slug>): B2 — …
  docs(<slug>): adversary round 1 — …       ← complex/batched cycles only
  docs(<slug>): log cycle
  → PR to develop (you merge, merge-commit)
```

### Good habits

- **Read the report's first lines.** Escalations, fast-mode defaults and unfixed `critical`/`major` findings always come first.
- **Follow the cadence line.** Every work report ends with counters, and when one fires it names `/project:review` or `/project:wiki`.
- **Don't edit `docs/raw/`.** Change your mind with a new interview instead.
- **One conductor per checkout.** For a parallel session, use `claude --worktree <name>`.
