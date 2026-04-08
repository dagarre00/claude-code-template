# Using the Multi-Agent Workflow on an Existing Project

## The Problem

The scaffold prompt assumes an empty repo. With an existing codebase and docs, you need to **adapt** the scaffold rather than overwrite your project.

---

## Step 1: Run the scaffold prompt with this prefix

Open Claude Code (Opus) **in your existing project root** and prepend this to the main prompt:

```
IMPORTANT CONTEXT: This is an existing project with an established codebase and documentation.

Before executing the scaffold steps, do the following adaptation:

1. DO NOT run `git init` — the repo already exists
2. DO NOT create virtual environments if one already exists (check for venv/, .venv/, node_modules/, etc.)
3. DO NOT create .gitignore if one exists — append any missing entries instead
4. When creating `docs/`, preserve any existing `docs/` content by:
   - Moving existing docs to `docs/legacy/` first
   - Creating the new knowledge base structure alongside them
   - Adding `[[legacy/filename]]` links in INDEX.md for each preserved doc
5. When creating `.claude/rules/behavioral.md`, scan the git log and any existing
   CLAUDE.md, README, or CONTRIBUTING files for existing conventions and constraints.
   Encode those as behavioral rules rather than starting from the seed rules alone.
6. When the initializer agent runs, it should scan the EXISTING codebase and docs to populate:
   - `architecture.md` from actual code structure (not a blank template)
   - `quick-ref.md` from real stack detection
   - `commands-registry.md` from existing package.json scripts, Makefile targets, or shell scripts
   - `project-state.md` with existing features listed as "Completed" and pending work as TODOs
7. Scan existing documentation and extract requirements into `project-requirements.md` format
8. Make the initial commit message: "chore: integrate multi-agent workflow into existing project"

Now proceed with the full scaffold below, respecting these adaptations:

[PASTE THE FULL SCAFFOLD PROMPT HERE]
```

---

## Step 2: After scaffolding, run the initializer with extra context

```
/project:init
```

The initializer agent will auto-detect your stack. Then follow up with:

```
Use the initializer agent again. This time:
1. Read every file in docs/legacy/ and extract architectural decisions,
   conventions, or requirements into the appropriate knowledge base docs
2. Run the test suite if one exists and record working test commands
   in commands-registry.md
3. Run the build/start commands and record what works in commands-registry.md
4. Analyze git log --oneline -50 to understand recent development activity
   and update project-state.md
5. If any commands fail, add them to docs/agent-context/gotchas.md with
   the error message and workaround
```

---

## Step 3: Validate and fill gaps

```
/project:sync-docs
```

Then manually review — or run `/project:interview` to have Claude walk you through refining — these three files:

- `docs/project-requirements.md` — does it capture your actual requirements?
- `docs/architecture.md` — does the detected stack and conventions match reality?
- `docs/project-state.md` — are completed features and TODOs accurate?

Edit anything that's wrong. Add any behavioral rules you already know about to `.claude/rules/behavioral.md` (e.g., "never touch the legacy auth module directly" or "always use the ORM, never raw SQL").

---

## Step 4: Resume normal workflow

```
/project:plan       — generate tasks from requirements
/project:research   — investigate a specific task before building
/project:work       — research → plan → confirm → implement → review
/project:status     — check progress
/project:review     — review changes before merging
```

---

## Common Scenarios

### "I have a README and scattered docs but no formal requirements"

After scaffolding, tell Claude:

```
Read README.md and every markdown file in the project. Extract all implied
requirements, architecture decisions, and conventions. Populate
project-requirements.md, architecture.md, and commands-registry.md
from what you find. Mark anything uncertain with a [NEEDS HUMAN REVIEW] tag.
```

### "I have a mature project with hundreds of files"

Add this to the prefix:

```
This is a large project. When generating file-map.md, limit to 3 directory
levels deep and group files by module/package rather than listing every file.
For architecture.md, focus on the top-level structure and key patterns —
don't document every utility function.
```

### "I have existing CI/CD, Docker, and deployment configs"

Add:

```
Scan .github/workflows/, Dockerfile*, docker-compose*, Makefile, and any
CI config files. Record all working CI/CD and deployment commands in
commands-registry.md under "CI/CD Commands" and "Deploy Commands" sections.
Do not modify any CI/CD configuration files.
```

### "My project uses a monorepo with multiple services"

Add:

```
This is a monorepo. Create a separate quick-ref section per service/package
in docs/agent-context/. The orchestrator should scope tasks to specific
services and pass the service path to implementer agents. Update architecture.md
with a monorepo map showing service boundaries and shared dependencies.
```

### "My team already has strong git conventions"

Add:

```
Read CONTRIBUTING.md (or equivalent) and encode all git conventions as
behavioral rules in .claude/rules/behavioral.md. Do NOT put them in CLAUDE.md
(it's injected every turn and should stay small). Create a git-conventions
skill in .claude/skills/ that the implementer loads at commit time only.
```
