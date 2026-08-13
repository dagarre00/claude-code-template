# For the Human

This is the **rapid-prototyping** template for an agentic-development project. The agent (Claude Code) does the work; you steer. It is the fast-loop sibling of the same template's rigorous track — same wiki discipline, no TDD.

## What you're signing up for

- You will be asked a lot about **what the thing should do**, and never about the stack. The agent picks the technical layer itself and tells you what it assumed.
- Everything it builds runs on **one modest, always-on machine**. It won't reach for cloud services, containers-plus-orchestration, or a GPU without stopping to ask you first.
- There are **no tests**. What replaces them: the agent must actually run every slice and paste the real output into the wiki before it can call it done. Your job as reviewer is to look at that output — and, at the end of each branch, to run the thing yourself and say whether it does what you wanted. That confirmation is the only merge gate.
- The prototype will be **full of shortcuts**, on purpose, and every one of them is written down in the entity page's `## Shortcuts`. That ledger is what makes the thing safe to throw away *or* safe to rebuild properly.

## Mental model

Three layers, each owned by a different actor:

1. **Raw sources** (`docs/raw/`) — you drop interviews, articles, transcripts here. **Immutable.** Agents read but never modify.
2. **Wiki** (`docs/wiki/`) — the living spec. **Agents own this.** Code that disagrees with the wiki is the bug. You browse it in Obsidian.
3. **Schema** (`CLAUDE.md`, `.claude/`) — how the agents operate. You and the agent evolve this together.

## Day-to-day workflow

| You want to…                                  | You run…                                    |
| --------------------------------------------- | ------------------------------------------- |
| Start a new prototype                         | `/project:init`                             |
| Pin down what it should do (and find the holes) | `/project:interview`                      |
| Build the next slice                          | `/project:work`                             |
| Check the whole thing still works             | `/project:demo`                             |
| Hand it to a full-workflow repo               | `/project:graduate`                         |
| Configure skills for your stack               | `/project:agent-scout`                      |
| Check the wiki is healthy                     | `/project:wiki-lint`                        |
| Ingest a doc or research a topic              | `/project:wiki-ingest`                      |
| See where you are                             | `git status` / `git log --oneline`          |
| Tag before a risky change                     | `git tag checkpoint-<stamp>`                |
| Recover from a bad attempt                    | `git reset --hard <checkpoint-tag>`         |

Open Obsidian on `docs/wiki/` — that's your view of what the agent knows. Entity pages are where you'll spend your time: `## Slices` is the plan, `## Demonstrations` is the evidence, `## Shortcuts` is the debt.

## What the agent does on its own

- **Reads the wiki** before any code change.
- **Picks the stack, storage, config, and how it starts** — without asking, inside the hardware envelope. It reports what it assumed; you can overrule any of it.
- **Builds one slice at a time**, where a slice is the smallest thing it can demonstrate with one command.
- **Runs the thing and records the real output** into the entity page, then commits code + evidence + declared shortcuts together, and pushes. If it couldn't run it, it says so and leaves the slice unfinished rather than claiming success.
- **Declares every fake.** Hardcoded values, skipped auth, ignored error paths — each gets a line in `## Shortcuts` saying what it would take to make real.
- **Updates the wiki in the same commit** as the code.
- **Asks you when it's stuck.** Two-strike rule: two failed attempts on the same mechanism → stop and ask, usually offering a cruder version as one of the options.
- **Tells you when it's time to graduate** — when the backlog outgrows the template, when it keeps wanting tests, or when the shortcut ledger has grown past what a prototype should carry.

## What it does NOT do without you

- Merge a prototype branch into `main` before you've confirmed the demo does what you wanted.
- Push to `main` directly, force-push, or rewrite published history.
- Reach outside the hardware envelope — no cloud dependency, cluster, or GPU without a checkpoint first.
- Decide product logic. Ambiguity in *what it should do* always comes back to you (technical choices never do).
- Write tests. This template has no suite by design.
- Auto-invoke the wiki-maintainer. Wiki health passes (`/project:wiki-lint`) are explicitly triggered by you.

## The one thing to watch for

An agent with no test suite has exactly one way to lie to you: claiming something works that it never ran. Behavioral rules 2 and 3 forbid it, `/project:work` re-runs the builder's demonstrations to check them, and `/project:demo` re-runs everything on demand. If you ever see a `[x]` slice with no output recorded under `## Demonstrations`, that's the failure mode — say so, and it will be treated as a hard stop.

## Graduating to the full workflow

When the prototype has answered its question, run `/project:graduate`. You get one markdown file containing the requirements, the slices rewritten as draft behavior cases (marked *demonstrated* or *inferred*), the stack and which parts of it were mere convenience, the entire shortcut ledger, the gotchas, and an honest list of what was never run.

Clone the full-workflow template into a **new** repo, drop that file in, and run `/project:init <path-to-handoff>` — it reads the file as covered material and only interviews you about the gaps. This repo keeps working as a prototype; nothing is converted in place.

## How to evolve the template

Tell the agent what behavior you want and it uses the `update-toolkit` meta skill to add the right thing in the right place:

- "We keep re-seeding sample data before every demo." → a `sample-data` skill.
- "I want a repeatable way to reset the box to a clean state." → a `/project:reset` command.

Be sparing with new agents: this template ships three (`builder`, `researcher`, `wiki-maintainer`) and wanting a fourth is usually a graduation signal.

## Anti-patterns to avoid

- **Editing `docs/wiki/` by hand.** You can, but it confuses the agent — the wiki is its persistent memory. Prefer asking the agent to make the change.
- **Editing `docs/raw/` after the fact.** Never. Append new sources instead.
- **Accepting "it works" without output.** Ask to see the run. That's the whole contract here.
- **Letting the shortcut ledger get long and quiet.** A dozen shortcuts is fine; a dozen shortcuts you've stopped reading means you've lost track of what's real.
- **Building past the question.** The prototype exists to answer one thing (`requirements.md § What this prototype is testing`). Once it has, graduate or stop.
