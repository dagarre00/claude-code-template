---
description: Run once at project start, or to repair a broken wiki layout — check the workflow wiring, review each role's model, interview for requirements, scaffold docs/wiki with real answers, bootstrap a runnable test command, enforce the architecture, set up CI, and fill in CLAUDE.md.
argument-hint: '[context — e.g. "review the legacy files" | "stack is Django + Postgres"]'
disable-model-invocation: true
---

# /project:init

**Argument:** `$ARGUMENTS`

A non-empty argument **steers the init** before step 3:
- **Points at existing files** (`review the legacy files`, `docs/spec.pdf`) → read them first, extract answers, mark those topics **covered**, and cite the files in `docs/wiki/`.
- **States a fact** (`stack is Django + Postgres`, `no CI yet`) → record it as given and skip asking that topic.
- **Narrows the scope** (`wiki only, skip the test bootstrap`) → honour it and note skipped steps in the report.

Empty → full procedure. Non-existent path → report and ask.

## Preconditions

- Current directory is the project root with `CLAUDE.md` and `.claude/`.

## Steps

### 0. Check and repair the workflow wiring

On an existing codebase adopting the template, automatically merge any missing configuration rather than stopping:

- Verify `.claude/agents/` has all 8 roles (`planner`, `plan-adversary`, `developer`, `adversary`, `triage`, `reviewer`, `wiki-maintainer`, `researcher`), `.claude/commands/project/` has all 7 commands, `.claude/rules/` has `behavioral.md` and `workflow.md`, and `.claude/skills/` has every skill in `workflow.md § Skills`.
- **Verify the Agent tool lists all 8 roles.** If a role file exists on disk but is missing from the Agent tool, ask the human to restart Claude Code and re-run `/project:init` (subagents load at session start — this is the only hard stop in step 0).
- **Merge `.claude/settings.json`:** ensure `permissions.allow` includes `Edit(/.handoff/**)`, `Edit(/docs/wiki/**)`, `Edit(/docs/raw/research/**)`, and the read-only `git` commands (`git status*`, `git diff*`, `git log*`, `git show*`, `git rev-parse*` in `Bash(...)` and `PowerShell(...)`), plus the `conductor-guard` plugin entries (`extraKnownMarketplaces` and `enabledPlugins`).
- **Merge `.gitignore` and `.gitattributes`:** ensure `.gitignore` includes `.claude/settings.local.json`, `.claude/tmp/`, `.claude/worktrees/`, `.handoff/*-plan.md`, `.handoff/*-handoff.md`, `.handoff/*-report.md`, `docs/.obsidian/`, and `.gitattributes` includes `docs/wiki/log.md merge=union`.

Report the wiring status in one line (any merged files land in step 8's commit).

### 0a. Review the role models

Skip on a re-run.
1. Display the 8 roles with their `model` and `effort` from `.claude/rules/workflow.md § Roles`, recommending the defaults (Opus for rare high-leverage reasoning; Sonnet for per-cycle execution).
2. Ask once whether to change any (noting that on Bedrock/Vertex/Foundry, aliases may resolve to older models without `xhigh`).
3. Write confirmed changes into `.claude/agents/<role>.md`.

### 1. Git state

- **Not a git repo:**
  1. `git init -b main`
  2. Keep the shipped `.gitignore` and append stack-specific ignores.
  3. `git add -A && git commit -m "chore: initial commit"` on `main`.
  4. `git remote add origin <url>` if provided (otherwise skip pushes and note in report).
- **On `main` with uncommitted changes** → `human-checkpoint` (commit, stash, or discard).
- **On a feature branch** → warn and stay on the branch.

### 2. Stack detection

Check `pyproject.toml`, `package.json`, `Cargo.toml`, `go.mod`, `Gemfile`, `composer.json`, `pom.xml`, `build.gradle`, `Dockerfile`, and `Makefile`. Record candidate test commands and directory layout (`src/`, `tests/`, `lib/`, `app/`).

### 3. Pre-interview scan

Read any paths from `$ARGUMENTS`, plus `docs/wiki/requirements.md` and `docs/wiki/architecture.md` if populated. Classify each interview topic below as **covered**, **partial**, or **missing**, and print a one-line summary. If all topics are covered, skip to step 5.

### 4. Interview

Follow `/project:interview` **Operating rules** (one question at a time with a recommendation, dependencies first, streaming Q+A to `docs/raw/interviews/YYYY-MM-DD-init.md`). Ask only **missing** or **partial** topics:

1. **Vision** — one sentence: what it does and why.
2. **Users** — types and contexts.
3. **Core user stories** — per user type, prioritized.
4. **Out of scope.**
5. **Stack** — confirm detection or ask language/framework/package manager.
6. **Test framework and command.**
7. **Data** — where state lives.
8. **External services** — APIs, auth, infrastructure.
9. **Deployment** — CI, target environment, release flow.
10. **Non-functional** — performance, security (assets, threat model, trust boundaries), observability, compliance.
11. **Design intention** (*UI projects only*): three adjectives it should feel like, what it must never feel like, and any component/token library.
12. **Architecture** — recommend the four layers (`domain`, `application`, `adapters`, `infrastructure`) mapped to project directories, composition root, and whether a small project merges a layer (record deviations as an ADR).

### 5. Scaffold the wiki

Ensure `docs/raw/interviews/` and `docs/wiki/{entities,concepts,decisions,summaries,reviews}/` exist. Populate with real answers (`<TBD>` only for undiscussed topics):

- `requirements.md` — `## Vision`, `## Users`, `## User stories`, `## Functional requirements`, `## Non-functional requirements`, `## Out of scope`, `## Open questions`.
- `architecture.md` — `## Stack`, `## Layout`, `## Layers`, `## Data`, `## External services`, `## Security`, `## Testing strategy`, `## Conventions`, `## Observability`, `## Deployment`, `## Environments`.
- `git-conventions.md`, `commands.md`, and `todos.md` (seeded with initial work items).
- `gotchas.md` and `wiki-todos.md` — create if missing; never overwrite existing entries.
- `design-system.md` (*UI projects only*, from `wiki-update/design-system-template.md`): fill topic 11, leave token tables `<TBD>` with a todo for `/project:interview the design system`, and add `design-system-check` to `skills:` in `.claude/agents/developer.md`.
- Initial entity pages (`spec-writing`) and ADRs (`decision-recording`), all with valid frontmatter (`wiki-update`).

### 5a. Bootstrap a runnable test command

1. Run the candidate test command with an explicit timeout. If it exits cleanly on zero tests, jump to item 4.
2. Otherwise propose the minimal test skeleton via `human-checkpoint` (manifest with test runner + empty source/test directories; no sample app code or placeholder tests).
3. Install dependencies and verify the test command exits cleanly on zero tests (on failure → `human-checkpoint`).
4. Record verified commands in `docs/wiki/commands.md` (`## Install`, `## Test`, …) using self-contained invocations (`npm test`, `uv run pytest`).
5. **Allowlist for `dontAsk` roles:** add `Bash(<test command>)`, `Bash(<test command> *)`, `PowerShell(<test command>)`, and `PowerShell(<test command> *)` to `permissions.allow` in `.claude/settings.json`.

### 5b. Enforce the architecture

1. Recommend an enforcement mechanism for the stack and confirm with the human:

   | Stack | Compiler boundary | Tool check |
   | --- | --- | --- |
   | TypeScript / JS | workspace packages / TS project references | `dependency-cruiser` or `eslint-plugin-boundaries` |
   | Python | — | `import-linter` (`lint-imports`) |
   | Java / Kotlin | Gradle/Maven modules | ArchUnit / Konsist |
   | C# / .NET | project references per layer | NetArchTest / ArchUnitNET |
   | Go | `internal/` packages | `go-arch-lint` or `depguard` |
   | Rust | workspace crates per layer | compiler check |
   | PHP / Ruby | — | `deptrac` / `packwerk` |

2. Configure the rules from `§ Layers`, install the tool, and record the command in `docs/wiki/commands.md § Architecture` and `architecture.md § Layers` (`Enforced by`).
3. **Prove it fails:** plant a temporary outward import in `domain`, verify the check fails naming that import, then delete the temporary file and verify it passes.
4. **Existing violations** on adopted codebases: baseline them, list under `§ Layers` (`Exceptions`), and file `[infra]` todos to retire them.
5. **Allowlist the architecture command** in `.claude/settings.json` (exact and ` *` prefix forms in `Bash` and `PowerShell`).
6. **File ADR** `decisions/<YYYY-MM-DD>-clean-architecture.md`.

### 5c. Continuous integration

1. Ensure `.gitattributes` has `docs/wiki/log.md merge=union`.
2. Write the PR verification workflow (e.g. `.github/workflows/verify.yml`) running install + test command + architecture check, and record it in `architecture.md § Deployment`.

### 6. Fill in CLAUDE.md

- **Re-run guard:** if `# Project` fields are already populated, run `human-checkpoint` before overwriting.
- **Pre-existing `CLAUDE.md` guard:** fold legacy instructions into `architecture.md` or `gotchas.md` before replacing with the `# Project` block.
- Fill **Name**, **Vision**, **Stack**, and **Application tests**, and replace the template description below them with 1–2 plain-text sentences pointing to `docs/wiki/`.

### 7. Log it

Append to `docs/wiki/log.md` (`date -u +'%Y-%m-%d %H:%M'`):

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
git add docs/ CLAUDE.md .claude/settings.json .gitattributes .gitignore <skeleton-paths> <architecture-rule-files> <ci-workflow> <changed-role-files>
git commit -m "chore(init): scaffold the wiki, a runnable test command and the project facts"
git push -u origin main   # no remote → skip and say so
```

### 8a. Create `develop`

If `develop` exists locally or on `origin`, check it out; otherwise:

```bash
git checkout -b develop
if git remote get-url origin >/dev/null 2>&1; then git push -u origin develop; fi
```

### 9. Report

Summarize stack, verified test/architecture commands, role models, pages/ADRs created, and recommend `/project:work` for the first todo.

## Failure modes

- Divergent `main` or broken git state → `human-checkpoint`.
- Undetectable stack → ask in interview.
- Conflicting frontmatter on existing wiki pages → queue in `docs/wiki/wiki-todos.md`.

## What you do NOT do

- **No application code** beyond step 5a's empty test skeleton.
- **No stack assumptions** without detection or interview confirmation.
- **No overwriting existing wiki pages** without reading and preserving their content.
