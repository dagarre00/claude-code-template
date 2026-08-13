---
name: init
description: Detect project state, interview for product logic only, pick the stack silently, scaffold docs/wiki, bootstrap a skeleton that actually starts, and rewrite CLAUDE.md. Run once at project start.
argument-hint: [context — e.g. "read my notes.md" | "the handoff is in docs/idea.md" | "it's a CLI"]
type: command
---

# /project:init

**Argument:** `$ARGUMENTS`

You are initializing this prototype. This command detects state, interviews the human about **what the thing should do** (never about the stack), picks the technical layer itself, scaffolds the wiki with real answers, bootstraps something that actually starts, and rewrites `CLAUDE.md`.

If the argument is non-empty, treat it as **context that steers the init**:

- **Points at existing material** (`read my notes.md`, `the handoff is in docs/idea.md`) → read those paths first, extract every answer you can, and mark those interview topics **covered** so you don't ask what the human already wrote down. Cite the file in the wiki page you fill from it.
- **States a fact** (`it's a CLI`, `single user`) → record it as a given and skip the matching question.
- **Narrows the scope** (`wiki only, don't scaffold code`) → honour it and say in the report which steps you skipped.

If it names a path that doesn't exist, say so and ask — don't silently proceed.

## Preconditions

- The current directory is the project root.
- `CLAUDE.md` and `.claude/` exist (the schema is on disk).

## Steps

### 1. Git state

Run `git status`.

- **Not a git repo** — the expected state when starting from this template:
  1. `git init -b main` — always pass `-b main`.
  2. **Keep the template's shipped `.gitignore`**; append stack-specific entries, never replace it.
  3. `git add -A` and commit `chore: initial commit` on `main`.
  4. If the human has a remote URL, `git remote add origin <url>`; otherwise continue without one — every later push is skipped and noted in the report.
- **On `main` with uncommitted changes:** stop and run `human-checkpoint`.
- **On a branch:** warn; don't switch.

There is no `develop` branch in this template. `main` is the trunk; work happens on `proto/*` branches.

### 2. Read the ground

Look for what already exists: manifests (`pyproject.toml`, `package.json`, `go.mod`, …), a run command in `Makefile`/scripts, an existing source layout, and — on the machine — which runtimes are actually installed. What's already there beats what you'd have chosen.

### 3. Pre-interview scan

Before asking anything, read `docs/wiki/requirements.md` plus anything the argument pointed you at. Mark each **product** topic below as covered / partial / missing, and print a one-line summary:

> "Read notes.md. Vision, users, and the first capability are covered. I'll ask about: what it must not do, and what the first runnable version looks like."

If everything is covered, skip to step 5.

### 4. Interview — product only

Ask only what's missing, one question at a time, always with your recommended answer. Follow the procedure in `/project:interview` (including the streaming-transcript rule). Topics, in order:

1. **What is this and why does it exist?** — one sentence.
2. **Who operates it?** — usually one person; say so if it is.
3. **What must it do?** — capabilities in priority order.
4. **What must it NOT do?** — explicit non-goals; in a prototype this matters more than the feature list.
5. **What does the first runnable version look like?** — the thinnest thing worth seeing run.
6. **What would make you throw it away?** — the question that tells you what the prototype is actually testing.

**Do not ask about:** language, framework, database, file format, config, ports, process model, testing, CI, deployment, monitoring, scaling, or security posture. Those are yours under the `stack-assumption` skill (behavioral rule 6). If the human volunteers one, record it as a given — it binds you — and don't ask a follow-up about the rest.

Open the transcript at `docs/raw/interviews/YYYY-MM-DD-init.md` **before** the first question; stream Q-by-Q and A-by-A, never batched.

### 5. Pick the stack — silently

Follow the `stack-assumption` skill. Decide language, framework (if any), storage, config, and how it starts, inside the hardware envelope (behavioral rule 20). Write the choices into `architecture.md § Stack` and `§ Prototype constraints`. File an ADR only if you genuinely weighed alternatives. Announce the choices in the step 9 report — do not put them to a vote.

### 6. Scaffold the wiki

Create missing directories: `docs/raw/interviews/`, `docs/wiki/entities/`, `docs/wiki/concepts/`, `docs/wiki/decisions/`, `docs/wiki/summaries/`.

Fill with **real content** (no `<TBD>` except where genuinely undiscussed):

- `docs/wiki/requirements.md` — Vision, Users, User stories, Functional requirements, Out of scope, Open questions. Non-functional stays at its assumed defaults unless the human stated a number.
- `docs/wiki/architecture.md` — Stack, Prototype constraints, Layout, Data, plus the assumed defaults.
- `docs/wiki/commands.md` — Install and **Run**, recorded only after you have executed them (step 7).
- `docs/wiki/entities/<slug>.md` — one page per capability, with `## Slices` (`slice-writing`), three to six each, S1 being whatever makes it start.
- `docs/wiki/todos.md` — seeded from the first entity's slices.
- `docs/wiki/gotchas.md`, `docs/wiki/wiki-todos.md` — create empty only if missing; **never clear existing entries**.
- `docs/wiki/log.md` — the init entry (step 8).

Frontmatter per the Obsidian standard (`wiki-update` skill).

### 7. Bootstrap something that starts

The prototype's front door is the one thing every later cycle depends on. Create the minimum that runs and prints or serves *something*:

- the dependency manifest for the stack you chose,
- the source layout named in `architecture.md § Layout`,
- an entry point that starts and responds (a `/health` route, a `--version`, a startup line — whatever suits).

Then **run it** and paste the real output. Record the verified install and run commands in `docs/wiki/commands.md`. If installing fails (no network, missing toolchain), stop and run `human-checkpoint` — do not record a run command you haven't executed.

Mark the corresponding S1 slice `[x]` on the entity page with the demonstration, since you just did it. Nothing beyond the front door: the first feature comes from `/project:work`.

### 8. Rewrite CLAUDE.md and log it

Copy [`.claude/templates/CLAUDE.md.tmpl`](../../templates/CLAUDE.md.tmpl) to `CLAUDE.md` and fill every `<placeholder>` from the interview and your stack choices. Keep its pointer to `.claude/rules/behavioral.md` — don't paste rules back in. Result under ~100 lines.

Append to `docs/wiki/log.md`:

```markdown
## [YYYY-MM-DD HH:MM] init

- Stack (assumed): <stack>
- Run command: <command> — verified
- Interview transcript: [YYYY-MM-DD-init](../raw/interviews/YYYY-MM-DD-init.md)
- Pages created: <count>
- Next: `/project:work` for the first real slice.
```

### 9. Commit and report

```bash
git add -A
git commit -m "chore(init): scaffold wiki, pick stack, bootstrap runnable skeleton"
git push -u origin main
```

No remote yet? Skip the push and say so. Then report:

- **What you assumed technically**, in a few lines — stack, storage, how it starts, and why each fits one modest machine. Invite them to overrule any of it.
- The verified run command, with the output you saw.
- Pages created, first entity and its slices.
- Next step: `/project:work`.

## Failure modes

- **Git broken (divergent main, no permissions):** stop, `human-checkpoint`.
- **Chosen stack won't install on this machine:** don't fake it. Pick the next option in the envelope, and say in the report that you switched and why.
- **The human insists on a stack outside the envelope:** their call — record it as a given, note the consequence in `architecture.md § Prototype constraints`, and proceed.
- **Existing wiki page with conflicting frontmatter:** append to `docs/wiki/wiki-todos.md`, don't auto-fix.

## What you do NOT do

- **No stack interview.** Detect, choose, record (behavioral rule 6).
- **No application features.** Step 7 is a front door, not a feature.
- **No test scaffolding.** This template has no suite.
- **No second-guessing an existing wiki.** If a page exists, leave it; queue cleanup in `wiki-todos.md`.
