# Getting Started

A worked walkthrough from a fresh fork of this template to a first shipped feature. Read this once end-to-end before opening Claude Code so the loop makes sense — then refer back as needed.

> If you've never seen the schema, read [`CLAUDE.md`](../CLAUDE.md) first (it's the agent's view of the rules) and [`HUMAN.md`](../HUMAN.md) next (the human's-eye view).

# First-time setup

## 0. One-time setup

```bash
git clone <this-template> my-project
cd my-project
git remote set-url origin <your-new-repo>
```

Optional but recommended:

- Replace `LICENSE` if MIT isn't right for you.
- Open `docs/wiki/` in [Obsidian](https://obsidian.md/) as a vault — that's your read-only-ish view of the agent's memory.
- If you'll deploy via GitHub Actions, rename `.github/workflows/ci.yml.example` to `ci.yml` and customize it for your stack (instructions inside the file).

Then start Claude Code:

```bash
claude
```

## 1. `/project:init` — scaffold the wiki

Inside Claude Code, run:

```
/project:init
```

What this does:

- Verifies the wiki layout in `docs/wiki/`.
- Detects whether the repo has a stack already (language, package files) and seeds `architecture.md#Stack` and `commands.md` with the detection.
- Initializes git if missing.
- Leaves every other section (`Vision`, `Users`, `Personas`, requirements, …) as `<TBD via /project:interview>`.

After `/project:init`, the wiki has the right shape but is mostly empty. That's expected.

## 2. `/project:interview` — define the project

```
/project:interview
```

The agent grills you until the spec is sharp enough to write tests against. Expect to spend 30–60 minutes the first time. The agent asks for:

- **Vision** (one paragraph: problem and audience)
- **Users** (the roles the code knows about)
- **Personas** (optional — skip if your project has one audience; see [requirements.md](wiki/requirements.md))
- **User stories** with explicit acceptance criteria
- **Functional + non-functional requirements**
- **Success metrics** (how you'll know it worked)
- **Risks & assumptions**
- **Out of scope** (the no-go list)

Outputs:

- A transcript in `docs/raw/interviews/YYYY-MM-DD-<slug>.md` (immutable — never edited later).
- Updates to `requirements.md`, `architecture.md`, `glossary.md`, and one `entities/<slug>.md` per major feature.
- Initial entries in `todos.md`.

## 3. `/project:agent-scout` — configure your toolkit

```
/project:agent-scout
```

After the interview fills in real requirements and architecture, run this once to discover which agents and skills your project actually needs. The template ships with a stack-agnostic baseline; `agent-scout` reads your wiki and recommends the gap-fillers — things like `backend-impl`, `database-impl`, `stripe-impl`, or an `auth-impl` skill for the implementer to auto-load when relevant.

What it does:

- Reads `requirements.md`, `architecture.md`, all entity pages, and `todos.md`.
- Applies a signal table: backend API → `backend-impl` skill, named external services → service-specific skills, security-critical requirements → possible `security-reviewer` agent, and so on.
- Produces a prioritized report with trigger descriptions, wiki citations, and procedure outlines for each recommendation.
- **Does not create anything automatically.** It presents the list; you approve what to build. Approved items are created via the `update-skill` / `update-agent` meta skills.

Re-run `/project:agent-scout` after a major `/project:interview` that adds a new stack layer or external service.

## 4. `/project:work` — first feature, TDD-style

```
/project:work
```

`/project:work` picks the top item from `todos.md` (or batches consecutive todos sharing context), opens a `feat/<slug>` branch, and runs the loop:

1. **Planner agent (conditional) — Plan.** If the todo is flagged `[complex]` or a batch of 2+ todos was proposed, `/project:work` dispatches the planner first. It writes a stepwise plan to `.claude/handoff/<slug>-plan.md`. The tester and implementer both read it.
2. **Tester agent — Red.** Reads the matching `entities/<slug>.md#Behavior` cases, writes failing tests, runs them, confirms they fail for the right reason, emits `.claude/handoff/<slug>.json` with `red_confirmed: true`.
3. **Implementer agent — Green.** Refuses to start without the red_confirmed handoff. Writes the minimal code to make tests pass. The `test-first-check` hook blocks code edits on `feat/*` branches if the handoff is missing.
4. **Refactor.** Implementer cleans up while keeping tests green.
5. **Wiki update.** Implementer ticks the entity-page Behavior checklist, updates `completed.md`, appends to `log.md`. Larger wiki cleanup is queued in `wiki-todos.md` for the wiki-maintainer.
6. **Commit.** Conventional commit format (see [git-conventions.md](wiki/git-conventions.md)).

If a step fails twice on the same approach, the **two-strike rule** fires — the agent stops, you `/project:rollback`, and re-spec.

## 5. `/project:review` — every ~5 todos

```
/project:review
```

Runs the `reviewer` agent in a fresh git worktree with no implementer context. It audits code against the wiki and flags drift, missing tests, security/perf concerns. Critical issues block; warnings get queued in `wiki-todos.md`.

This is **not** part of `/project:work` — it's periodic and isolated.

## 6. `/project:wiki-lint` — every few cycles

```
/project:wiki-lint
```

Dispatches the `wiki-maintainer` to process the `wiki-todos.md` queue, find orphans, broken `[[wiki-links]]`, stale claims, and contradictions. File ADRs that emerged during work. Returns the wiki to a clean state.

Run when `wiki-todos.md` is piling up or after a big round of feature work.

# Day-to-day scenarios

Once the project is bootstrapped, you'll cycle through the same handful of workflows. Each scenario below is a worked example.

## Scenario: Adding a new feature

A new user story landed. You want it specified, tested, and shipped.

1. **Define it.** Run `/project:interview`. Tell the agent which feature you want to add. The agent walks you through user stories, acceptance criteria, and Behavior cases. It updates `requirements.md` and creates or extends `docs/wiki/entities/<slug>.md`.
2. **Confirm the todo.** When the interview ends, open `docs/wiki/todos.md`. The new feature should appear as one or more unticked items, e.g.:

   ```markdown
   - [ ] auth-login: reject unknown user
   - [ ] auth-login: issue token on success
   ```

   If it's missing, the interview didn't close the loop — ask the agent to add the todo before moving on.

3. **Run `/project:work`.** It picks the top todo, opens `feat/auth-login`, and dispatches the tester. The tester reads `entities/auth-login.md#Behavior`, writes failing tests, and emits `.claude/handoff/auth-login.json` with `red_confirmed: true`. `/project:work` reruns the test command itself to verify Red.
4. **Implementer takes over.** It reads the handoff, writes the minimum code to turn Red into Green, then refactors. The `test-first-check` hook blocks any production-file edit if the handoff goes missing or is stale.
5. **Wiki updates land in the same commit.** The implementer ticks the Behavior cases on the entity page, moves the todo to `completed.md`, and appends a one-line log entry. The `wiki-drift-check` hook will warn at session end if code changed but no wiki page did — that's your safety net.
6. **Commit.** Conventional commit, e.g. `feat(auth-login): reject unknown user`. See [git-conventions.md](wiki/git-conventions.md).

`/project:work` will dispatch the planner **first** if the todo is tagged `[complex]` or a batch of 2+ todos is being run together. For a single simple todo, planning is skipped — straight to tester.

## Scenario: Adding a complex feature

Some features are too big for the tester to attack directly — they cross files, need careful sequencing, or have non-obvious tradeoffs. Use the planner.

1. **Define it.** `/project:interview` as usual. The Behavior cases on the entity page are still the contract.
2. **Mark the todo `[complex]`.** Edit `docs/wiki/todos.md`:

   ```markdown
   - [ ] [complex] billing-invoices: generate monthly invoice PDF with line items
   ```

   The `[complex]` tag is what `/project:work` keys off to dispatch the planner.

3. **Optional — `/project:plan <slug>` first.** If you want to see and sanity-check the plan before committing branch effort:

   ```
   /project:plan billing-invoices
   ```

   The planner (running on Opus) reads the entity page, the requirements, the gotchas, and surveys similar entities. It writes `.claude/handoff/billing-invoices-plan.md` and reports a summary: goal, approach, step count, top risks, path to the full plan. You can read the plan in Obsidian, ask the agent to revise it, or re-run `/project:plan` to overwrite.

4. **Run `/project:work`.** With `[complex]` set (or a 2+ batch), `/project:work` dispatches the planner (if no plan exists or you want a fresh one), then the tester (which reads both the plan and the Behavior cases), then the implementer (which reads both the plan and the JSON handoff). Same Green/refactor/wiki/commit flow as a simple feature.
5. **Where the plan lives.** `.claude/handoff/<slug>-plan.md`. The directory is gitignored — plans are transient artefacts. The wiki holds the spec (what); the plan is how-to for one cycle.
6. **Two-strike interaction.** If the implementer fails twice on the same mechanism, `/project:work` re-dispatches the planner. The planner reads `attempt >= 2` from the JSON handoff, **overwrites** the prior plan with a different shape, and names both the failed approach and the new one in the `## Approach` section. You never silently retry the same plan.

## Scenario: Batching multiple small todos

When you have several related todos, running them in one cycle is often cheaper than three separate commits.

**Batch when:**

- The todos share the same entity (`auth-login: case A`, `auth-login: case B`, `auth-login: case C`).
- The middle commits would have no standalone meaning (an API handler isn't useful until both its query parser and response serializer exist).
- The Behavior cases are independent enough that one round of Red drives all of them.

**Don't batch when:**

- The todos cross entities — keep entity pages and commits aligned.
- A user might want to revert one without the others — then they need standalone commits.
- The total work is large enough that a single commit becomes hard to review.

**How `/project:work` handles it:**

1. `/project:work` reads the top 1–3 todos. If they share an entity and context, it proposes a batch and asks you to confirm via `human-checkpoint`.
2. You confirm. `/project:work` flags the cycle as a batch and dispatches the planner (any batch of 2+ triggers the planner automatically).
3. Tester writes one set of failing tests covering all cases in the batch. Implementer drives them all Green in one pass, refactoring as it goes.
4. Single commit at the end. Conventional commit scope names the batch, e.g. `feat(auth-login): add rate limiting and lockout (B3, B4, B5)`.
5. The entity page Behavior section is ticked for every case in the batch in the same commit.

## Scenario: Requesting a periodic review

The reviewer is fresh eyes on the codebase. It catches drift the implementer can't see because the implementer wrote both the spec and the code.

**When to fire `/project:review`:**

- Roughly every 5 completed todos.
- Before a release.
- After a non-trivial set of merges to `main`.
- When you suspect the wiki and the code disagree.

**What happens:**

1. `/project:review` creates a fresh git worktree at `../<repo>-review-YYYY-MM-DD` (sibling directory, not inside the repo).
2. Dispatches the reviewer agent **inside the worktree** — no prior implementer context, fresh read of every entity page and the code that implements it.
3. Reviewer runs the test suite itself. Trusts nothing.
4. Findings land in `docs/wiki/decisions/review-YYYY-MM-DD.md` — structured by severity (Critical / Warning / Drift / Missing ADR).
5. Anything cross-page or wiki-shaped also goes into `docs/wiki/wiki-todos.md` for the maintainer.

**Processing the report (back in the main checkout):**

1. Read `docs/wiki/decisions/review-YYYY-MM-DD.md`.
2. For each Critical / Warning, file a TODO in `docs/wiki/todos.md` with priority. These become the next `/project:work` cycles.
3. For each Drift item, append to `docs/wiki/wiki-todos.md` for the next `/project:wiki-lint`.
4. For each Missing ADR, queue an ADR for the next `/project:work` cycle to file via the `decision-recording` skill.
5. Append a log entry summarising counts.

**Worktree cleanup:**

```bash
git worktree remove ../<repo>-review-YYYY-MM-DD
```

`/project:review` does this for you at the end. If something goes wrong and the worktree is left over, run that command yourself.

## Scenario: Filing a hotfix on production code

A bug in shipped behavior needs a fix. Same TDD discipline as a feature — just a `fix/` prefix.

1. **Branch.** `/project:work` opens `fix/<slug>` (not `feat/<slug>`) because the matching entity already exists; you're correcting a regression. The `test-first-check` hook activates the same way on `fix/*`.
2. **Regression test first.** The tester writes a test that **reproduces the bug** — assertion fails on the current code. This becomes a new Behavior case on the entity page, e.g.:

   ```markdown
   ## Behavior

   - [x] rejects unknown user
   - [x] issues token on success
   - [ ] [regression] does not leak password hash in error response ← new
   ```

   Adding the case to the entity page is part of the same commit as the test.

3. **Implementer fixes.** Minimum change to turn the new Red into Green. Existing tests must stay green. Refactor only if it falls out naturally.
4. **Capture the gotcha.** Use the `gotcha-recording` skill — append an entry to `docs/wiki/gotchas.md` so the next agent doesn't recreate the bug:

   ```markdown
   ### Password hash leaked in error payload

   **When:** error responses serialized from the User model
   **Symptom:** debug logs and HTTP 500 bodies contained `password_hash`
   **Cause:** default `to_dict()` included all columns; error serializer used it without an allowlist
   **Fix:** explicit allowlist serializer; never round-trip the full model on errors
   **Related:** [[entities/auth-login]]
   ```

5. **Commit.** Conventional commit `fix(auth-login): redact password hash from error responses`. The Behavior tick, the gotcha entry, and the code all ship in the same commit.

## Scenario: Recovering from a failed implementation attempt (two-strike rule)

Sometimes an approach just doesn't work. The two-strike rule keeps you from grinding.

1. **First failure.** Implementer's attempt doesn't make Red turn Green (or it makes the new tests pass but breaks existing tests it can't reconcile). `/project:work` increments `attempt` to `2` in `.claude/handoff/<slug>.json` and re-dispatches the tester (whose tests may also need a rethink) and then the implementer.
2. **Second failure.** Implementer reads `attempt: 2` from the handoff, stops, and calls `human-checkpoint`. It does **not** try a third time on the same approach.
3. **Your decision.** The agent presents the two attempts, what failed, and at least one fundamentally different approach to consider. Options:
   - **Roll back and re-spec.** `/project:checkpoint` (to preserve the failed attempts for postmortem), then `/project:rollback` to the last green checkpoint, then `/project:interview` to sharpen the Behavior cases. This is the right call when the spec was too vague to test against.
   - **Authorize a different approach.** If the spec is fine but the implementation strategy was wrong, tell the agent which alternative to take. If the todo is `[complex]`, `/project:work` will re-dispatch the planner with the failed-attempt context; the planner overwrites the prior plan with the new shape.

4. **Checkpoint and rollback mechanics.**

   ```bash
   # Before retrying — preserve the failed branch state under a tag
   /project:checkpoint
   # Produces e.g. checkpoint-20260516T184500Z, pushed to origin

   # Roll back to an earlier checkpoint
   /project:rollback
   # Lists checkpoint-* tags, you pick one, it runs `git reset --hard <tag>` on the current branch
   ```

   `/project:rollback` is destructive on the current branch. The command asks for confirmation and shows what it will discard.

## Scenario: Adding a new skill mid-project

When the agent realises a procedural gap, it shouldn't bury that knowledge in an agent prompt — it should ship a new skill.

1. **The agent notices.** During `/project:work`, the implementer hits a recurring task (e.g. "this is the third time I've had to author a Postgres migration; there's no skill for it"). It pauses via `human-checkpoint` and proposes creating one via the `update-skill` meta skill.
2. **You approve.** Confirm the skill name and one-line description, or push back if the gap is really a wiki update.
3. **The agent writes it.** `update-skill` produces `.claude/skills/database-migrations.md` with frontmatter (precise `description` so future tasks auto-load it) and a procedural body — _how_ to do migrations in this project, not _what_ migrations are.
4. **It auto-loads next time.** On the next task that matches the skill's `description` trigger, the implementer (or whichever agent) loads the skill without you having to ask. This is the progressive-disclosure principle in action.

The same pattern applies to `update-agent`, `update-command`, and `update-hook` when the gap is bigger than a procedure.

## Scenario: Ingesting external documents into the wiki

A new spec PDF, an article, or research output needs to enter the agent's knowledge base.

1. **Drop the raw source.** Put the file under `docs/raw/` (e.g. `docs/raw/specs/payments-v2.pdf`). From this moment it's **immutable** — no agent will ever edit it. New versions get new filenames.
2. **Ingest.**
   - **File mode** for a document you already have:

     ```
     /project:wiki-ingest docs/raw/specs/payments-v2.pdf
     ```

     The agent reads the file (PDFs page by page), derives a slug, and writes `docs/wiki/summaries/payments-v2.md` — frontmatter, summary, key claims, open questions, contradictions with existing pages.

   - **Research mode** when you don't have a document yet:

     ```
     /project:wiki-ingest search for exchange rate APIs with sub-cent precision
     ```

     `/project:wiki-ingest` dispatches the `researcher` agent, which searches and fetches, then writes `docs/raw/research/<slug>.md`. The ingest command then produces the matching `summaries/<slug>.md`.

3. **Cross-linking.** The ingest grep's the wiki for related terms and adds `[[summaries/<slug>]]` references on overlapping entity and concept pages. Contradictions get flagged with `> [!contradiction]` in both pages — never silently resolved.
4. **`/project:wiki-lint` afterwards.** Heavy ingest tends to create new cross-references and the occasional orphan. Run `/project:wiki-lint` when several summaries have landed.

## Scenario: Checking project state mid-session

`/project:status` is your "where am I" command — read-only, one screen.

```
/project:status
```

It prints:

- Current branch and HEAD short SHA.
- Uncommitted summary (counts; full list only if < 10 items).
- Last 5 commits.
- Top 5 unticked todos.
- Last 3 log entries.
- Last 3 checkpoint tags.
- Count of pending `wiki-todos.md` lines (suggests `/project:wiki-lint` if > 10).

Run it at session start, after a long break, or before deciding whether to `/project:work`, `/project:review`, `/project:wiki-lint`, or roll back. The bottom of the report suggests the next action based on state.

# Quick reference

## Command → when to use

| Command                | When                                                                            |
| ---------------------- | ------------------------------------------------------------------------------- |
| `/project:init`        | Once at project start                                                           |
| `/project:interview`   | First time; whenever adding a new feature                                       |
| `/project:agent-scout` | Once after init+interview; again after a major feature adds a new stack layer   |
| `/project:work`        | Main loop — most days you live in `/project:work`                               |
| `/project:plan <slug>` | Before `/project:work` if you want to inspect a plan, or for estimation         |
| `/project:review`      | Periodic (every ~5 todos), before a release, after several merges               |
| `/project:wiki-lint`   | When `wiki-todos.md` piles up or after heavy ingest                             |
| `/project:wiki-ingest` | When you have a new external doc, or to commission web research                 |
| `/project:checkpoint`  | Before risky operations (large refactor, destructive command, two-strike retry) |
| `/project:rollback`    | After a failed attempt — pick a checkpoint to reset to                          |
| `/project:status`      | Session start, after a break, or before deciding what's next                    |

## Where to look when something's wrong

| Symptom                                            | Look at                                                                                        |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Test-first hook blocking edits                     | Check `.claude/handoff/<slug>.json` exists with `red_confirmed: true`                          |
| Wiki-drift warning at session end                  | Update the entity page in the same commit as the code                                          |
| Implementer refusing to start                      | Missing or invalid handoff — see [handoff format](wiki/concepts/handoff-format.md)             |
| Planner refusing to plan                           | Entity page missing or `## Behavior` empty — run `/project:interview` first                    |
| Reviewer claims it's in the wrong dir              | `/project:review` didn't `cd` into the worktree first — re-run, ensure worktree path is passed |
| `wiki-todos.md` is huge                            | Run `/project:wiki-lint`                                                                       |
| Implementer keeps trying the same failing approach | Two-strike rule should fire — check `attempt` in `.claude/handoff/<slug>.json`                 |
| Plan looks wrong                                   | Edit `.claude/handoff/<slug>-plan.md` or re-run `/project:plan <slug>` to overwrite            |

# The mental model in one paragraph

The wiki is the project's source of truth — code that disagrees with it is the bug. You drive `/project:interview` to populate the spec. You run `/project:work` to ship features under TDD, with the planner stepping in for `[complex]` or batched cycles. The agent updates the wiki in the same commit as the code. When in doubt, the agent stops and asks rather than guessing. Hooks back the discipline (test-first, format-on-save, wiki-drift warning). Periodic `/project:review` and `/project:wiki-lint` keep both layers honest.

# Anti-patterns

- **Skipping `/project:interview` on a new feature.** The Behavior cases on entity pages are what produce sharp tests; without them, the TDD loop starves.
- **Editing `docs/wiki/` by hand without telling the agent.** You can, but you'll fight the agent's memory. Prefer asking it to make the change.
- **Editing `docs/raw/` after the fact.** Never. Append new sources instead.
- **Committing on `main`.** Always branch first (`/project:work` handles this).
- **Letting `wiki-todos.md` pile up.** When it's long, run `/project:wiki-lint`.
- **Running the same failed approach a third time.** The two-strike rule exists for a reason — pivot or re-spec.
- **Treating a plan as a spec.** Plans live in `.claude/handoff/` and are transient. The wiki holds the spec. If the plan needs to change, edit the plan; if the contract needs to change, run `/project:interview`.
- **Hand-editing `.claude/handoff/` files.** They're inter-agent state. Re-dispatching the right agent regenerates them safely.

# Related

- [`CLAUDE.md`](../CLAUDE.md) — the schema (agent's view)
- [`HUMAN.md`](../HUMAN.md) — the human's-eye view of the workflow
- [`docs/wiki/git-conventions.md`](wiki/git-conventions.md) — branching and commit format
- [`docs/wiki/commands.md`](wiki/commands.md) — working shell commands
- [`docs/wiki/concepts/handoff-format.md`](wiki/concepts/handoff-format.md) — tester→implementer JSON contract
- [`.claude/agents/planner.md`](../.claude/agents/planner.md) — the planner agent definition
- [`.claude/skills/plan-writing.md`](../.claude/skills/plan-writing.md) — how plans are structured
