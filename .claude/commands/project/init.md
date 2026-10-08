---
description: Run once at project start, or to repair a broken wiki layout — check the workflow wiring, review each role's model, interview for requirements, scaffold docs/wiki with real answers, bootstrap a runnable test command, enforce the architecture, set up CI, and fill in CLAUDE.md.
argument-hint: '[context — e.g. "review the legacy files" | "stack is Django + Postgres"]'
disable-model-invocation: true
---

# /project:init

**Argument:** `$ARGUMENTS`

A non-empty argument is **context that steers the init**, not a separate task. Resolve it before step 3 and fold it into the pre-interview scan:

- **Points at existing material** (`review the legacy files`, `the spec is in docs/spec.pdf`) → read those paths first, extract every answer you can, and mark those topics **covered**. Cite the file in the wiki page you fill from it.
- **States a fact** (`stack is Django + Postgres`, `no CI yet`) → record it as given, skip that question, and confirm it in the report.
- **Narrows the scope** (`wiki only, skip the test bootstrap`) → honour it and name the skipped steps in the report.

Empty → the full procedure. A path that doesn't exist → say so and ask; never proceed as if the argument were empty.

## Preconditions

- The current directory is the project root, and `CLAUDE.md` and `.claude/` exist.

## Steps

### 0. Check the workflow wiring

Seconds on a new project; it matters on a project adopted into an existing codebase, where copying can land partway.

- `.claude/agents/` holds the eight roles (`planner`, `plan-adversary`, `developer`, `adversary`, `triage`, `reviewer`, `wiki-maintainer`, `researcher`), `.claude/commands/project/` the seven commands, `.claude/rules/` `behavioral.md` and `workflow.md`, and `.claude/skills/` one directory per skill named in `workflow.md § Skills`.
- **The Agent tool lists the eight roles.** A missing one arrived after this session started — subagents load at session start, so ask the human to restart Claude Code, then re-run this command.
- `.claude/settings.json` has the template's `Edit(/.handoff/**)` and `Edit(/docs/wiki/**)` allow rules — an adopted project with its own settings merges them in. Without them the planner and the wiki-maintainer, which run in `dontAsk` mode, cannot write.
- `.claude/settings.json` declares the `conductor-guard` plugin: the `claude-code-template` entry under `extraKnownMarketplaces` and `"conductor-guard@claude-code-template": true` under `enabledPlugins` — an adopted project merges them in. Claude Code then offers the install when a session trusts the folder; `claude plugin list` shows whether it is enabled. It enforces rules 10, 11 and 21 on tool calls and draws the cycle band and `/wiki-nav`. Missing or declined is **not** a hard stop: report it and go on, since the rules still bind without it.
- `.gitignore` carries the template's workflow lines: `.claude/settings.local.json`, `.claude/tmp/`, `.claude/worktrees/`, `.handoff/*-plan.md`, `.handoff/*-handoff.md`, `.handoff/*-report.md`, `docs/.obsidian/`. An adopted project appends the missing ones (committed in step 8) — without them the plan and handoff scratch shows as untracked and fails every clean-tree check.

Report it in one line ("roles loaded, wiring intact, conductor-guard enabled"). A failure here is a hard stop (`human-checkpoint`): nothing past it can dispatch a role.

### 0a. Review the role models

Each role's `model` and `effort` sit in its frontmatter in `.claude/agents/`; `.claude/rules/workflow.md § Roles` lists them. **Skip this step on a re-run** — the human already chose.

1. Show the table, one line per role, and recommend keeping it: the Opus roles are the rare, high-leverage reads (planning, diff review, the periodic audit); the Sonnet roles run every cycle.
2. Ask once whether to change any. The shipped aliases assume the Anthropic API or a Claude plan, where `opus` and `sonnet` resolve to the latest models. On Amazon Bedrock, Google Cloud or Microsoft Foundry they can resolve to older models, where `xhigh` may not exist — say so if the human is on one of them.
3. Write each confirmed change into that role's frontmatter. A full model ID instead of an alias is verified against Anthropic's current model list first, never written from memory.

Report the model and effort per role, one line each. No commit here; it lands in step 8.

### 1. Git state

- **Not a git repo** — the expected state for a new project from the template:
  1. `git init -b main` (always `-b main`; a bare `git init` may create `master`).
  2. **Keep the shipped `.gitignore`** — the workflow relies on its entries. Append stack-specific ones; never replace it.
  3. `git add -A` and commit `chore: initial commit` on `main`, so `.claude/`, `CLAUDE.md` and `docs/` land in the first commit.
  4. `git remote add origin <url>` if the human has one; otherwise every later push is skipped and noted.
- **On `main` with uncommitted changes** → `human-checkpoint`: commit, stash or discard?
- **On a feature branch** → warn; don't switch.

### 2. Stack detection

Look for `pyproject.toml`, `package.json`, `Cargo.toml`, `go.mod`, `Gemfile`, `composer.json`, `pom.xml`, `build.gradle`, `Dockerfile`. Record the test command from manifest scripts or a `Makefile`, and the directory layout (`src/`, `tests/`, `lib/`, `app/`).

### 3. Pre-interview scan

Read whatever the argument pointed at, then `docs/wiki/requirements.md` and `docs/wiki/architecture.md` if they hold real content. Mark each interview topic below **covered** (a concrete answer exists), **partial** (ask a focused follow-up) or **missing** (ask in full). Print a one-line summary first, e.g. "Vision, users, stack and data are covered; I'll ask about user stories, out-of-scope, deployment and non-functional requirements." Everything covered → skip to step 5.

### 4. Interview

Follow `/project:interview`'s **Operating rules** as written (`.claude/commands/project/interview.md`) — one question at a time, each with your recommendation, dependencies first, transcript streamed to disk. Ask only **missing** or **partial** topics, in this order:

1. **Vision** — one sentence: what it does and why it exists.
2. **Users** — types and contexts.
3. **Core user stories** — per user type, in priority order.
4. **Out of scope.**
5. **Stack** — confirm the detection, or ask language, framework, package manager.
6. **Test framework and command.**
7. **Data** — where state lives.
8. **External services** — APIs, auth providers, infrastructure.
9. **Deployment** — CI, target environment, release process.
10. **Non-functional** — performance, security (what is protected, from whom, where input becomes trusted — or that there is no security surface), observability, compliance.
11. **Design intention** — **only with a UI surface** (web, mobile, desktop, TUI): three adjectives it should feel like, what it must never feel like, and any design system or component library to adopt. Token work waits for `/project:interview the design system`.
12. **Architecture** — recommend the four layers of `architecture.md § Layers` (`domain`, `application`, `adapters`, `infrastructure`) mapped to this stack's directories; ask only the directory per layer, the composition root, and whether a small project should merge a layer (a CLI may fold `adapters` into `infrastructure`). A deviation is an ADR. On an existing codebase, propose the mapping from the scan and ask how to treat current violations (step 5b.4).

The transcript is `docs/raw/interviews/YYYY-MM-DD-init.md` (`-init-2` if a same-day run left one), opened before the first question; skip it only if nothing was left to ask. Stop when the human says so, or when every page in step 5 has concrete answers and the first entity has Behavior cases sharp enough to test.

### 5. Scaffold the wiki

Create any missing directory: `docs/raw/interviews/`, `docs/wiki/entities/`, `concepts/`, `decisions/`, `summaries/`, `reviews/`. Fill these with **real answers** — `<TBD>` only for a topic genuinely not discussed:

- `requirements.md` — `## Vision`, `## Users`, `## User stories` (`- As a <user type>, I want <capability>, so that <benefit>.` with Acceptance and `Maps to:`), `## Functional requirements`, `## Non-functional requirements`, `## Out of scope`, `## Open questions`.
- `architecture.md` — `## Stack`, `## Layout`, `## Layers` (topic 12; or step 5b), `## Data`, `## External services`, `## Security` (topic 10 — the adversary and reviewer check against it), `## Testing strategy`, `## Conventions`, `## Observability`, `## Deployment`, `## Environments` (topics 9–10).
- `git-conventions.md` — default branch, branch prefixes, commit format.
- `commands.md` — the detected or confirmed commands.
- `todos.md` — seeded with the first work items.
- `gotchas.md` and `wiki-todos.md` — create empty **only if missing**; never clear existing entries on a re-run.
- `log.md` — the init entry (step 7).
- `design-system.md` — **only with a UI surface**, from the design-system template beside the `wiki-update` skill, filled with the topic-11 answers; token sections stay `<TBD>` with a todo to run `/project:interview the design system`. Never created "for later". Then add `design-system-check` to the `skills:` list in `.claude/agents/developer.md` — the developer writes the UI code, and a preloaded skill is one it cannot miss.

Add an entity page per feature or module (`spec-writing` skill) and an ADR per non-trivial choice (`decision-recording` skill). Every page gets standard frontmatter (`wiki-update` skill).

### 5a. Bootstrap a runnable test command

`/project:work` cannot start Red until the test command executes; on a greenfield repo it doesn't yet.

1. **Run it** with an explicit shell timeout, so a hung command stops instead of outliving the session. A clean zero-test result ("no tests collected", "0 passing") means it is runnable — go to item 4.
2. **Otherwise propose the minimum skeleton** via `human-checkpoint` before creating anything: the dependency manifest declaring the chosen test framework, the framework's empty test directory, and the empty source directory from `architecture.md § Layout`. No application code, no example module, no placeholder test.
3. **Install, then run the test command** and confirm it exits cleanly on an empty suite. An install failure (no network, missing toolchain) → `human-checkpoint`; never paper over it with a fake command.
4. **Record only commands you have run** in `docs/wiki/commands.md` (`## Install`, `## Test`, …). Prefer one plain command line that sets up its own environment (`npm test`, `uv run pytest`, `poetry run pytest`) over one that needs a shell activated first: the roles run exactly that line.
5. **Allowlist it for the roles:** add `Bash(<test command>)` and `PowerShell(<test command>)` to `permissions.allow` in `.claude/settings.json`. The read-only roles, the planner and the wiki-maintainer run in `dontAsk` mode, so a command missing there is one they cannot run — every review would then say it could not run the suite.

Declined → leave `## Test` as `<TBD>` and the allowlist unchanged, and say plainly that `/project:work` will refuse to start until a test command runs.

### 5b. Enforce the architecture

Make the dependency rule a command that fails, let every role run it, and put its rules beyond any role's reach.

1. **Pick the enforcement**, strongest first, and confirm it with the human:

   | Stack | Strongest (compiler) | Tool check |
   | --- | --- | --- |
   | TypeScript / JavaScript | workspace packages per layer (npm/pnpm workspaces, TS project references) | `dependency-cruiser` (`npx depcruise src --config .dependency-cruiser.cjs`), or `eslint-plugin-boundaries` |
   | Python | — | `import-linter` with a `layers` contract (`lint-imports`) |
   | Java / Kotlin | Gradle/Maven modules per layer | ArchUnit `layeredArchitecture()` test; Konsist for Kotlin |
   | C# / .NET | one project per layer, references only inward | NetArchTest or ArchUnitNET test |
   | Go | `internal/` packages | `go-arch-lint`, or `depguard` in golangci-lint |
   | Rust | one crate per layer in a workspace | — (the compiler is the check) |
   | PHP | — | `deptrac` |
   | Ruby | — | `packwerk` |

   A compiler boundary inside the build the test command runs needs no separate command — record the test command as the architecture command. A check written as a test (ArchUnit, NetArchTest) is better still: every Red and Green enforces it.
2. **Write the rules from `§ Layers`**, install the tool, and record the exact command in `docs/wiki/commands.md § Architecture` and `architecture.md § Layers` → Enforced by, naming the rule files it reads.
3. **Prove it fires.** Plant a file in the innermost layer that imports the outermost, run the command, confirm it **fails naming that import**; delete the file and confirm it passes. A check that passes a planted violation watches the wrong paths — never record it.
4. **Existing violations** never block adoption: baseline them (`dependency-cruiser --ignore-known`, `import-linter` `ignore_imports`, a `deptrac` baseline), list them under `§ Layers` → Exceptions, and file one `[infra]` todo per module to retire them. The baseline file is an architecture rule like any other.
5. **Let the roles run it** — allowlist it like the test command (step 5a.5). The rule files it reads are protected by rule 23: no role edits them, and a change to one ships only with an ADR.
6. **File the ADR** `decisions/<date>-clean-architecture.md`: the layer mapping, the tool, any merged layers.

Declined → leave `## Architecture` as `<TBD>` and say in the report that layers are enforced by review alone.

### 5c. Continuous integration

CI is the only enforcement of the conductor's own discipline.

1. `.gitattributes` has `docs/wiki/log.md merge=union` — every cycle appends to the log, and without it two branches conflict on every merge.
2. **Write the CI workflow** (GitHub Actions: `.github/workflows/verify.yml`) on every pull request: checkout, stack setup, install, the test command and the architecture command.
3. Record the pipeline in `architecture.md § Deployment`. No hosted CI → say so; the pre-PR checks in the `pr-create` skill are then the only backstop.

### 6. Fill in CLAUDE.md

`CLAUDE.md` holds only this project's facts; the workflow lives in `.claude/`.

- **Re-run guard.** If none of the four fields under `# Project` still holds its shipped placeholder, the project is initialized — `human-checkpoint`: update one field, leave it, or rewrite it anyway. Never overwrite answered fields blindly.
- **Pre-existing `CLAUDE.md` guard.** One without the template's `# Project` block predates the template: read it, and fold what is worth keeping into `architecture.md` or `gotchas.md`, or keep it below the block. Never overwrite unread content.

Fill the four fields — **Name**, **Vision** (from the interview), **Stack** (step 2), **Application tests** (the step 5a command, or the placeholder if declined) — and replace the paragraphs below them, which describe the template itself, with a sentence or two about this project (a pointer to `docs/wiki/` is enough; plain prose, no wikilinks).

### 7. Log it

Append to `docs/wiki/log.md` (stamp from `date -u +'%Y-%m-%d %H:%M'`):

```markdown
## [YYYY-MM-DD HH:MM] init

- Stack: <stack>
- Test command: <command>
- Architecture: <tool and command, proven on a planted violation — or "not enforced">
- CI: <workflow path — or "none">
- Role models: <"shipped defaults" — or the roles changed>
- Interview transcript: [YYYY-MM-DD-init](../raw/interviews/YYYY-MM-DD-init.md) (omit if nothing was asked)
- Pages created: <count>
- ADRs: <count>
- Next: `/project:work` for the first todo.
```

### 8. Commit

```bash
# plus any step 5a skeleton (manifest, lockfile), the architecture rule files, the CI workflow,
# and each .claude/agents/<role>.md that step 0a or step 5 changed
git add docs/ CLAUDE.md .claude/settings.json .gitattributes .gitignore <skeleton-paths> <architecture-rule-files> <ci-workflow> <changed-role-files>
git commit -m "chore(init): scaffold the wiki, a runnable test command and the project facts"
git push -u origin main   # no remote → skip and say so
```

### 8a. Create `develop`

`/project:work` starts and ends on `develop`. If it exists (locally or remotely), check it out; otherwise:

```bash
git checkout -b develop
if git remote get-url origin >/dev/null 2>&1; then git push -u origin develop; fi
```

### 9. Report

- Stack and test command — **verified to run** (step 5a) or still `<TBD>`.
- Model and effort per role (step 0a), or "shipped defaults".
- Pages created vs already present, and the key decisions.
- Next step: `/project:work` for the first todo.

## Failure modes

- Git broken (divergent `main`) → `human-checkpoint`.
- No detectable stack → ask in the interview; never guess.
- A wiki page with conflicting frontmatter → a line in `docs/wiki/wiki-todos.md`, not an auto-fix.
- The human won't answer → scaffold with what you have and mark the rest `<TBD>`.

## What you do NOT do

- **No application code** — only the empty skeleton step 5a needs. The first real test comes from `/project:work`'s Red phase.
- **No assumptions about the stack.** Detect or ask.
- **No second-guessing an existing wiki.** Leave existing pages; queue cleanup in `wiki-todos.md`.
