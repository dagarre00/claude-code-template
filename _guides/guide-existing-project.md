# Existing Project Guide

## The difference from a new project

| New project | Existing project |
|---|---|
| `/project:interview` defines everything from scratch | `/project:init` reads your codebase and populates the wiki from what it finds |
| requirements.md starts blank | requirements.md is backfilled from your existing docs/code |
| Entity pages are stubs | Entity pages are populated from detected behavior |
| `/project:interview` for initial requirements | `/project:feature` to add new features (appends, never rewrites) |

---

## Step by step

### 1. Clone the template files into your project

Copy the `.claude/` directory and top-level config files from this template into your existing repo root. Do **not** overwrite:
- Your existing `.gitignore` — append the template's entries instead
- Your existing `docs/` — move them to `docs/legacy/` first if there's a conflict

```bash
# From the template repo
cp -r .claude /path/to/your-project/
cp CLAUDE.md HUMAN.md SETUP.md /path/to/your-project/
cp .claude/settings.local.json.template /path/to/your-project/.claude/settings.local.json
```

Commit this as: `chore: integrate wiki-driven workflow`

### 2. Initialize from your existing codebase — `/project:init`

```
/project:init
```

The initializer agent scans your project and populates the wiki from what it finds:
- `docs/wiki/architecture.md` — detected stack, conventions, layering
- `docs/wiki/commands.md` — commands from `package.json`, `Makefile`, CI configs, etc.
- `docs/wiki/file-map.md` — project tree (3 levels deep)

Then follow up in the same session:

```
Read every file in docs/legacy/ (or README.md and existing docs).
Extract all implied requirements, architecture decisions, and conventions.
Populate docs/wiki/requirements.md and docs/wiki/entities/ from what you find.
Mark anything uncertain with a [NEEDS HUMAN REVIEW] tag.
```

### 3. Backfill requirements

Review and correct:
- `docs/wiki/requirements.md` — does it capture your actual requirements?
- `docs/wiki/architecture.md` — does the detected stack and conventions match reality?
- `docs/wiki/entities/` — is there an entity page for each major feature?

Edit anything wrong directly. Then seed the TODO queue for remaining work:
```
/project:work    — Claude reads requirements and creates TODOs for gaps
```

Or run the full initial interview if no structured requirements exist:
```
/project:interview
```
Note: `/project:interview` **rewrites** `requirements.md`. Only use it if you want to start the spec fresh.

### 4. Add new features — `/project:feature`

When adding a new feature to the existing project (new auth method, new API endpoint, new UI flow):

```
/project:feature
```

This interviews you about the **new feature only**, then:
- **Appends** to `requirements.md` (preserves everything already there)
- Creates `docs/wiki/entities/<slug>.md` with the `## Behavior` spec filled in
- Flags contradictions with existing requirements
- Seeds new TODOs scoped to the feature

After this runs, `/project:work` picks up the new TODOs.

### 5. Build — `/project:work`

Same as a new project. Claude classifies each TODO:
- **Simple** — main agent handles Red → Green → Refactor inline
- **Complex** — dispatches tester, implementer, and wiki-maintainer agents
- **Batch** — groups 2–3 Simple TODOs sharing the same entity

The wiki-drift-check hook warns at session end if you touched code without updating the matching entity page.

---

## Common scenarios

### "I have a README and scattered docs but no formal requirements"

After `/project:init`, run:
```
Read README.md and every markdown file in the project.
Extract all implied requirements, architecture decisions, and conventions.
Populate docs/wiki/requirements.md and docs/wiki/entities/ from what you find.
Mark anything uncertain with a [NEEDS HUMAN REVIEW] tag.
```
Then review and edit the generated pages.

### "My project has a large codebase (hundreds of files)"

Tell the initializer:
```
This is a large project. Limit file-map.md to 3 directory levels.
For architecture.md, focus on top-level structure and key patterns — not every utility.
```

### "I have existing CI/CD, Docker, and deployment configs"

Tell the initializer:
```
Scan .github/workflows/, Dockerfile*, docker-compose*, Makefile, and CI config files.
Record all working CI/CD and deployment commands in docs/wiki/commands.md.
Do not modify any CI/CD configuration files.
```

### "My project is a monorepo with multiple services"

Tell the initializer:
```
This is a monorepo. Create a section per service in docs/wiki/architecture.md
with service boundaries and shared dependencies. Create one entity page per service.
```

### "My team has strong git conventions"

Add your conventions as behavioral rules:
```
Read CONTRIBUTING.md and encode all git conventions in .claude/rules/behavioral.md.
```
Or create a skill file in `.claude/skills/` that agents load only at commit time.

### "I have existing tests"

Tell Claude to map them to entity pages:
```
Read the test suite. For each test file, find or create the matching
docs/wiki/entities/<slug>.md and populate ## Behavior from what the tests cover.
```
This makes the existing tests the spec, and future `/project:work` iterations extend them.

---

## Daily workflow (same as new project)

**Morning**
```
/project:status     — pending TODOs, recent log
/wiki:log 10        — what changed
/project:work       — top TODO
```

**Adding a new feature**
```
/project:feature    — interview → spec → entity page → TODOs
/project:work       — implement the new TODOs
```

**End of session**
```
/project:checkpoint — git tag + snapshot
/wiki:lint          — catch drift, dead links, orphaned pages
```

Every ~5 TODOs:
```
/project:review     — full audit: code vs spec, security, hidden bugs
```
