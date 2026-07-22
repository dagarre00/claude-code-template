# Getting Started

A worked walkthrough from a fresh fork of this template to a first shipped feature. Read this once end-to-end before opening Claude Code so the loop makes sense — then refer back as needed.

> If you've never seen the schema, read [`CLAUDE.md`](../CLAUDE.md) first (it's the agent's view of the rules) and [`HUMAN.md`](../HUMAN.md) next (the human's-eye view).

# First-time setup

## 0. One-time setup

```bash
git clone <this-template> my-project
cd my-project
rm -rf .git                             # drop the template's history — your project starts fresh
git init -b main                        # optional: /project:init does this for you if you skip it
git remote add origin <your-new-repo>   # optional now; without a remote, pushes are skipped until you add one
```

Erasing `.git` is the intended flow: the template's commit history is about building the template, not your project. Everything that matters carries over as files — the wiki (including the pre-seeded `gotchas.md`), the `.claude/` schema, and the docs all land in your project's own initial commit.

Optional but recommended:

- Replace `LICENSE` if MIT isn't right for you.
- Open `docs/wiki/` in [Obsidian](https://obsidian.md/) as a vault — that's your read-only-ish view of the agent's memory.

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
- **Interviews you inline** — if `requirements.md` and `architecture.md` are empty or missing, `/project:init` runs its own interview pass to fill them. It only asks about topics that are missing or partial; if both files are already fully populated it skips the interview entirely and goes straight to scaffolding.

After `/project:init`, the wiki is fully scaffolded with real content. You do **not** need to run `/project:interview` separately after a fresh init — only use it later when adding a new feature or deepening the spec.

## 2. `/project:interview` — add a feature or deepen the spec

```
/project:interview
```

Run this when requirements change or you're adding a major feature — not as a mandatory step after init. The agent grills you until the spec is sharp enough to write tests against. It asks for:

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
- Updates to `requirements.md`, `architecture.md`, and one `entities/<slug>.md` per major feature.
- Initial entries in `todos.md`.

## 3. `/project:agent-scout` — configure your toolkit

```
/project:agent-scout
```

After the interview fills in real requirements and architecture, run this once to discover which agents and skills your project actually needs. The template ships with a stack-agnostic baseline; `agent-scout` reads your wiki and recommends the gap-fillers — things like `backend-impl`, `database-impl`, `stripe-impl`, or an `auth-impl` skill for the `developer` to auto-load when relevant.

What it does:

- Reads `requirements.md`, `architecture.md`, all entity pages, and `todos.md`.
- Applies a signal table: backend API → `backend-impl` skill, named external services → service-specific skills, security-critical requirements → possible `security-reviewer` agent, and so on.
- Produces a prioritized report with trigger descriptions, wiki citations, and procedure outlines for each recommendation.
- **Does not create anything automatically.** It presents the list; you approve what to build. Approved items are created via the `update-toolkit` skill.

Re-run `/project:agent-scout` after a major `/project:interview` that adds a new stack layer or external service.

## 4. `/project:work` — first feature, TDD-style

```
/project:work
```

`/project:work` picks the top item from `todos.md` (or batches consecutive todos sharing context), opens a `feat/<slug>` branch, and dispatches the single `developer` agent through one full cycle:

1. **Plan (conditional).** If the todo is flagged `[complex]` or a batch of 2+ todos was proposed, `/project:work` dispatches the `planner` agent (on Opus) first; it writes a stepwise plan to `.claude/handoff/<slug>-plan.md` (gitignored scratch) that the developer then follows. A single simple todo skips planning.
2. **Red.** The developer reads the matching `entities/<slug>.md#Behavior` cases, writes one failing test per case, runs the suite, and confirms the tests fail for the right reason (missing implementation — not a typo or import error). It marks each case `[ ]` → `[~]`.
3. **Green.** The developer writes the minimal code to make the tests pass.
4. **Refactor.** The developer cleans up while keeping tests green.
5. **Wiki update.** The developer ticks the entity-page Behavior cases `[~]` → `[x]`, updates the Implementation/Tests sections, and appends to `log.md`. Larger cross-page cleanup it can't safely do inline is queued in `wiki-todos.md` for the wiki-maintainer.
6. **Commit.** `/project:work` verifies the suite itself, then makes one bundled conventional commit (code + wiki + log) and pushes it (see [git-conventions.md](wiki/git-conventions.md)).

If a step fails twice on the same approach, the **two-strike rule** fires — the developer stops, you tag a checkpoint and reset, and re-spec.

## 5. `/project:review` — every ~5 todos

```
/project:review
```

Runs the `reviewer` agent in a fresh git worktree with no developer context. It audits code against the wiki and flags drift, missing tests, security/perf concerns. Critical issues block; warnings get queued in `wiki-todos.md`.

This is **not** part of `/project:work` — it's periodic and isolated.

## 6. `/project:wiki-lint` — every few cycles

```
/project:wiki-lint
```

Dispatches the `wiki-maintainer` to process the `wiki-todos.md` queue, find orphans, broken `[[wiki-links]]`, stale claims, and contradictions, and compact `gotchas.md`/`log.md` when they overflow. Returns the wiki to a clean state.

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

3. **Run `/project:work`.** It picks the top todo, opens `feat/auth-login`, and dispatches the `developer`. The developer reads `entities/auth-login.md#Behavior`, writes failing tests, and confirms Red.
4. **The same agent implements.** It writes the minimum code to turn Red into Green, then refactors. There's no handoff to another agent — one developer owns the whole cycle.
5. **Wiki updates land in the same commit.** The developer ticks the Behavior cases on the entity page, checks the todo off in `docs/wiki/todos.md` (shipped work lives in git history — there's no `completed.md`), and appends a one-line log entry. Code changed but no wiki page touched is drift — the same-commit rule is the safety net.
6. **Commit.** `/project:work` makes the bundled conventional commit, e.g. `feat(auth-login): reject unknown user`, and pushes it. See [git-conventions.md](wiki/git-conventions.md).

The developer plans **first** if the todo is tagged `[complex]` or a batch of 2+ todos is being run together. For a single simple todo, planning is skipped — straight to Red.

## Scenario: Adding a complex feature

Some features are too big to attack directly — they cross files, need careful sequencing, or have non-obvious tradeoffs. The `planner` (on Opus) decomposes them before the developer tests.

1. **Define it.** `/project:interview` as usual. The Behavior cases on the entity page are still the contract.
2. **Mark the todo `[complex]`.** Edit `docs/wiki/todos.md`:

   ```markdown
   - [ ] [complex] billing-invoices: generate monthly invoice PDF with line items
   ```

   The `[complex]` tag is what `/project:work` keys off to dispatch the `planner` before testing.

3. **Run `/project:work`.** With `[complex]` set (or a 2+ batch), `/project:work` first dispatches the `planner` (on Opus), which writes a plan (following the `plan-writing` skill) to `.claude/handoff/billing-invoices-plan.md` — goal, approach, ordered steps, risks, out-of-scope. `/project:work` sanity-checks it, then dispatches the `developer`, which reads the plan and drives the same Red → Green → refactor → wiki → commit flow as a simple feature, following the plan's step order.
4. **Where the plan lives.** `.claude/handoff/<slug>-plan.md`. The file is gitignored — plans are transient scratch `/project:work` clears when the cycle is done. The wiki holds the spec (what); the plan is how-to for one cycle. Because it isn't committed, a container recycle loses it — but so does it lose the rest of the uncommitted cycle, so `/project:work` simply restarts the still-open todo and re-dispatches the planner to regenerate the plan from the Behavior cases.
5. **Two-strike interaction.** If the developer fails twice on the same mechanism, it stops, tags a checkpoint, and presents both failed attempts. On an authorized retry, `/project:work` re-dispatches the `planner` to overwrite the plan with a fundamentally different shape — naming the failed approach and the new one in the `## Approach` section. You never silently retry the same plan.

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
2. You confirm. `/project:work` flags the cycle as a batch and dispatches the `planner` first (any batch of 2+ triggers a plan).
3. The developer writes one set of failing tests covering all cases in the batch, then drives them all Green in one pass, refactoring as it goes.
4. Single commit at the end. Conventional commit scope names the batch, e.g. `feat(auth-login): add rate limiting and lockout (B3, B4, B5)`.
5. The entity page Behavior section is ticked for every case in the batch in the same commit.

## Scenario: Requesting a periodic review

The reviewer is fresh eyes on the codebase. It catches drift the developer can't see because the developer wrote both the spec and the code.

**When to fire `/project:review`:**

- Roughly every 5 completed todos.
- Before a release.
- After a non-trivial set of merges to `develop`.
- When you suspect the wiki and the code disagree.

**What happens:**

1. `/project:review` creates a fresh git worktree at `../<repo>-review-YYYY-MM-DD` (sibling directory, not inside the repo).
2. Dispatches the reviewer agent **inside the worktree** — no prior developer context, fresh read of every entity page and the code that implements it.
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

1. **Branch.** `/project:work` opens `fix/<slug>` (not `feat/<slug>`) because the matching entity already exists; you're correcting a regression. The same test-first discipline applies on `fix/*`.
2. **Regression test first.** The developer writes a test that **reproduces the bug** — assertion fails on the current code. This becomes a new Behavior case on the entity page, e.g.:

   ```markdown
   ## Behavior

   - [x] rejects unknown user
   - [x] issues token on success
   - [ ] [regression] does not leak password hash in error response ← new
   ```

   Adding the case to the entity page is part of the same commit as the test.

3. **Fix it.** Minimum change to turn the new Red into Green. Existing tests must stay green. Refactor only if it falls out naturally.
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

1. **First failure.** The developer's attempt doesn't make Red turn Green (or it makes the new tests pass but breaks existing tests it can't reconcile). It rethinks and tries a second time.
2. **Second failure.** On the second failure on the same mechanism, the developer stops and calls `human-checkpoint`. It does **not** try a third time on the same approach.
3. **Your decision.** The agent presents the two attempts, what failed, and at least one fundamentally different approach to consider. Options:
   - **Reset and re-spec.** Tag the failed state for postmortem, reset to the last green commit, then `/project:interview` to sharpen the Behavior cases. This is the right call when the spec was too vague to test against.
   - **Authorize a different approach.** If the spec is fine but the implementation strategy was wrong, tell the agent which alternative to take. If the todo is `[complex]`, `/project:work` re-dispatches the `planner` to overwrite the prior plan with the new shape before retrying.

4. **Checkpoint and reset mechanics** (plain git — there's no bespoke command):

   ```bash
   # Before retrying — preserve the failed branch state under a tag
   git tag checkpoint-$(date -u +%Y%m%dT%H%M%SZ)

   # Reset to an earlier checkpoint (destructive on the current branch — it
   # discards uncommitted work and commits after the tag)
   git reset --hard <checkpoint-tag>
   ```

   `git reset --hard` is destructive. Confirm what you'll discard (`git status`, `git log`) before running it.

## Scenario: Adding a new skill mid-project

When the agent realises a procedural gap, it shouldn't bury that knowledge in an agent prompt — it should ship a new skill.

1. **The agent notices.** During `/project:work`, the developer hits a recurring task (e.g. "this is the third time I've had to author a Postgres migration; there's no skill for it"). It pauses via `human-checkpoint` and proposes creating one via the `update-toolkit` skill.
2. **You approve.** Confirm the skill name and one-line description, or push back if the gap is really a wiki update.
3. **The agent writes it.** `update-toolkit` produces `.claude/skills/database-migrations/SKILL.md` with frontmatter (precise `description` so future tasks auto-load it) and a procedural body — _how_ to do migrations in this project, not _what_ migrations are.
4. **It auto-loads next time.** On the next task that matches the skill's `description` trigger, the developer loads the skill without you having to ask. This is the progressive-disclosure principle in action.

`update-toolkit` is the one meta skill for all three artifact kinds — it has a section for skills, one for commands, and one for agents (used when the gap is a genuinely distinct role, not just a procedure).

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

3. **Cross-linking.** The ingest greps the wiki for related terms and adds `[[summaries/<slug>]]` references on overlapping entity and concept pages — that's what makes the summary reachable, since there's no central index. Contradictions get flagged with `> [!contradiction]` in both pages — never silently resolved.
4. **`/project:wiki-lint` afterwards.** Heavy ingest tends to create new cross-references and the occasional orphan. Run `/project:wiki-lint` when several summaries have landed.

## Scenario: Checking project state mid-session

There's no bespoke status command — plain git tells you where you are:

```bash
git status                 # branch + uncommitted changes
git log --oneline -10      # recent commits
git tag -l 'checkpoint-*'  # checkpoints you can reset to
```

For the work queue, open `docs/wiki/todos.md` (top items are next) and `docs/wiki/log.md` (recent activity). If `docs/wiki/wiki-todos.md` has more than ~10 pending lines, it's time for `/project:wiki-lint`.

Check state at session start, after a long break, or before deciding whether to `/project:work`, `/project:review`, or `/project:wiki-lint`.

# Quick reference

## Command → when to use

| Command                | When                                                                          |
| ---------------------- | ----------------------------------------------------------------------------- |
| `/project:init`        | Once at project start (includes its own interview pass for an empty wiki)     |
| `/project:interview`   | When adding a new feature or deepening the spec after init                    |
| `/project:agent-scout` | Once after init+interview; again after a major feature adds a new stack layer |
| `/project:work`        | Main loop — most days you live in `/project:work`                             |
| `/project:review`      | Periodic (every ~5 todos), before a release, after several merges             |
| `/project:wiki-lint`   | When `wiki-todos.md` piles up or after heavy ingest                           |
| `/project:wiki-ingest` | When you have a new external doc, or to commission web research               |

Routine git operations — `git tag checkpoint-<stamp>` before a risky change, `git reset --hard <tag>` to recover, `git status` / `git log` to see where you are — use plain git, not bespoke commands.

## Where to look when something's wrong

| Symptom                                            | Look at                                                                                                                   |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Developer won't start (no Behavior cases)          | Entity page missing or `## Behavior` empty — run `/project:interview` first                                               |
| Reviewer claims it's in the wrong dir              | `/project:review` didn't `cd` into the worktree first — re-run, ensure worktree path is passed                            |
| `wiki-todos.md` is huge                            | Run `/project:wiki-lint`                                                                                                  |
| Developer keeps retrying the same failing approach | Two-strike rule should fire — it stops after the second failure and asks you                                              |
| Plan looks wrong                                   | Edit `.claude/handoff/<slug>-plan.md`, or just tell the developer the approach to take                                    |

# The mental model in one paragraph

The wiki is the project's source of truth — code that disagrees with it is the bug. You drive `/project:interview` to populate the spec. You run `/project:work` to ship features under TDD; the `developer` agent runs the cycle (with the `planner` on Opus decomposing `[complex]` or batched todos first), and the wiki is updated in the same commit as the code. When in doubt, the agent stops and asks rather than guessing. Periodic `/project:review` and `/project:wiki-lint` keep both layers honest.

# Anti-patterns

- **Skipping `/project:interview` on a new feature.** The Behavior cases on entity pages are what produce sharp tests; without them, the TDD loop starves.
- **Editing `docs/wiki/` by hand without telling the agent.** You can, but you'll fight the agent's memory. Prefer asking it to make the change.
- **Editing `docs/raw/` after the fact.** Never. Append new sources instead.
- **Committing on `main`.** Always branch first (`/project:work` handles this).
- **Letting `wiki-todos.md` pile up.** When it's long, run `/project:wiki-lint`.
- **Running the same failed approach a third time.** The two-strike rule exists for a reason — pivot or re-spec.
- **Treating a plan as a spec.** Plans live in `.claude/handoff/` and are transient scratch. The wiki holds the spec. If the plan needs to change, edit the plan; if the contract needs to change, run `/project:interview`.

# Related

- [`CLAUDE.md`](../CLAUDE.md) — the schema (agent's view)
- [`HUMAN.md`](../HUMAN.md) — the human's-eye view of the workflow
- [`docs/wiki/git-conventions.md`](wiki/git-conventions.md) — branching and commit format
- [`docs/wiki/commands.md`](wiki/commands.md) — working shell commands
- [`.claude/agents/planner.md`](../.claude/agents/planner.md) — the planner agent definition (Opus)
- [`.claude/agents/developer.md`](../.claude/agents/developer.md) — the developer agent definition
- [`.claude/skills/plan-writing/SKILL.md`](../.claude/skills/plan-writing/SKILL.md) — how plans are structured
