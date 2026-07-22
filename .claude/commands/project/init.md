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

- If not a git repo — the **expected state** when starting from this template (the quick start erases the cloned `.git` so the project begins its own history):
  1. `git init -b main` — always pass `-b main`; a bare `git init` may create `master` depending on the machine's `init.defaultBranch`.
  2. **Keep the template's shipped `.gitignore`** — it carries entries the workflow relies on (the plan scratch, `settings.local.json`, `docs/.obsidian/`). Append stack-specific entries (Node, Python, OS, IDE) to it; never replace it.
  3. Stage everything including dotfiles (`git add -A`) and commit `chore: initial commit` on `main` — the template's `.claude/`, `CLAUDE.md`, and `docs/` (with the pre-seeded gotchas) must all land in that first commit.
  4. If the human has a remote URL, `git remote add origin <url>`; otherwise continue without one — every later push step is skipped and noted in the report until a remote exists.
- If on `main` with uncommitted changes: stop and run `human-checkpoint`. Ask whether to commit, stash, or discard.
- If on a feature branch: warn; don't switch.

### 2. Stack detection

Look for: `pyproject.toml`, `package.json`, `Cargo.toml`, `go.mod`, `Gemfile`, `composer.json`, `pom.xml`, `build.gradle`, `Dockerfile`, etc. Note what you find.

Look for a test command in `pyproject.toml` / `package.json` scripts / `Makefile`. Record it.

Note the project directory layout: `src/`, `tests/`, `lib/`, `app/`, etc.

### 3. Pre-interview wiki scan

Before asking anything, check whether `docs/wiki/requirements.md` and `docs/wiki/architecture.md` already exist and contain real content (not just placeholder headings).

If they do, read them and extract answers for every interview topic below. Mark each topic as either:
- **covered** — the doc has a concrete, non-placeholder answer; no question needed.
- **partial** — some content exists but is incomplete or ambiguous; ask a focused follow-up only.
- **missing** — no content; ask the full question.

Print a one-line summary of what you found before starting the interview, e.g.:
> "Found existing requirements.md and architecture.md. Vision, users, stack, and data are covered. I'll ask about: user stories, out-of-scope, deployment, and non-functional requirements."

If both files are fully populated and all topics are covered, skip the interview entirely and go straight to step 4.

### 4. Interview

Ask only about topics that are **missing** or **partial** from the pre-interview scan. Follow the procedure from the `/project:interview` command. Cover these topics (in order), one question at a time, always providing your recommended answer:

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

Open a transcript at `docs/raw/interviews/YYYY-MM-DD-init.md` **before** asking the first question (skip creating it if no questions are needed). Stream Q-by-Q and A-by-A: write the question to disk, ask, write the answer to disk on receipt — never batch. Same enforcement as `/project:interview` (see operating rule #7 in `.claude/commands/project/interview.md`).

Stop conditions:

- Human says stop.
- All sections needed for wiki scaffolding have concrete answers (from pre-scan + interview combined).
- You have enough to write Behavior cases for the first entity.

### 5. Scaffold wiki

Create directories that don't exist:

```
docs/raw/interviews/
docs/wiki/entities/
docs/wiki/concepts/
docs/wiki/decisions/
docs/wiki/summaries/
```

Create or update these pages with **real content from the pre-scan and interview combined** (no `<TBD>` placeholders except for topics genuinely not discussed):

- `docs/wiki/requirements.md` — fill **all** sections: `## Vision`, `## Users`, `## User stories` (one per user-capability pair in `- As a <user type>, I want <capability>, so that <benefit>` format with Acceptance + `Maps to:` link), `## Functional requirements`, `## Non-functional requirements`, `## Out of scope`, `## Open questions`.
- `docs/wiki/architecture.md` — fill `## Stack`, `## Layout`, `## Data`, `## External services`, `## Testing strategy`, `## Conventions`, `## Deployment`. Leave a section as `<TBD>` only if it was genuinely not discussed.
- `docs/wiki/git-conventions.md` — default branch, branch prefixes, commit format.
- `docs/wiki/commands.md` — test command, build command, lint command (whatever was detected/confirmed).
- `docs/wiki/todos.md` — seeded with first work items from the interview.
- `docs/wiki/gotchas.md` — create with empty headings (`## Critical`, `## Runtime`, `## Testing`, `## Tooling`) **only if missing. Never clear existing entries** — the template ships with tooling gotchas (e.g. skill discovery) that apply to every project built on it.
- `docs/wiki/wiki-todos.md` — create empty only if missing; keep any pending lines.
- `docs/wiki/log.md` — init entry (see step 6).

Create entity pages under `docs/wiki/entities/` for each feature/module identified in the interview, with Behavior cases (see `spec-writing` skill).

File ADRs under `docs/wiki/decisions/` for non-trivial choices made during the interview (see `decision-recording` skill).

Every page gets correct frontmatter per the Obsidian LLM-wiki standard (see the `wiki-update` skill).

### 6. Rewrite CLAUDE.md

Rewrite `CLAUDE.md` to be lean and project-specific. Drop the template framing — this is now a real project. **Use [`.claude/templates/CLAUDE.md.tmpl`](../../templates/CLAUDE.md.tmpl) as the exact skeleton:** copy it to `CLAUDE.md` and fill every `<placeholder>` (project name, vision, stack, test command) from the interview answers. Do not re-derive the section list — the template already carries it (Identity, Operating principles, Three layers, Wiki layout, Commands, Agent routing, North star).

The template deliberately points at `.claude/rules/behavioral.md` for the binding rule list instead of duplicating it — keep that pointer; do not paste a "Golden rules" block back in. The result should be under ~120 lines. Every section earns its place — if a section doesn't help an agent operate, cut it.

### 7. Log it

Append to `docs/wiki/log.md`:

```markdown
## [YYYY-MM-DD HH:MM] init

- Stack: <stack>
- Test command: <command>
- Interview transcript: [YYYY-MM-DD-init](../raw/interviews/YYYY-MM-DD-init.md) (omit if no questions were needed)
- Pages created: <count>
- ADRs: <count>
- Next: run `/project:work` to pick up the first todo.
```

### 8. Commit

Stage and commit everything created or modified, then push:

```bash
git add docs/ CLAUDE.md
git commit -m "chore(init): scaffold wiki and CLAUDE.md"
git push -u origin main
```

If the repo has no remote yet, skip the push and note it in the report.

### 8a. Create the `develop` branch

`/project:work` always starts and ends on `develop`. If it doesn't exist yet, create it from `main` and push:

```bash
git checkout -b develop
git push -u origin develop
git checkout develop
```

If `develop` already exists (locally or on the remote), check it out instead of recreating it.

### 9. Report

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
