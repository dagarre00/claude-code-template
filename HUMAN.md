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
- **Updates the wiki in the same commit** as the code — entity pages, requirements, log.
- **Asks you when it's stuck.** Two-strike rule: two failed attempts on the same approach → stop and ask. On retry, it overwrites the plan with a fundamentally different approach rather than tweaking.
- **Hooks back the discipline.** Test-first _reminder_ on `feat/*`/`fix/*` branches (it nudges, doesn't block); format-on-save; session-start divergence warning; session-end commit prompt; wiki-drift warning if code shipped without a wiki touch.

## What it does NOT do without you

- Open or merge PRs.
- Force-push or rewrite published history.
- Decide between two reasonable design alternatives (it presents both with a recommendation and waits).
- Run `/project:review` mid-`/project:work` — review is periodic, not in-loop.
- Auto-invoke the wiki-maintainer. Wiki health passes (`/project:wiki-lint`) are explicitly triggered by you.

## How to evolve the template

The agent ships with a small set of skills, agents, commands, and hooks. As the project grows, add more — the agent uses the meta skills (`update-skill`, `update-agent`, `update-command`, `update-hook`) to extend its own toolkit. You don't need to know the file formats — tell the agent what behavior you want, and it'll create the right artefact in the right place.

Examples:

- "We need a skill for adding database migrations in this project." → agent creates `.claude/skills/database-migrations/SKILL.md` via the `update-skill` meta skill.
- "After every commit, run shellcheck on any changed `.sh` files." → agent adds a PostToolUse hook via `update-hook`.

## Anti-patterns to avoid

- **Editing `docs/wiki/` by hand.** You can, but it confuses the agent — the wiki is its persistent memory. Prefer asking the agent to make the change.
- **Editing `docs/raw/` after the fact.** Never. Append new sources instead.
- **Skipping `/project:interview`** on a new feature. The Behavior cases are what produce sharp tests; without them, the TDD loop starves.
- **Letting `docs/wiki/wiki-todos.md` pile up.** When it's long, run `/project:wiki-lint`.
