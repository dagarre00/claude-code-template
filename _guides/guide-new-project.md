# New Project Guide

## Quick start (5 minutes)

```bash
# 1. Clone the template into a new directory
git clone <this-repo> my-project && cd my-project

# 2. Unlock Write/Edit/Bash (required once per clone)
cp .claude/settings.local.json.template .claude/settings.local.json

# 3. Open in Claude Code
claude

# 4. Gather initial requirements (one-time, covers the whole project)
/project:interview

# 5. Detect stack and seed the wiki
/project:init

# 6. Start building
/project:work
```

---

## Step by step

### 1. Clone and configure

```bash
git clone <this-repo> my-project
cd my-project
cp .claude/settings.local.json.template .claude/settings.local.json
```

The settings template grants Claude Code the Write/Edit/Bash permissions the agents need. The base `settings.json` stays read-only so your team config isn't accidentally overwritten.

### 2. Gather initial requirements — `/project:interview`

Run this **once** to define the whole project. Claude interviews you one question at a time across six phases:

1. **Vision** — what it does, who it's for
2. **User stories** — walk the full user journey
3. **Functional requirements** — what the system must do
4. **Non-functional** — stack, performance, testing, CI/CD
5. **Constraints** — budget, timeline, team size
6. **Out of scope** — what v1 explicitly doesn't include

The transcript is saved to `docs/raw/interviews/` (immutable). Claude then ingests it into:
- `docs/wiki/requirements.md` — the living spec
- `docs/wiki/entities/<slug>.md` — one stub per feature area
- `docs/wiki/todos.md` — prioritized TODO queue

> **For adding features later, use `/project:feature` instead** — it appends to requirements.md without overwriting. `/project:interview` is for initial project setup only.

### 3. Initialize the stack — `/project:init`

```
/project:init
```

The initializer agent detects your stack (or asks if the directory is empty), then populates:
- `docs/wiki/architecture.md` — stack, conventions, patterns
- `docs/wiki/commands.md` — working shell commands
- `docs/wiki/file-map.md` — project tree

Review `docs/wiki/architecture.md` and correct anything it got wrong. This is the document all agents read before writing code.

### 4. Review the generated wiki

Browse `docs/wiki/` in Obsidian or your editor. Check:
- `docs/wiki/requirements.md` — does it capture everything you said?
- `docs/wiki/todos.md` — is the priority order right?
- `docs/wiki/entities/` — are there stubs for each feature area?

Edit anything that's wrong. The wiki is yours to correct.

### 5. Start building — `/project:work`

```
/project:work
```

Each run picks the top pending TODO and runs the TDD loop. Claude classifies the task first:

- **Simple** (≤2 files, <50 lines) — Claude handles all phases inline: Red → Green → Refactor
- **Complex** (multiple files, new patterns, ADR-worthy) — dispatches tester agent (Red), implementer agent (Green + Refactor), wiki-maintainer (wiki update)
- **Batch** — if 2–3 Simple TODOs share the same feature, Claude loads context once and implements them together

The cycle:
1. Classify and plan — Claude presents a plan and waits for your OK
2. Branch — `feat/<slug>` created automatically
3. **Red** — failing tests written from the entity's `## Behavior` spec
4. **Green** — minimal code to pass all tests
5. **Refactor** — clean up without changing behavior
6. **Wiki update** — entity page revised, TODO moved to completed, log updated
7. **Commit** — conventional commit message

### 6. Add features as the project grows — `/project:feature`

```
/project:feature
```

When you want to add a new feature (e.g., a second auth method, an export endpoint), use this instead of `/project:interview`. It:
- Interviews you about the new feature only (not the whole project)
- **Appends** to `requirements.md` (never rewrites)
- Creates the entity page with `## Behavior` already filled in (Given/When/Then)
- Seeds new TODOs for just that feature

After this runs, `/project:work` picks up the new TODOs automatically.

---

## Daily workflow

**Morning**
```
/project:status     — what's pending, what changed
/wiki:log 10        — recent decisions and ops
/project:work       — start the top TODO
```

**During work**
```
/project:checkpoint         — before risky refactors
/wiki:query <question>      — ask the wiki instead of guessing
```
Every ~5 completed TODOs:
```
/project:review             — full audit: code vs spec, security, hidden bugs
```

**End of session**
```
/project:checkpoint         — git tag + snapshot
/wiki:lint                  — catch dead links, drift, orphaned pages
```
If context feels heavy:
```
/project:fresh              — resume from checkpoint in a new session (not /compact)
```

---

## Tips

1. **Start with 3–5 requirements, not 30.** Get one feature working end-to-end before expanding scope. The TDD loop works best with focused tasks.

2. **Edit `docs/wiki/gotchas.md` early.** After your first session you'll notice patterns that trip Claude up. Write them down — this is the highest-signal document in the project.

3. **Add behavioral rules as failures occur.** Every time something goes wrong, add a one-liner to `.claude/rules/behavioral.md`. These compound into institutional knowledge.

4. **Browse `docs/wiki/` in Obsidian at least once a day.** The graph view shows how your knowledge base is connected and surfaces gaps you wouldn't notice in a text editor.

5. **The wiki is truth.** If Claude produces code that doesn't match the spec, fix the spec first (if the spec is wrong) or the code (if the code is wrong). Never let them silently diverge.
