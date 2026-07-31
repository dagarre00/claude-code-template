# For the Human

This is the template for an agentic-development project. The agent (Claude Code) does the work; you steer.

## Mental model

Three layers, each owned by a different actor:

1. **Raw sources** (`docs/raw/`) — you drop interviews, articles, transcripts here. **Immutable.** Agents read but never modify.
2. **Wiki** (`docs/wiki/`) — the living spec. **Agents own this.** Code that disagrees with the wiki is the bug. You browse it in Obsidian.
3. **Schema** (`CLAUDE.md`, `.claude/`) — how the agents operate. You and the agent evolve this together.

## Day-to-day workflow

| You want to…                                      | You run…                                  |
| ------------------------------------------------- | ----------------------------------------- |
| Start a new project                               | `/project:init` then `/project:interview` |
| Configure agents/skills for your stack after init | `/project:agent-scout`                    |
| Add a new feature                                 | `/project:interview`                      |
| Move forward on todos                             | `/project:work`                           |
| Get a second model to attack the current diff     | `/project:adversary`                      |
| Audit the project                                 | `/project:review`                         |
| Check the wiki is healthy                         | `/project:wiki-lint`                      |
| Ingest a doc or research a topic                  | `/project:wiki-ingest`                    |
| See where you are                                 | `git status` / `git log --oneline`        |
| Tag before a risky change                         | `git tag checkpoint-<stamp>`              |
| Recover from a bad attempt                        | `git reset --hard <checkpoint-tag>`       |

Open Obsidian on `docs/wiki/` — that's your read-only-ish view of what the agent knows. Following the `[[wiki-links]]` and the graph view shows the structure.

## What the agent does on its own

- **Reads the wiki** before any code change.
- **Plans complex work.** When a todo is tagged `[complex]` or batched (2+ todos), `/project:work` dispatches the `planner` agent (on Opus) to write a stepwise plan before testing. Plans live transiently at `.claude/handoff/<slug>-plan.md` (gitignored scratch).
- **Writes failing tests first** (Red), confirms they fail for the right reason, then implements (Green), then refactors — all in one `developer` agent (which follows the planner's plan when there is one).
- **Gets a second opinion on risky work.** On `[complex]` or batched cycles, `/project:work` points an `adversary` agent (Opus, none of the developer's context) at the diff and tells it to find what's wrong. It writes numbered findings to a scratch file and is forbidden from touching the code; the developer then answers each finding in writing — fixed, rejected with a reason, or deferred as a todo. Two rounds maximum, then it asks you. Simple one-todo cycles skip this; run `/project:adversary` yourself when you want it anyway.
- **Updates the wiki in the same commit** as the code — entity pages, requirements, log.
- **Asks you when it's stuck.** Two-strike rule: two failed attempts on the same approach → stop and ask. On retry, it overwrites the plan with a fundamentally different approach rather than tweaking.

- **Opens the PR when the feature is done.** Once every Behavior case on the entity page is `[x]`, `/project:work` opens a PR to `develop` on its own and hands it to you. It never merges.

## What it does NOT do without you

- Merge PRs, or push to `develop` / `main` directly.
- Force-push or rewrite published history.
- Decide between two reasonable design alternatives (it presents both with a recommendation and waits).
- Run `/project:review` mid-`/project:work` — the *periodic* audit is never in-loop. (The per-change `adversary` is a different, read-only role and does run there — see above.)
- Let a reviewing agent of either kind edit your code. Both raise findings only.
- Auto-invoke the wiki-maintainer. Wiki health passes (`/project:wiki-lint`) are explicitly triggered by you.

## How to evolve the template

The agent ships with a small set of skills, agents, and commands. As the project grows, add more — the agent uses the `update-toolkit` meta skill (one skill covering all three artifact kinds) to extend its own toolkit. You don't need to know the file formats — tell the agent what behavior you want, and it'll create the right artefact in the right place.

Examples:

- "We need a skill for adding database migrations in this project." → agent creates `.claude/skills/database-migrations/SKILL.md` via `update-toolkit`.
- "We need a repeatable entry point for release prep." → agent adds a `/project:release` command via `update-toolkit`.

## Anti-patterns to avoid

- **Editing `docs/wiki/` by hand.** You can, but it confuses the agent — the wiki is its persistent memory. Prefer asking the agent to make the change.
- **Editing `docs/raw/` after the fact.** Never. Append new sources instead.
- **Skipping `/project:interview`** on a new feature. The Behavior cases are what produce sharp tests; without them, the TDD loop starves.
- **Letting `docs/wiki/wiki-todos.md` pile up.** When it's long, run `/project:wiki-lint`.
