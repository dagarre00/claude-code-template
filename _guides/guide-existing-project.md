# Adapting This Template to an Existing Project

## Overview

This template ships ready for a new project. When you drop it into an **existing** codebase you need to tell the agents what's already there so they don't overwrite your work and don't treat everything as "not yet built."

The two key commands are `/project:init` (detects your stack, merges rather than overwrites) and `/project:interview` (extracts requirements from what already exists instead of starting from scratch).

---

## Step 1: Copy template files into your project root

```bash
# In your existing project root:
cp -r /path/to/claude-code-template/.claude .
cp -r /path/to/claude-code-template/docs .
cp    /path/to/claude-code-template/CLAUDE.md .
```

If you already have a `docs/` folder, move its contents first:

```bash
mkdir -p docs/legacy
mv docs/* docs/legacy/   # preserve existing docs
# then copy template structure
```

---

## Step 2: Run `/project:init` (existing-project mode)

Open Claude Code in your project root and run:

```
/project:init
```

The initializer agent will:
- Detect your tech stack (Node, Python, Go, Rust, Java, Docker)
- **Not** create a venv or run `git init` if they already exist
- **Not** overwrite an existing `.gitignore` — it appends any missing entries
- Populate `docs/wiki/architecture.md` `## Stack` and `## Project Structure` from what it finds
- Discover working commands from `package.json` scripts, `Makefile` targets, `pyproject.toml`, CI configs, etc.
- Record them in `docs/wiki/commands.md`
- Generate `docs/wiki/file-map.md` (three levels deep)

**After init runs**, tell it about your existing codebase:

```
Also scan the existing code and documentation:
1. Read README.md and any docs in docs/legacy/ — extract architectural decisions,
   conventions, and constraints into docs/wiki/architecture.md and docs/wiki/gotchas.md.
2. Scan git log --oneline -50 to understand recent work. Backfill
   docs/wiki/completed.md with features that are already shipped.
3. Create a stub in docs/wiki/entities/ for each major feature/module you find.
4. If any existing commands fail when you test them, record the error and
   workaround in docs/wiki/gotchas.md.
```

---

## Step 3: Run `/project:interview` (extraction mode)

Rather than asking "what do you want to build?", start the interview by telling Claude what already exists:

```
/project:interview

Context: this is an existing project. Before asking me questions, read:
- README.md
- Any files in docs/legacy/
- The git log (last 30 commits)
- The main source directories

Use what you find to pre-fill what you can, then ask me only to confirm,
correct, or fill in gaps — especially for non-functional requirements,
constraints, and out-of-scope decisions that aren't visible in the code.
```

The interview will:
- Pre-populate the Vision, User Stories, and Functional Requirements sections from what it reads
- Ask you to confirm and correct its understanding
- Ask targeted questions about things it can't infer (performance targets, deployment, team constraints)
- Generate `docs/wiki/requirements.md`, entity stubs, and a seeded `docs/wiki/todos.md`

---

## Step 4: Review and correct

After init + interview, manually review these three files and fix anything wrong:

- `docs/wiki/requirements.md` — does it match your actual requirements?
- `docs/wiki/architecture.md` — does the detected stack match reality?
- `docs/wiki/todos.md` — are the priorities right? Add or remove TODOs as needed.
- `docs/wiki/gotchas.md` — add any known failure points the agents won't have discovered

---

## Step 5: Resume normal workflow

```
/project:work    — pick the top TODO and run the full implement→test→review→wiki loop
/project:status  — check project state
/wiki:lint       — health-check the wiki after the first few work sessions
```

---

## Common Scenarios

### "I have a README and scattered docs but no formal requirements"

After Step 2, tell Claude:

```
Read README.md and every markdown file under docs/legacy/. Extract all implied
requirements, architecture decisions, and conventions. Populate
docs/wiki/requirements.md, docs/wiki/architecture.md, and docs/wiki/commands.md
from what you find. Mark anything uncertain with a [NEEDS HUMAN REVIEW] comment.
```

### "I have hundreds of files and a mature codebase"

Tell the initializer:

```
When generating docs/wiki/file-map.md, limit to 3 directory levels deep and
group by module/package. For architecture.md, focus on the top-level structure
and key patterns — don't document every utility. For entity stubs, create one
per top-level feature directory or major module, not one per file.
```

### "I have CI/CD, Docker, and deployment configs"

Tell the initializer:

```
Scan .github/workflows/, Dockerfile*, docker-compose*, Makefile, and any
CI config files. Record all working CI/CD and deployment commands in
docs/wiki/commands.md under "CI/CD" and "Deploy" sections.
Do not modify any CI/CD configuration files.
```

### "My project is a monorepo with multiple services"

Tell the initializer:

```
This is a monorepo. Create one docs/wiki/entities/ stub per service/package.
Update docs/wiki/architecture.md with a monorepo map showing service boundaries
and shared dependencies. When dispatching work agents, scope the task to a
specific service and pass the service path as context.
```

### "My team already has strong git / code conventions"

Tell the interview:

```
Read CONTRIBUTING.md (or equivalent) and encode all existing git and code
conventions in docs/wiki/architecture.md and docs/wiki/gotchas.md. Also update
.claude/skills/git-conventions/SKILL.md and .claude/skills/code-style/SKILL.md
to reflect what's already established — don't override team standards with
template defaults.
```
