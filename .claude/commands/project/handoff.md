---
name: handoff
description: Package a todo as a self-contained brief for an external, non-Claude LLM agent. Gathers the entity spec, wiki excerpts, conventions and procedure into one file that works as that agent's sole prompt. Delegates execution; keeps orchestration here.
argument-hint: [todo, entity, or scope — e.g. "the login endpoint" | "batch the auth todos"]
type: command
---

# /project:handoff

**Argument:** `$ARGUMENTS`

The argument **selects what gets delegated**, overriding the default "take the top todo" in step 1:

- **Names a todo or entity** (`the login endpoint`, `entities/auth`) → package that instead. Match against `docs/wiki/todos.md` lines and entity slugs; no match → say what you looked for and stop.
- **Asks for a batch** (`batch the auth todos`) → one brief covering them, subject to the same shared-entity rule as `/project:work`.
- **Adds a constraint** (`no PR`, `tests only`) → carry it into the brief's scope section (§1) so the external agent reads it as part of its mission, not as a note from you.

An argument never lowers the bar: the entity page, sharp Behavior cases, and a runnable test command are required whatever it says. Empty → the top todo.

You produce **one file** and hand it to the human. You do not implement anything, and you do not dispatch the `developer`. Follow the `llm-handoff` skill for what goes in the file and how to verify it.

## When to use this instead of `/project:work`

- The work is well-specified and you want it executed elsewhere — another vendor's agent CLI, a teammate's session, a different model.
- You want a second implementation of the same spec, independent of this context.

Not for work whose spec is still open (`/project:interview` first), and not for anything where you would have to guess at the assertions yourself.

## Preconditions

- `docs/wiki/todos.md` has an item, and it maps to a `docs/wiki/entities/<slug>.md` (or `concepts/<slug>.md` for `[infra]`). No page → stop, recommend `/project:interview`.
- The entity's `## Behavior` section has cases sharp enough to test. Vague → stop, recommend `spec-writing`.
- `docs/wiki/commands.md ## Test` is not `<TBD>`. Run it once — a command that errors out will make the external agent's Red phase fail for the wrong reason, and it will be debugging your environment instead of writing the feature.
- Clean working tree, and clean means *yours*: `git status --porcelain`, account for every line (behavioral rule 21).

Any failure → `human-checkpoint`.

## Steps

1. **Pick the work.** `git fetch origin develop` first, then read `docs/wiki/todos.md` — the argument overrides the default. Skip `[wiki]` lines. Confirm against `origin/develop` that it has not already shipped.

2. **Branch if you are on `develop` or `main`:** `git checkout -b docs/handoff-<slug>`. The brief is gitignored, but the log entry is tracked (behavioral rule 19).

3. **Plan first for `[complex]` or batched work.** Dispatch the `planner`; its output goes *into* the brief (skill step 5), not into a file the external agent cannot see.

4. **Build the brief** per the `llm-handoff` skill: copy `TEMPLATE.md` to `.claude/handoff/<slug>-handoff.md`, fill every placeholder from the wiki verbatim, resolve inlined wikilinks, then run both verification greps — no surviving `{{...}}`, no vendor-specific vocabulary.

5. **Read it back as the reader would**, with no context (skill step 8). This is the step that decides whether the handoff works, and it is the one worth spending time on.

6. **Hand it to the human.** Give the path, and say plainly: paste the contents as the external agent's entire opening prompt, in a checkout of this repo. It will cut its own git worktree (so the main checkout is never disturbed), work test-first on `feat/<slug>`, commit per case, push, sync by merging rather than rebasing, open a PR against `develop`, delete the brief, tear the worktree down, and report back. It never force-pushes and it does not merge.

7. **Log, commit, push** — the `handoff` entry in `docs/wiki/log.md`, per the skill.

8. **Report.** Name what was delegated, the cases covered, the branch to expect, and what you will check when the PR arrives (skill § When the work comes back).

## Failure modes

- **Behavior cases too vague to test.** Stop. The external agent has less context than you do, not more — if you cannot write the assertion, it will invent one.
- **Test command does not run.** Stop. This is `/project:init` step 5a, not something to paper over in the brief.
- **Placeholder or vendor reference survives the greps.** Fix before handing over. A `{{...}}` reads to a fresh agent as a section it should fill in itself.
- **The todo needs a spec decision.** Stop and run `/project:interview`. Delegation does not resolve ambiguity, it distributes it.

## What you do NOT do

- **No implementation.** No tests, no production code, no dispatching the `developer`. This command's whole output is one file and a log entry.
- **No branching or worktree creation on the external agent's behalf.** `feat/<slug>` and the worktree are theirs to cut; creating either here just leaves debris when the handoff is never used.
- **No merging, ever** — and the brief says the same to them.
- **No fixing what comes back.** Gaps in the returned work are PR feedback (skill § When the work comes back). A recurring gap is a `TEMPLATE.md` bug.
