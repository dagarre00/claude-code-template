# Getting Started

A worked walkthrough from a fresh fork of this template to a first shipped feature. Read this once end-to-end before opening Claude Code so the loop makes sense — then refer back as needed.

> If you've never seen the schema, read [`CLAUDE.md`](../CLAUDE.md) first (it's the agent's view of the rules) and [`HUMAN.md`](../HUMAN.md) next (the human's-eye view).

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

## 1. `/init` — scaffold the wiki

Inside Claude Code, run:

```
/init
```

What this does:

- Verifies the wiki layout in `docs/wiki/`.
- Detects whether the repo has a stack already (language, package files) and seeds `architecture.md#Stack` and `commands.md` with the detection.
- Initializes git if missing.
- Leaves every other section (`Vision`, `Users`, `Personas`, requirements, …) as `<TBD via /interview>`.

After `/init`, the wiki has the right shape but is mostly empty. That's expected.

## 2. `/interview` — define the project

```
/interview
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

## 3. `/work` — first feature, TDD-style

```
/work
```

`/work` picks the top item from `todos.md` (or batches consecutive todos sharing context), opens a `feat/<slug>` branch, and runs the loop:

1. **Tester agent — Red.** Reads the matching `entities/<slug>.md#Behavior` cases, writes failing tests, runs them, confirms they fail for the right reason, emits `.claude/handoff/<slug>.json` with `red_confirmed: true`.
2. **Implementer agent — Green.** Refuses to start without the red_confirmed handoff. Writes the minimal code to make tests pass. The `test-first-check` hook blocks code edits on `feat/*` branches if the handoff is missing.
3. **Refactor.** Implementer cleans up while keeping tests green.
4. **Wiki update.** Implementer ticks the entity-page Behavior checklist, updates `completed.md`, appends to `log.md`. Larger wiki cleanup is queued in `wiki-todos.md` for the wiki-maintainer.
5. **Commit.** Conventional commit format (see [git-conventions.md](wiki/git-conventions.md)).

If a step fails twice on the same approach, the **two-strike rule** fires — the agent stops, you `/rollback`, and re-spec.

## 4. `/review` — every ~5 todos

```
/review
```

Runs the `reviewer` agent in a fresh git worktree with no implementer context. It audits code against the wiki and flags drift, missing tests, security/perf concerns. Critical issues block; warnings get queued in `wiki-todos.md`.

This is **not** part of `/work` — it's periodic and isolated.

## 5. `/wiki-lint` — every few cycles

```
/wiki-lint
```

Dispatches the `wiki-maintainer` to process the `wiki-todos.md` queue, find orphans, broken `[[wiki-links]]`, stale claims, and contradictions. File ADRs that emerged during work. Returns the wiki to a clean state.

Run when `wiki-todos.md` is piling up or after a big round of feature work.

## 6. Useful side commands

| Command        | When                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| `/status`      | At session start or after a long break. Shows branch, top todos, recent log, uncommitted summary.        |
| `/checkpoint`  | Before a risky operation (large refactor, destructive command). Tags `HEAD` as `checkpoint-<timestamp>`. |
| `/rollback`    | After a failed attempt. Lists checkpoints and reverts to one.                                            |
| `/wiki-ingest` | To absorb a spec PDF, an article, or research output into the wiki.                                      |

## The mental model in one paragraph

The wiki is the project's source of truth — code that disagrees with it is the bug. You drive `/interview` to populate the spec. You run `/work` to ship features under TDD. The agent updates the wiki in the same commit as the code. When in doubt, the agent stops and asks rather than guessing. Hooks back the discipline (test-first, format-on-save, wiki-drift warning). Periodic `/review` and `/wiki-lint` keep both layers honest.

## Anti-patterns

- **Skipping `/interview` on a new feature.** The Behavior cases on entity pages are what produce sharp tests; without them, the TDD loop starves.
- **Editing `docs/wiki/` by hand without telling the agent.** You can, but you'll fight the agent's memory. Prefer asking it to make the change.
- **Editing `docs/raw/` after the fact.** Never. Append new sources instead.
- **Committing on `main`.** Always branch first (`/work` handles this).
- **Letting `wiki-todos.md` pile up.** When it's long, run `/wiki-lint`.

## Related

- [`CLAUDE.md`](../CLAUDE.md) — the schema (agent's view)
- [`HUMAN.md`](../HUMAN.md) — the human's-eye view of the workflow
- [`docs/wiki/git-conventions.md`](wiki/git-conventions.md) — branching and commit format
- [`docs/wiki/commands.md`](wiki/commands.md) — working shell commands
