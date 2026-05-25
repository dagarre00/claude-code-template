---
name: init
description: Detect project state, interview for requirements, scaffold docs/wiki, update CLAUDE.md with project parameters. Run once at project start, or to recover from a broken wiki layout.
type: command
---

# /project:init

You are initializing this project. This command detects state, interviews the human for requirements, scaffolds the wiki with real answers (not placeholders), and rewrites `CLAUDE.md` to be lean and project-specific.

## Preconditions

- The current directory is the project root.
- `CLAUDE.md` and `.claude/` exist (the schema is on disk).

## Steps

### 1. Git state

Run `git status`.

- If not a git repo: `git init`, create a default `.gitignore` (Node, Python, OS, IDE entries), commit `chore: initial commit` on `main`.
- If on `main` with uncommitted changes: stop and run `human-checkpoint`. Ask whether to commit, stash, or discard.
- If on a feature branch: warn; don't switch.

### 2. Stack detection

Look for: `pyproject.toml`, `package.json`, `Cargo.toml`, `go.mod`, `Gemfile`, `composer.json`, `pom.xml`, `build.gradle`, `Dockerfile`, etc. Note what you find.

Look for a test command in `pyproject.toml` / `package.json` scripts / `Makefile`. Record it.

Note the project directory layout: `src/`, `tests/`, `lib/`, `app/`, etc.

### 3. Interview

Now interview the human. Follow the procedure from the `/project:interview` command, but focused on what `/project:init` needs to fill every wiki section. Cover these topics in order, one question at a time, always providing your recommended answer:

1. **Project vision** — one sentence. What does this project do and why does it exist?
2. **Users** — who uses it? (user types, contexts)
3. **Core user stories** — what must each user type be able to do? (priority order, enough to fill `## User stories`)
4. **Out of scope** — what explicitly won't this project do?
5. **Stack** — confirm detected stack. If nothing detected, ask: language, framework, package manager.
6. **Test framework and command** — confirm detected. If none, ask what to use.
7. **Data** — where does state live? (DB, files, in-memory, external services)
8. **External services** — APIs, auth providers, infra dependencies.
9. **Deployment** — how will this ship? (CI, target environment, release process)
10. **Non-functional** — perf targets, security requirements, observability, compliance.

Open a transcript at `docs/raw/interviews/YYYY-MM-DD-init.md` **before** asking the first question. Stream Q-by-Q and A-by-A: write the question to disk, ask, write the answer to disk on receipt — never batch. Same enforcement as `/project:interview` (see operating rule #7 in `.claude/commands/project/interview.md`).

Stop conditions:

- Human says stop.
- All sections needed for wiki scaffolding have concrete answers.
- You have enough to write Behavior cases for the first entity.

### 4. Scaffold wiki

Create directories that don't exist:

```
docs/raw/interviews/
docs/wiki/entities/
docs/wiki/concepts/
docs/wiki/decisions/
docs/wiki/summaries/
```

Create or update these pages with **real content from the interview** (no `<TBD>` placeholders except for topics genuinely not discussed):

- `docs/wiki/index.md` — catalog with links to all created pages.
- `docs/wiki/requirements.md` — fill **all** sections: `## Vision`, `## Users`, `## User stories` (one per user-capability pair in `- As a <user type>, I want <capability>, so that <benefit>` format with Acceptance + `Maps to:` link), `## Functional requirements`, `## Non-functional requirements`, `## Out of scope`, `## Open questions`.
- `docs/wiki/architecture.md` — fill `## Stack`, `## Layout`, `## Data`, `## External services`, `## Testing strategy`, `## Conventions`, `## Deployment`. Leave a section as `<TBD>` only if it was genuinely not discussed.
- `docs/wiki/git-conventions.md` — default branch, branch prefixes, commit format.
- `docs/wiki/commands.md` — test command, build command, lint command (whatever was detected/confirmed).
- `docs/wiki/todos.md` — seeded with first work items from the interview.
- `docs/wiki/completed.md` — empty.
- `docs/wiki/gotchas.md` — empty headings: `## Critical`, `## Runtime`, `## Testing`, `## Tooling`.
- `docs/wiki/wiki-todos.md` — empty.
- `docs/wiki/log.md` — init entry (see step 6).

Create entity pages under `docs/wiki/entities/` for each feature/module identified in the interview, with Behavior cases (see `spec-writing` skill).

File ADRs under `docs/wiki/decisions/` for non-trivial choices made during the interview (see `decision-recording` skill).

Every page gets correct frontmatter per the frontmatter convention.

### 5. Rewrite CLAUDE.md

Rewrite `CLAUDE.md` to be lean and project-specific. Drop the template framing — this is now a real project. The file must have exactly these sections:

```markdown
# <Project Name>

<One-sentence vision from interview.>

**Stack:** <language>, <framework> | **Test:** `<test command>` | **Branch:** `main`

## Identity

You are an AI development agent working on <project name>. Before any code change:

1. Read `docs/wiki/gotchas.md` for known failure points.
2. Read `docs/wiki/todos.md` to know what's next.
3. If the task touches a feature, read the matching entity page and the relevant section of `docs/wiki/requirements.md`.
4. Grep `docs/wiki/` for terms from the task.
5. Let matching skills auto-load.

## Operating principles

- **Wiki is spec.** `docs/wiki/` is truth. Code that disagrees is the bug.
- **Progressive disclosure.** Agents start minimal; skills load on demand.
- **Spec → Test → Code.** Entity Behavior → failing test → implementation.
- **Wiki always current.** Code and wiki edits ship together.
- **Human in the loop.** When the wiki doesn't answer, stop and ask.

## Three layers

1. **Raw sources** — `docs/raw/` (immutable). Agents read, never edit; only append.
2. **Wiki** — `docs/wiki/` (LLM-owned). Requirements, architecture, entities, decisions, todos, log.
3. **Schema** — `.claude/` (agents, skills, commands, hooks, rules).

## Wiki layout

| Page                        | Purpose                           |
| --------------------------- | --------------------------------- |
| `docs/wiki/requirements.md` | Living spec                       |
| `docs/wiki/architecture.md` | Stack, patterns, test strategy    |
| `docs/wiki/entities/*`      | One page per feature/module       |
| `docs/wiki/decisions/*`     | ADRs                              |
| `docs/wiki/todos.md`        | Priority-ordered work queue       |
| `docs/wiki/completed.md`    | Shipped work                      |
| `docs/wiki/gotchas.md`      | Known failure points              |
| `docs/wiki/commands.md`     | Working shell commands            |
| `docs/wiki/log.md`          | Timeline                          |
| `docs/wiki/wiki-todos.md`   | Cleanup queue for wiki-maintainer |

## Commands

| Command                | Purpose                                           |
| ---------------------- | ------------------------------------------------- |
| `/project:init`        | (Re)initialize project wiki and schema            |
| `/project:interview`   | Q&A to define requirements or features            |
| `/project:work`        | Top todo → spec → red → green → refactor → commit |
| `/project:review`      | Full audit in isolated worktree                   |
| `/project:checkpoint`  | Tag HEAD before risky ops                         |
| `/project:rollback`    | Revert to a checkpoint                            |
| `/project:status`      | Branch, todos, log, uncommitted summary           |
| `/project:wiki-lint`   | Wiki health check                                 |
| `/project:wiki-ingest` | Ingest file or research into wiki                 |

## Agent routing

| Task                       | Agent                                                    |
| -------------------------- | -------------------------------------------------------- |
| Write failing tests        | `tester`                                                 |
| Make tests pass + refactor | `implementer` (loads skills on demand)                   |
| Periodic audit             | `reviewer` (worktree-isolated)                           |
| Wiki health                | `wiki-maintainer` (manual only via `/project:wiki-lint`) |
| Web research               | `researcher`                                             |

## Hooks

| Hook                  | Phase                  | Purpose                                                      |
| --------------------- | ---------------------- | ------------------------------------------------------------ |
| `session-start.sh`    | SessionStart           | Pull, activate venv, warn on uncommitted                     |
| `session-end.sh`      | Stop                   | Prompt to commit/push, append log                            |
| `test-first-check.sh` | PreToolUse Write/Edit  | Block code edits without a matching test on `feat/*`/`fix/*` |
| `auto-format.sh`      | PostToolUse Write/Edit | Run formatter by file extension                              |
| `wiki-drift-check.sh` | Stop                   | Warn if code edited but no wiki touched                      |

## Golden rules

1. **Wiki is truth.** Code that disagrees with the wiki is the bug.
2. **No code without a failing test.**
3. **Never modify a test to make it pass.** Update spec → regenerate test → implement.
4. **Always update wiki in the same change.** Touching `src/` requires touching the entity page.
5. **Never modify `docs/raw/`.** Append only.
6. **Agents own `docs/wiki/`.** Humans browse; agents write.
7. **Always branch before coding.** Never commit to main.
8. **Conventional commits.** `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.
9. **Two-strike rule.** Two failures on the same mechanism → `/project:rollback` and re-spec.
10. **Reviewer is periodic.** `/project:review` every ~5 todos, not in `/project:work`.
11. **Human-in-the-loop.** When wiki doesn't answer, stop and ask.
12. **Skills are how-to, not what-is.** Add skills via `update-skill`; don't bury knowledge in agent prompts.
13. **Finalize with commit + push.** Every mutating command/agent ends by committing and pushing to the working branch (`git push -u origin <branch>`); read-only commands are exempt.
```

Trim the template's explanatory prose. The file should be under ~120 lines. Every section earns its place — if a section doesn't help an agent operate, cut it.

### 6. Log it

Append to `docs/wiki/log.md`:

```markdown
## [YYYY-MM-DD HH:MM] init

- Stack: <stack>
- Test command: <command>
- Interview transcript: [YYYY-MM-DD-init](../raw/interviews/YYYY-MM-DD-init.md)
- Pages created: <count>
- ADRs: <count>
- Next: run `/project:work` to pick up the first todo.
```

### 7. Commit

Stage and commit everything created or modified, then push:

```bash
git add docs/ CLAUDE.md
git commit -m "chore(init): scaffold wiki and CLAUDE.md"
git push -u origin main
```

If the repo has no remote yet, skip the push and note it in the report.

### 8. Report

Print:

- Stack and test command.
- Pages created vs already present.
- Key decisions from the interview.
- Recommended next step: `/project:work` to start on the first todo.

## Failure modes

- If git is broken (no remote, divergent main): stop and run `human-checkpoint`.
- If you can't detect a stack: ask in the interview. Don't guess.
- If a wiki page exists with conflicting frontmatter: append to `docs/wiki/wiki-todos.md`, don't auto-fix.
- If the human won't answer interview questions: scaffold with what you have; mark the rest `<TBD>`.

## What you do NOT do

- **No code creation.** This command sets up wiki and schema. It does not generate `src/`, dependency manifests, or boilerplate. That comes from `/project:work`.
- **No assumptions about the stack.** Detect or ask.
- **No second-guessing existing wiki.** If a page exists, leave it. Append to `wiki-todos.md` if it needs cleanup.
