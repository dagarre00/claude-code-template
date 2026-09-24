---
name: init
description: Run once at project start, or to repair a broken wiki layout — verify the workflow wiring, configure per-role engines and models, interview for requirements, scaffold docs/wiki with real answers, bootstrap a runnable test command, enforce the architecture, set up CI, and regenerate AGENTS.md/CLAUDE.md.
argument-hint: [context — e.g. "review the legacy files" | "stack is Django + Postgres"]
type: command
---

# /project:init

**Argument:** `$ARGUMENTS`

A non-empty argument is **context that steers the init**, not a separate task. Resolve it before step 3 and fold it into the pre-interview scan:

- **Points at existing material** (`review the legacy files`, `the spec is in docs/spec.pdf`) → read those paths first, extract every answer you can, and mark those topics **covered**. Cite the file in the wiki page you fill from it.
- **States a fact** (`stack is Django + Postgres`, `no CI yet`) → record it as given, skip that question, and confirm it in the report.
- **Narrows the scope** (`wiki only, skip the test bootstrap`) → honour it and name the skipped steps in the report.

Empty → the full procedure. A path that doesn't exist → say so and ask; never proceed as if the argument were empty.

## Preconditions

- The current directory is the project root, and `AGENTS.md` and `.agents/` exist.

## Steps

### 0. Verify the workflow wiring

Seconds on a fresh clone of the template; it matters on a project adopted into an existing codebase, where the mechanical steps can land partway.

- Call `list_roles`. If it errors or no `mcp__workflow__*` tool exists, the server is unreachable — check:
  - `.mcp.json` at the root registers `workflow`.
  - **Claude Code only:** `.claude/settings.json` has `extraKnownMarketplaces.<name>` and `enabledPlugins["project@<name>"]`, where `<name>` is the `name` in `.claude-plugin/marketplace.json` — per project, `workflow-<dir-name>`, as `scripts/adopt.sh` derives it. A name shared with another project on this machine serves that project's skills here (`tools/workflow-mcp/getting-started.md` § Troubleshooting); rename it in both files and restart the session. Codex and Antigravity read `.agents/` directly and need neither file.
  - Point the human at `README.md § Quick start` or a re-run of `scripts/adopt.sh`.
- `tools/workflow-mcp/node_modules/` exists; if not, `npm install` there — every later cycle dispatches.

Report it in one line ("workflow-mcp reachable, wiring intact"). A failure here is a hard stop (`human-checkpoint`): nothing past it can dispatch a worker.

### 0a. Configure per-role engines and models

`.agents/config.json` ships with the template maintainer's working defaults, not a recommendation for this project, and model ids churn. **Skip this step on a re-run** once `roles`/`engines` no longer match a fresh template — the human already chose.

1. **Detect installed engines** — `claude`, `codex`, `agy` on PATH. A role can only be pinned to an installed engine.
2. **Ask, per role** in `config.json`: which engine runs it, and which tier (`reasoning`, `balanced`, `fast`) or named model. Offer the shipped value as the recommended default, so the human can accept all of them in one answer. `researcher`, `reviewer`, `triage` and `wiki-maintainer` default to `"engine": null` (follow the conductor) — pin them only if asked.
3. **Verify every model id before writing it, defaults included.** Never trust an id from memory — yours or the shipped file's. Search the vendor's current model list and confirm the exact slug; one you cannot confirm is reported to the human, not written.
4. **Write the confirmed `engine`/`models`/`effort`** into `config.json` in its existing shape. A model sits only under the engine that runs it — `gpt-*` under `codex`, `claude-*` under `claude`, `gemini-*` (also `claude-*`, `gpt-oss-*`) under `antigravity`; the loader refuses anything else.

A human who would rather review than answer can use the editor, `node tools/workflow-mcp/config-ui.mjs` ([`config.md`](../../tools/workflow-mcp/config.md) is the guide) — it edits the same file and refuses invalid values. Never run it for them.

Report the resolved engine + model per role, one line each. No commit here; it lands in step 8.

### 1. Git state

- **Not a git repo** — the expected state for a new project from the template:
  1. `git init -b main` (always `-b main`; a bare `git init` may create `master`).
  2. **Keep the shipped `.gitignore`** — the workflow relies on its entries. Append stack-specific ones; never replace it.
  3. `git add -A` and commit `chore: initial commit` on `main`, so `.agents/`, `CLAUDE.md` and `docs/` land in the first commit.
  4. `git remote add origin <url>` if the human has one; otherwise every later push is skipped and noted.
- **On `main` with uncommitted changes** → `human-checkpoint`: commit, stash or discard?
- **On a feature branch** → warn; don't switch.

### 2. Stack detection

Look for `pyproject.toml`, `package.json`, `Cargo.toml`, `go.mod`, `Gemfile`, `composer.json`, `pom.xml`, `build.gradle`, `Dockerfile`. Record the test command from manifest scripts or a `Makefile`, and the directory layout (`src/`, `tests/`, `lib/`, `app/`).

### 3. Pre-interview scan

Read whatever the argument pointed at, then `docs/wiki/requirements.md` and `docs/wiki/architecture.md` if they hold real content. Mark each interview topic below **covered** (a concrete answer exists), **partial** (ask a focused follow-up) or **missing** (ask in full). Print a one-line summary first, e.g. "Vision, users, stack and data are covered; I'll ask about user stories, out-of-scope, deployment and non-functional requirements." Everything covered → skip to step 5.

### 4. Interview

Follow `/project:interview`'s **Operating rules** as written (`.agents/commands/interview.md`) — one question at a time, each with your recommendation, dependencies first, transcript streamed to disk. Ask only **missing** or **partial** topics, in this order:

1. **Vision** — one sentence: what it does and why it exists.
2. **Users** — types and contexts.
3. **Core user stories** — per user type, in priority order.
4. **Out of scope.**
5. **Stack** — confirm the detection, or ask language, framework, package manager.
6. **Test framework and command.**
7. **Data** — where state lives.
8. **External services** — APIs, auth providers, infrastructure.
9. **Deployment** — CI, target environment, release process.
10. **Non-functional** — performance, security, observability, compliance.
11. **Design intention** — **only with a UI surface** (web, mobile, desktop, TUI): three adjectives it should feel like, what it must never feel like, and any design system or component library to adopt. Token work waits for `/project:interview the design system`.
12. **Architecture** — recommend the four layers of `architecture.md § Layers` (`domain`, `application`, `adapters`, `infrastructure`) mapped to this stack's directories; ask only the directory per layer, the composition root, and whether a small project should merge a layer (a CLI may fold `adapters` into `infrastructure`). A deviation is an ADR. On an existing codebase, propose the mapping from the scan and ask how to treat current violations (step 5b.4).

The transcript is `docs/raw/interviews/YYYY-MM-DD-init.md`, opened before the first question; skip it only if nothing was left to ask. Stop when the human says so, or when every page in step 5 has concrete answers and the first entity has Behavior cases sharp enough to test.

### 5. Scaffold the wiki

Create any missing directory: `docs/raw/interviews/`, `docs/wiki/entities/`, `concepts/`, `decisions/`, `summaries/`. Fill these with **real answers** — `<TBD>` only for a topic genuinely not discussed:

- `requirements.md` — `## Vision`, `## Users`, `## User stories` (`- As a <user type>, I want <capability>, so that <benefit>.` with Acceptance and `Maps to:`), `## Functional requirements`, `## Non-functional requirements`, `## Out of scope`, `## Open questions`.
- `architecture.md` — `## Stack`, `## Layout`, `## Layers` (topic 12; or step 5b), `## Data`, `## External services`, `## Testing strategy`, `## Conventions`, `## Deployment`.
- `git-conventions.md` — default branch, branch prefixes, commit format.
- `commands.md` — the detected or confirmed commands.
- `todos.md` — seeded with the first work items.
- `gotchas.md` and `wiki-todos.md` — create empty **only if missing**; never clear existing entries on a re-run.
- `log.md` — the init entry (step 7).
- `design-system.md` — **only with a UI surface**, from the design-system template beside the `wiki-update` skill, filled with the topic-11 answers; token sections stay `<TBD>` with a todo to run `/project:interview the design system`. Never created "for later". Then add `design-system-check` to the `developer` list in `.agents/commands/work.md`'s `skills:` — the developer is the one writing UI code, and it only receives declared skills.

Add an entity page per feature or module (`spec-writing` skill) and an ADR per non-trivial choice (`decision-recording` skill). Every page gets standard frontmatter (`wiki-update` skill).

### 5a. Bootstrap a runnable test command

`/project:work` cannot start Red until the test command executes; on a greenfield repo it doesn't yet.

1. **Run it.** A clean zero-test result ("no tests collected", "0 passing") means it is runnable — skip to step 6.
2. **Otherwise propose the minimum skeleton** via `human-checkpoint` before creating anything: the dependency manifest declaring the chosen test framework, the framework's empty test directory, and the empty source directory from `architecture.md § Layout`. No application code, no example module, no placeholder test.
3. **Install, then run the test command** and confirm it exits cleanly on an empty suite. An install failure (no network, missing toolchain) → `human-checkpoint`; never paper over it with a fake command.
4. **Record only commands you have run** in `docs/wiki/commands.md` (`## Install`, `## Test`, …).
5. **Update the worker allowlist:** replace the shipped `"npm test"` in `.agents/config.json` `workerCommands` with the verified test command, keeping the read-only `git` entries. Every worker prompt names this list, so a wrong entry is a Red no worker can confirm.
6. **An environment a fresh worktree lacks** (a Python virtualenv, `node_modules`): decide with the human per `tools/workflow-mcp/engine-setup.md` § Projects with a Python virtualenv. A per-worktree environment goes in `worktreeSetup` (its output gitignored); a shared one needs its own worktree-relative `workerCommands` entry. Then call `check` and resolve any `setup` block for the engines your roles use.

Declined → leave `## Test` as `<TBD>` and `workerCommands` unchanged, and say plainly that `/project:work` will refuse to start until a test command runs.

### 5b. Enforce the architecture

Make the dependency rule a command that fails, grant it to every worker, and put its rules beyond any worker's reach.

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
2. **Write the rules from `§ Layers`**, install the tool, and record the exact command in `docs/wiki/commands.md § Architecture` and `architecture.md § Layers` → Enforced by.
3. **Prove it fires.** Plant a file in the innermost layer that imports the outermost, run the command, confirm it **fails naming that import**; delete the file and confirm it passes. A check that passes a planted violation watches the wrong paths — never record it.
4. **Existing violations** never block adoption: baseline them (`dependency-cruiser --ignore-known`, `import-linter` `ignore_imports`, a `deptrac` baseline), list them under `§ Layers` → Exceptions, and file one `[infra]` todo per module to retire them. The baseline file is an architecture rule like any other.
5. **Wire it in:** `.agents/config.json` `"architecture": { "command": "<command>", "rules": ["<rule file>", "<baseline, if any>"] }`. The command joins every worker's allowlist, the rule files become protected, and `verify.mjs` fails a branch that changes them without an ADR. Keep `protectedPaths` at least `[".agents"]`. `check` must then report `architecture.enforced: true`.
6. **File the ADR** `decisions/<date>-clean-architecture.md`: the layer mapping, the tool, any merged layers.

Declined → leave `architecture.command` null and say in the report that layers are enforced by review alone.

### 5c. Continuous integration

CI is the only enforcement of the conductor's own discipline.

1. `.gitattributes` has `docs/wiki/log.md merge=union` — every cycle appends to the log, and without it two branches conflict on every merge.
2. **Write the CI workflow** (GitHub Actions: `.github/workflows/verify.yml`) on every pull request: full-history checkout, stack setup, install, the test command, the architecture command, and `node tools/workflow-mcp/verify.mjs --base origin/${{ github.base_ref }}`. The template's own `verify.yml` is a starting shape only: drop its workflow-mcp test step (template-only) and add the `--base` it omits — the template keeps an empty wiki, so it cannot run the range checks this project depends on.
3. Record the command in `docs/wiki/commands.md § Verify` and the pipeline in `architecture.md § Deployment`. No hosted CI → say so; the conductor then runs verify before every PR (`/project:work` step 10) and nothing else backs it.

### 6. Fill in project.md and regenerate

`AGENTS.md` and `CLAUDE.md` are rendered from `.agents/` by the MCP's `sync`; `.agents/project.md` is the only per-project input.

- **Re-run guard.** If none of `project.md`'s four fields still holds its shipped placeholder, the project is initialized — `human-checkpoint`: update one field, leave it, or regenerate anyway. Never overwrite answered fields blindly.
- **Hand-written `CLAUDE.md` guard.** `sync` overwrites `CLAUDE.md`. One without the "Generated from `.agents/`" banner predates the template: read it and fold what is worth keeping into `architecture.md` or `gotchas.md` first. Never `sync` over unread content.

Fill the four fields — **Name**, **Vision** (from the interview), **Stack** (step 2), **Application tests** (the step 5a command, or the placeholder if declined) — and replace the paragraph below them, which describes the template itself, with a sentence or two about this project (a pointer to `docs/wiki/` is enough; plain prose, no wikilinks). Then call `sync`, and `check` must report `ok: true`.

### 7. Log it

Append to `docs/wiki/log.md` (stamp from `date -u +'%Y-%m-%d %H:%M'`):

```markdown
## [YYYY-MM-DD HH:MM] init

- Stack: <stack>
- Test command: <command>
- Architecture: <tool and command, proven on a planted violation — or "not enforced">
- CI: <workflow path — or "none">
- Interview transcript: [YYYY-MM-DD-init](../raw/interviews/YYYY-MM-DD-init.md) (omit if nothing was asked)
- Pages created: <count>
- ADRs: <count>
- Next: `/project:work` for the first todo.
```

### 8. Commit

```bash
# plus any step 5a skeleton (manifest, lockfile), the architecture rule files, the CI workflow,
# and .agents/commands/work.md if step 5 declared design-system-check
git add docs/ CLAUDE.md AGENTS.md .agents/project.md .agents/config.json .gitattributes <skeleton-paths> <architecture-rule-files> <ci-workflow>
git commit -m "chore(init): scaffold wiki, regenerate AGENTS.md/CLAUDE.md, and a runnable test command"
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
- Engine + model per role (step 0a), or "left at shipped defaults".
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
