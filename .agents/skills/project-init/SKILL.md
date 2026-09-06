---
name: "project-init"
description: "Detect project state, interview for requirements, scaffold docs/wiki, personalize canonical project context, and regenerate all harness entry points. Run at project start or to recover wiki layout."
---

<!-- Generated from .harness/commands/project/init.md; DO NOT EDIT. Run node scripts/sync-harness.mjs. -->

# project-init

**Conductor only.** Follow `mcp-coordination` for every worker dispatch, status
check, cancellation, and local integration. A worker must return a result or
blocker instead of invoking this command. Never substitute native delegation.

**Argument:** `user-provided context following this skill invocation (empty if omitted)`

You are initializing the adopting project. Detect its state, interview for its requirements,
scaffold the wiki with real answers, personalize `.harness/project.md`, and regenerate
the native entry points. Never treat template maintenance or its generator tests as the
adopting application's requirements or test suite.

If the argument is non-empty, treat it as **context that steers the init**, not as a separate task. Resolve it before step 3 and fold it into the pre-interview scan:

- **Points at existing material** (`review the legacy files`, `read src/ and the old README`, `the spec is in docs/spec.pdf`) → read those paths first, extract every answer you can, and mark those interview topics **covered** so you don't ask what the human already wrote down. Cite the file in the wiki page you fill from it.
- **States a fact** (`stack is Django + Postgres`, `no CI yet`) → record it as a given, skip the matching question, and confirm it in the report rather than the interview.
- **Narrows the scope** (`wiki only, skip the test bootstrap`) → honour it and say in the report which steps you skipped.

If the argument is empty, run the full procedure below. If it names a path that doesn't exist, say so and ask — don't silently proceed as if it were empty.

## Preconditions

- The current directory is the project root.
- `.harness/instructions.md`, `.harness/project.md`, `.harness/settings.json`, and
  `scripts/sync-harness.mjs` exist. MCP setup is needed before worker dispatch,
  but missing setup does not authorize rewriting role settings or installing CLIs.

## Steps

### 1. Git state

Run `git status`.

- If not a git repo (for example, an extracted template archive):
  1. `git init -b main` — always pass `-b main`; a bare `git init` may create `master` depending on the machine's `init.defaultBranch`.
  2. **Keep the template's shipped `.gitignore`** — it carries entries the workflow relies on (the plan scratch, `settings.local.json`, `docs/.obsidian/`). Append stack-specific entries (Node, Python, OS, IDE) to it; never replace it.
  3. Inspect all untracked files and stage authorized template/project paths
     explicitly, including dotfiles. Exclude secrets, local settings, and runtime
     state. Commit `chore: initial commit` on `main`; never blanket-stage unknown files.
  4. If the human has a remote URL, `git remote add origin <url>`; otherwise continue without one — every later push step is skipped and noted in the report until a remote exists.
- If a repository already exists, preserve its history and configured remote.
  Record the active branch; account for every uncommitted path before writing.
  Unknown changes or ambiguous ownership mean a human checkpoint, not automatic
  stashing/discarding.
- On a feature branch, stay there. Before any branch switch, inspect existing MCP
  tasks so their pinned integration branch is not stranded.

### 2. Stack detection

Look for application manifests: `pyproject.toml`, `package.json`, `Cargo.toml`,
`go.mod`, `Gemfile`, `composer.json`, `pom.xml`, `build.gradle`, `Dockerfile`, etc.
Do not infer the application stack from the template's coordination server,
its nested dependencies, or its maintenance tests. Note actual application evidence.

Look for a test command in `pyproject.toml` / `package.json` scripts / `Makefile`. Record it.

Note the project directory layout: `src/`, `tests/`, `lib/`, `app/`, etc.

### 3. Pre-interview wiki scan

Before asking anything, check whether `docs/wiki/requirements.md` and `docs/wiki/architecture.md` already exist and contain real content (not just placeholder headings).

**Read anything the argument pointed you at first** — legacy source, an old README, a spec file, existing docs. Those are sources for the same extraction pass, and answers derived from them count as covered exactly like answers from the wiki.

If they do, read them and extract answers for every interview topic below. Mark each topic as either:
- **covered** — the doc has a concrete, non-placeholder answer; no question needed.
- **partial** — some content exists but is incomplete or ambiguous; ask a focused follow-up only.
- **missing** — no content; ask the full question.

Print a one-line summary of what you found before starting the interview, e.g.:
> "Found existing requirements.md and architecture.md. Vision, users, stack, and data are covered. I'll ask about: user stories, out-of-scope, deployment, and non-functional requirements."

If both files are fully populated and all topics are covered, skip the interview entirely and go straight to step 4.

### 4. Interview

Ask only about topics that are **missing** or **partial** from the pre-interview scan. Follow the procedure from the `project-interview` command. Cover these topics (in order), one question at a time, always providing your recommended answer:

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
11. **Design intention** — **ask only if the project has a UI surface** (web, mobile, desktop, TUI). Three questions, no more: what should it feel like (three adjectives), what must it never feel like, and is there an existing design system / component library to adopt. Deeper token work is not an init topic — it goes to `project-interview the design system` once the stack is real.

Open a transcript at `docs/raw/interviews/YYYY-MM-DD-init.md` **before** asking the first question (skip creating it if no questions are needed). Stream Q-by-Q and A-by-A: write the question to disk, ask, write the answer to disk on receipt — never batch. Same enforcement as `project-interview` (see operating rule #7 in `.harness/commands/project/interview.md`).

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
- `docs/wiki/gotchas.md` — create with empty headings (`## Critical`, `## Runtime`, `## Testing`, `## Tooling`) **only if missing. Never clear existing entries** — the template ships this file empty, but a re-run of `project-init` on an established project must not wipe the traps that project has accumulated.
- `docs/wiki/wiki-todos.md` — create empty only if missing; keep any pending lines.
- `docs/wiki/log.md` — init entry (see step 6).
- `docs/wiki/design-system.md` — **conditional.** Create it only if the project has a UI surface (web, mobile, desktop, TUI). Use the design-system template in the `wiki-update` skill, filled with the topic-11 answers; leave the token sections `<TBD>` and file a todo to run `project-interview the design system`. A library, CLI, or headless service project does not get this page — do not create it "for later".

Create entity pages under `docs/wiki/entities/` for each feature/module identified in the interview, with Behavior cases (see `spec-writing` skill).

File ADRs under `docs/wiki/decisions/` for non-trivial choices made during the interview (see `decision-recording` skill).

Every page gets correct frontmatter per the Obsidian LLM-wiki standard (see the `wiki-update` skill).

### 5a. Bootstrap a runnable test command

`project-work` cannot start a Red phase until the test command actually executes. On a greenfield repo the interview answer (`pytest -q`, `npm test`, …) names a command that does not yet run: no dependency manifest, no test directory, nothing installed. Close that gap here — it is the one precondition every later cycle depends on.

1. **Check whether it already runs.** Execute the test command from `docs/wiki/commands.md`. If it exits with "no tests collected" / "0 passing" (or any clean zero-test result), the loop is already runnable — record that and skip to step 6.

2. **If it doesn't run, propose the minimum skeleton.** Present the exact file list and install command to the human via `human-checkpoint` before creating anything. The minimum is only what makes an empty suite executable:
   - the dependency manifest for the detected stack (`pyproject.toml`, `package.json`, `Cargo.toml`, …) declaring the test framework chosen in the interview,
   - the test directory the framework expects (`tests/`, `__tests__/`, …) with nothing in it,
   - the source directory named in `architecture.md ## Layout`, empty.

   No application code, no example module, no placeholder test. The first real test comes from the first `project-work` Red phase.

3. **Install and verify.** Run the install command, then the test command. Confirm it exits cleanly on an empty suite. If installation fails (no network, missing toolchain), stop and run `human-checkpoint` — do not paper over it by writing a fake test command.

4. **Record the verified commands** in `docs/wiki/commands.md`: `## Install`, `## Test`, and whatever else you confirmed. Only commands you have actually run go in this file.

If the human declines the bootstrap, leave `commands.md ## Test` as `<TBD>` and say plainly in the report that `project-work` will refuse to start until a test command runs.

### 6. Personalize canonical project context and regenerate

Read `.harness/project.md`. If it already contains project facts, merge confirmed
updates into it, preserving custom constraints; ask only when conflicting facts
need a decision. Never overwrite established project context with the skeleton.

For a blank project, fill `.harness/project.md` using
[the project skeleton](../../../.harness/templates/project.md.tmpl). Use only facts from the
pre-scan and interview. Keep the shared procedures in `.harness/instructions.md`
and the command/agent definitions intact; the generator owns the catalogs.
Preserve `.harness/settings.json` and any adopting-project role overrides. Change
engine/model/reasoning settings only when the human requests or confirms them.

Run `node scripts/sync-harness.mjs`, then `node scripts/sync-harness.mjs --check`.
This updates `AGENTS.md`, the importing `CLAUDE.md`, and every native adapter.
Do not edit generated files. Do not fill the wiki with this template's migration
history or choose Node.js as the application stack merely because the generator uses it.

### 7. Log it

Append to `docs/wiki/log.md`:

```markdown
## [YYYY-MM-DD HH:MM] init

- Stack: <stack>
- Test command: <command>
- Interview transcript: [YYYY-MM-DD-init](../../../.harness/commands/raw/interviews/YYYY-MM-DD-init.md) (omit if no questions were needed)
- Pages created: <count>
- ADRs: <count>
- Next: run `project-work` to pick up the first todo.
```

### 8. Commit

Inspect `git status` and stage only the paths this initialization created or
changed, including canonical sources, the generated manifest and all regenerated
native outputs. Include approved application skeleton files from step 5a. Do not
stage unrelated files or user-local settings. Commit on the **current authorized
branch**, not a hard-coded main branch:

```bash
git add <explicit-initialization-paths>
git commit -m "chore(init): scaffold wiki and canonical project context"
if git remote get-url origin >/dev/null 2>&1; then
  git push -u origin "$(git branch --show-current)"
fi
```

No remote means local-only work; say so. If no files changed, do not manufacture
an empty initialization commit.

### 8a. Establish develop only for a new project

On first initialization from main, ensure `develop` exists before the first work
cycle. With a clean checkout and no active tasks, create it from the initialized
main commit when absent, or explicitly track the existing remote develop branch.
Never replace an existing branch or silently merge divergent histories. Push it
when a remote is configured.

On a rerun from an active feature/fix/chore branch, stay there; do not create
develop from that feature or switch away merely because initialization finished.
The conductor's `feature-branching` procedure handles the next work cycle.

### 9. Report

Print:

- Stack and test command — and whether the test command was **verified to run** (step 5a) or is still `<TBD>`.
- Pages created vs already present.
- Key decisions from the interview.
- Recommended next step: `project-work` to start on the first todo.

## Failure modes

- If Git state is ambiguous or histories diverge: stop and run `human-checkpoint`.
  No remote is supported; report local-only commits rather than treating it as broken.
- If you can't detect a stack: ask in the interview. Don't guess.
- If a wiki page exists with conflicting frontmatter: append to `docs/wiki/wiki-todos.md`, don't auto-fix.
- If the human won't answer interview questions: scaffold with what you have; mark the rest `<TBD>`.

## What you do NOT do

- **No application code.** This command sets up wiki and schema, plus the empty skeleton step 5a needs to make the test command runnable (manifest, empty `tests/`, empty source dir). It does not generate modules, example tests, or boilerplate — the first real test comes from `project-work`'s Red phase.
- **No assumptions about the stack.** Detect or ask.
- **No second-guessing existing wiki.** If a page exists, leave it. Append to `wiki-todos.md` if it needs cleanup.
