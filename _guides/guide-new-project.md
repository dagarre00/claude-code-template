# Using the Multi-Agent Workflow on a New Project

## Quick Start (5 minutes)

```bash
# 1. Create and enter your project directory
mkdir my-project && cd my-project

# 2. Start Claude Code with Opus
claude --model opus

# 3. Paste the entire scaffold prompt from multi-agent-workflow-prompt.md
#    Claude will create ~30 files across docs/, .claude/, and root
```

Wait for Claude to finish all 11 execution steps and confirm the self-test passes.

---

## Step-by-Step After Scaffolding

### 1. Define your requirements

You have two options:

**Option A: Guided interview (recommended)**
```
/project:interview
```
Claude walks you through a structured conversation — one question at a time — covering vision, user stories, functional requirements, non-functional requirements, constraints, and out of scope. It writes to `docs/project-requirements.md` after each phase so progress is saved even if the session is interrupted.

**Option B: Write them manually**

Open `docs/project-requirements.md` in your editor (or Obsidian) and fill in:

- **Vision** — one sentence on what this project does and for whom
- **User Stories** — "As a [user], I can [action]" format, bullet list
- **Functional Requirements** — what the system must do
- **Non-Functional Requirements** — stack, performance, testing, CI
- **Constraints** — budget, timeline, infrastructure limits
- **Out of Scope** — what you're explicitly NOT building

See `example-project-requirements.md` for a complete example.

### 2. Initialize the project

```
/project:init
```

This dispatches the `initializer` agent, which will:
- Detect your stack (or ask you if the directory is empty)
- Create the virtual environment
- Set up git and .gitignore
- Populate `architecture.md`, `quick-ref.md`, and `commands-registry.md`

### 3. Generate a task plan

```
/project:plan
```

This reads your requirements and current state, then writes prioritized TODOs to `project-state.md`. Review the plan — reorder, remove, or add tasks before proceeding.

### 4. Start building

```
/project:work
```

This triggers the full pipeline:
1. **Researcher** investigates the top-priority TODO, writes a plan to `docs/plans/`
2. **You confirm** the plan (or request changes)
3. **Implementer** executes the plan in an isolated worktree
4. **Reviewer** checks the changes
5. **Orchestrator** updates project-state.md and runs docs-maintainer

Or, for a more hands-on pair-programming style:

```
/project:research
```

Research a specific task first, review the plan, then tell Claude to implement it directly. This is the "slow is smooth, smooth is fast" approach that many production users prefer.

### 5. Monitor progress

```
/project:status     — see what's done and what's next
/project:review     — review all uncommitted changes
/project:sync-docs  — update the knowledge base
```

### 6. Manage sessions

```
/project:checkpoint  — save a rollback point before risky work
/project:rollback    — revert to a checkpoint if something goes wrong
/project:fresh       — start a new session with state from the last checkpoint
```

---

## Recommended Daily Flow

```
Morning:
  1. /project:status (where are we?)
  2. /project:plan (anything new to add?)
  3. /project:work (start the top TODO)

During work:
  - /project:checkpoint before anything risky
  - /project:review after each feature
  - If context feels heavy → /project:fresh

End of day:
  - /project:checkpoint (save state)
  - /project:sync-docs (keep knowledge base current)
  - /project:status (log what happened)
```

---

## Tips for New Projects

1. **Start with 3-5 requirements, not 30.** Get the first feature working end-to-end before expanding scope. The agents work better with focused tasks.

2. **Edit `docs/agent-context/gotchas.md` early.** After your first session, you'll notice patterns that trip Claude up. Write them down immediately — this is the highest-value document in the project.

3. **Add behavioral rules as you go.** Every time something goes wrong, add a one-liner to `.claude/rules/behavioral.md`. These compound into institutional knowledge.

4. **Don't over-orchestrate.** For simple changes, just talk to Claude directly. Use `/project:work` for multi-step features. Use agent teams only when you have 3+ truly independent tasks.

5. **Browse docs/ in Obsidian** at least once a day. The graph view shows how your knowledge base is connected and helps you spot gaps.
