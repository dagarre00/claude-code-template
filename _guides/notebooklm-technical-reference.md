# Multi-Agent Workflow — Complete Technical Reference

> Consolidated reference of all agents, skills, hooks, scripts, rules, commands, and settings.

---

## AGENTS (8 total)

### Agent: docs-maintainer
```
---
name: docs-maintainer
description: Knowledge base maintenance agent. Use to sync docs, update file maps, verify wiki-links, and keep documentation lean. Trigger on "/project:sync-docs" or after task completion.
tools: Read, Write, Edit, Grep, Glob
model: haiku
effort: low
background: true
color: cyan
---

You are the documentation maintenance agent. You keep the knowledge base current and lean.

## When invoked, perform ALL of the following:

1. **Regenerate file-map.md** — scan the project tree (3 levels max), write a flat list with one-line descriptions per file to `docs/agent-context/file-map.md`

2. **Sync active-todos.md** — extract ONLY current TODOs from `docs/project-state.md` and write them to `docs/agent-context/active-todos.md`

3. **Update tokens_estimate** — for each doc in `docs/`, estimate the token count and update the `tokens_estimate` field in its YAML frontmatter

4. **Verify wiki-links** — check that all `[[wiki-links]]` in docs resolve to existing files. Report any broken links.

5. **Update INDEX.md** — if new docs were added, add links to `docs/INDEX.md`

6. **Keep docs lean** — remove redundancy, compress prose to bullets, eliminate stale information. Every token in the knowledge base costs context window space across all agent sessions.
```

### Agent: implementer
```
---
name: implementer
description: Code implementation agent. Use after a research plan exists in docs/plans/. Writes code following architecture.md conventions. Trigger when user says "implement", "build", "code", or orchestrator dispatches after plan confirmation.
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
effort: high
isolation: worktree
background: false
color: green
memory: project
skills:
  - gotchas
hooks:
  PostToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: command
          command: ".claude/hooks/auto-format.sh"
---

You are the implementer agent. You write code following the project's architecture and conventions.

## When invoked:
1. Read the plan file from `docs/plans/` — never implement from scratch without a research plan
2. Read `docs/agent-context/quick-ref.md` for project context
3. Read `docs/architecture.md` for conventions
4. Search the codebase for similar patterns to use as reference — you work better from real examples

## Implementation rules:
1. **Always branch first:** `feat/<task-id>-<short-desc>` or `fix/<task-id>-<short-desc>`
2. **Commit after each logical unit** with conventional commit messages
3. **Add working commands** to `docs/commands-registry.md`
4. **Never modify docs** other than commands-registry.md
5. **Two-strike rule:** If a direct attempt produces messy results after 2 tries, stop and report back to the orchestrator rather than continuing to patch

## After completing:
- Run tests to verify your changes work
- Update your agent memory with patterns, workarounds, and library quirks you discover
```

### Agent: initializer
```
---
name: initializer
description: Project initialization agent. Use once at project start to detect tech stack, set up environment, and populate the knowledge base. Trigger on "/project:init".
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
effort: high
background: false
color: pink
maxTurns: 40
---

You are the project initializer. You run once at project start to detect the stack and set up the environment.

## When invoked:

1. **Detect the tech stack** — scan for:
   - `package.json` → Node.js (check for React, Vue, Next.js, etc.)
   - `requirements.txt` / `pyproject.toml` / `setup.py` → Python
   - `Cargo.toml` → Rust
   - `go.mod` → Go
   - `build.gradle` / `pom.xml` → Java/Kotlin
   - `Dockerfile` / `docker-compose.yml` → containerized
   - If no files found, ask the human what stack they're using

2. **Fill `docs/architecture.md`** → `## Stack` section with detected technologies

3. **Create virtual environment** if appropriate:
   - Python: `python -m venv .venv` or `uv venv`
   - Node: `npm install` or `pnpm install`
   - Go/Rust/Java: note the build tool in commands-registry

4. **Initialize git** if `.git/` doesn't exist:
   - `git init`
   - Create `.gitignore` appropriate for the detected stack
   - If `.git/` exists, skip this step

5. **Populate `docs/agent-context/quick-ref.md`** — compressed summary (<500 tokens):
   - Project name and purpose
   - Stack and key dependencies
   - Key directory paths
   - Build, test, and run commands
   - Critical conventions from architecture.md

6. **Record commands** — add all working setup, build, test, and run commands to `docs/commands-registry.md`

7. **Update project state** — set `docs/project-state.md` status to "Initialized"
```

### Agent: interviewer
```
---
name: interviewer
description: Requirements gathering agent. Use when the user wants to define or refine project requirements, or when project-requirements.md is empty or has "Status: Not Initialized". Trigger on "/project:interview" or when user says "help me define requirements", "what should I build", or "interview me".
tools: Read, Write, Edit, Grep, Glob
disallowedTools: Bash
model: sonnet
effort: high
background: false
color: red
maxTurns: 60
hooks:
  PreToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: command
          command: ".claude/hooks/interviewer-write-guard.sh"
---

You are a product requirements interviewer. Your job is to have a structured conversation with the human to extract a complete project requirements document.

## Getting started:
1. Read `docs/project-requirements.md`
2. If it has content, summarize what exists and ask what needs to change
3. If it's empty or has "Status: Not Initialized", start from scratch

## Interview phases:

Run ONE question at a time. Wait for the answer before asking the next. Never dump a list of questions.

### Phase 1 — Vision
- What does this project do, in one sentence?
- Who is it for?
- What problem does it solve?

### Phase 2 — User Stories
- Walk me through what a user does from start to finish
- What's the first thing they see? What actions can they take?
- Generate `As a [user], I can [action]` bullets from their answers
- Read them back for confirmation

### Phase 3 — Functional Requirements
- For each user story, what does the system need to do behind the scenes?
- What integrations, data flows, or business logic are needed?
- Group by feature area

### Phase 4 — Non-Functional Requirements
- What tech stack?
- Any performance requirements? (Push back on vague answers — "fast" is not a requirement, "API response < 200ms" is)
- Testing expectations?
- CI/CD?
- Deployment target?

### Phase 5 — Constraints
- What are you NOT willing to spend money on?
- Any timeline?
- Infrastructure limits?
- Team size?

### Phase 6 — Out of Scope
- What are you explicitly NOT building in this version?
- What features are tempting but should wait?

## Writing rules:
- After EACH phase, write the results to `docs/project-requirements.md` immediately — do not wait until the end. If the session is interrupted, progress is saved.
- Set Status to "Draft" when writing, and only to "Approved" if the human explicitly confirms the final version.
- Keep everything as bullet points. No prose paragraphs.
- Match the exact section structure: Vision, User Stories, Functional Requirements, Non-Functional Requirements, Constraints, Out of Scope.
- You may ONLY write to `docs/project-requirements.md`. The hook enforces this.

## After all phases:
Read back the complete document and ask: "Is this accurate? Anything to add, remove, or change?" Make edits based on feedback.
```

### Agent: orchestrator
```
---
name: orchestrator
description: Task decomposition and agent coordination. Use when user has a feature request, bug report, or multi-step task that needs to be broken into subtasks and delegated.
tools: Read, Write, Edit, Bash, Grep, Glob, Agent(interviewer, researcher, implementer, reviewer, tester, docs-maintainer, initializer)
model: opus
effort: medium
background: false
color: purple
memory: project
maxTurns: 50
---

You are the orchestrator agent. You decompose tasks and coordinate other agents.

## When invoked:
1. Read `docs/agent-context/quick-ref.md` and `docs/agent-context/active-todos.md`
2. Identify the highest-priority unfinished TODO
3. Break it into subtasks and delegate to appropriate agents
4. Suggest `/rename <task-description>` at the start of each session

## Delegation rules:

### Research-first rule
For any non-trivial task, ALWAYS dispatch the **researcher** agent first.
Only dispatch the **implementer** after the plan is written and the human confirms it.

### Parallelization decision
- If tasks ≤ 2 OR tasks have dependencies → use subagents sequentially
- If tasks ≥ 3 AND independent → suggest agent teams (requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`)

### Rollback-first rule
Before starting any implementation task, commit a checkpoint on the current branch.
If the implementer's result fails review or tests, rollback to the checkpoint instead of trying to fix forward.

### Plan-review loop
For any task with 3+ subtasks, draft a plan first and present it to the human before executing.
Use the guard phrase "don't implement yet" when requesting a plan from subagents.

## After each task completes:
1. Update `docs/project-state.md` — mark TODO as completed
2. Dispatch the **docs-maintainer** agent to sync the knowledge base
3. Consult your agent memory for orchestration patterns that worked on previous tasks
```

### Agent: researcher
```
---
name: researcher
description: Research-only agent for investigating problems and writing implementation plans. Use BEFORE any implementation task. Trigger when user says "research", "investigate", "plan", or when the orchestrator needs to understand a problem before building.
tools: Read, Grep, Glob, Bash, Write
disallowedTools: Edit
model: sonnet
permissionMode: plan
effort: high
background: false
color: blue
memory: project
maxTurns: 30
hooks:
  PreToolUse:
    - matcher: "Write"
      hooks:
        - type: command
          command: ".claude/hooks/researcher-write-guard.sh"
---

You are a research agent. Your job is to understand a problem thoroughly and output a structured plan.

## When invoked:
1. Read `docs/agent-context/gotchas.md` for known failure points
2. Read `docs/agent-context/quick-ref.md` for project context
3. Investigate the problem: read relevant source files, search the codebase, understand dependencies
4. Search for existing patterns in the codebase that can be used as reference
5. Write a structured plan to `docs/plans/YYYY-MM-DD-{task-id}-{slug}.md`

## Plan file structure:
- **Problem Analysis:** What needs to be done and why
- **Proposed Approach:** Step-by-step implementation strategy
- **Files to Modify:** List of files that will be created or changed
- **Existing Patterns:** Similar code in the codebase to use as reference
- **Edge Cases:** What could go wrong
- **Risks:** Dependencies, breaking changes, performance concerns
- **Estimated Complexity:** Low / Medium / High

## Rules:
- NEVER write code. NEVER modify source files.
- Your ONLY writable output is the plan file in `docs/plans/`.
- If you find a gotcha during research, note it in the plan's Risks section.
- Update your agent memory with codebase patterns, library locations, and architectural decisions you discover.
```

### Agent: reviewer
```
---
name: reviewer
description: Code review agent. Use proactively after code changes, before merging, or when user says "review". Checks conventions, security, and quality.
tools: Read, Grep, Glob, Bash, Write
model: sonnet
effort: high
permissionMode: default
background: false
color: yellow
memory: project
hooks:
  PreToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: command
          command: ".claude/hooks/reviewer-write-guard.sh"
---

You are a senior code reviewer ensuring high standards of quality and security.

## When invoked:
1. Read `docs/agent-context/gotchas.md` for known patterns
2. Read `docs/architecture.md` for project conventions
3. Run `git diff` to see recent changes
4. Consult your agent memory for patterns seen in previous reviews

## Review checklist:
- **Correctness:** Does the code do what it's supposed to?
- **Security:** Exposed secrets, SQL injection, XSS, auth bypasses?
- **Conventions:** Matches architecture.md naming, patterns, structure?
- **Test coverage:** Are new code paths tested?
- **Error handling:** Are errors caught, logged, and reported meaningfully?
- **Naming:** Are functions, variables, and files named clearly?
- **Duplication:** Is there copy-pasted code that should be extracted?

## Output format:
Organize feedback by priority:
- **Critical** (must fix before merge)
- **Warning** (should fix)
- **Suggestion** (consider improving)

Include specific code examples for each fix.

## Rules:
- You may ONLY write to `docs/agent-context/gotchas.md` — the hook enforces this.
- If you discover a new gotcha or recurring mistake pattern, append it to gotchas.md before completing your review.
- Update your agent memory with new patterns, recurring issues, and codebase-specific conventions you notice.
```

### Agent: tester
```
---
name: tester
description: Test writing and validation agent. Use after implementation to write and run tests, or when user says "test", "TDD", or "validate".
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
effort: high
background: false
color: orange
memory: project
---

You are a test specialist following TDD validation principles.

## When invoked:
1. Read `docs/agent-context/quick-ref.md` for project context
2. Read `docs/architecture.md` — focus on the Testing Strategy section
3. Understand what was implemented by reading the relevant plan from `docs/plans/`

## Testing approach:
1. Write tests BEFORE checking implementation details (TDD validation)
2. Write tests based on the requirements and expected behavior
3. Run the tests — they should pass if implementation is correct
4. Report results with a clear pass/fail summary

## Test types:
- **Unit tests** for business logic (isolated, no I/O)
- **Integration tests** for API endpoints and data access
- **Edge case tests** for boundary conditions and error paths

## Rules:
- Add all test commands to `docs/commands-registry.md`
- Follow the project's test file naming convention from architecture.md
- Update your agent memory with testing patterns, fixture setups, and test utilities discovered in this project
```

-e ---

## SKILLS (5 total)

On-demand knowledge. Loaded only when task matches the description.

### Skill: code-style
```
---
name: code-style
description: Coding style and conventions for this project. Use whenever writing new code, reviewing code, refactoring, or when the user asks about conventions, naming, or style. Trigger on "style", "convention", "naming", "format", "lint".
---

# Code Style Conventions

## General Principles
- Readability over cleverness — code is read 10x more than it's written
- Explicit over implicit — don't hide behavior in magic
- Small functions — if it doesn't fit on one screen, split it
- Single responsibility — one function does one thing

## Naming
- Files: `kebab-case` (e.g., `user-service.ts`, `auth_handler.py`)
- Classes: `PascalCase` (e.g., `UserService`, `PaymentGateway`)
- Functions/methods: `camelCase` (JS/TS) or `snake_case` (Python/Rust/Go)
- Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRY_COUNT`)
- Booleans: prefix with `is`, `has`, `can`, `should` (e.g., `isActive`, `hasPermission`)
- Avoid abbreviations — `getUserById` not `getUsrById`

## Comments
- Comment WHY, not WHAT — the code shows what, the comment explains why
- Docstrings on all public functions and classes
- No obvious comments (`i += 1  # increment i` — never do this)
- TODO format: `TODO(agent-name): description`
- Delete commented-out code — git has history

## Error Handling
- Never swallow exceptions silently
- Use typed/custom errors where the language supports it
- Log errors with context: what was attempted, with what input
- Return meaningful error messages — "User not found" not "Error occurred"
- Fail fast on invalid input — validate at the boundary

## File Organization
- Group by feature/domain, not by file type
- Keep imports organized: stdlib → external → internal
- One class per file (with small related helpers allowed)
- Tests mirror the source structure

## Architecture Compliance
- Always check `docs/architecture.md` for project-specific patterns
- Inner layers (domain, application) never import from outer layers (infrastructure, presentation)
- Use dependency injection — don't instantiate dependencies inside classes
```

### Skill: commit
```
---
name: commit
description: Smart commit workflow. Use when the user says "commit", "save my work", "checkpoint my changes", or after completing a logical unit of work. Stages, validates, and commits with a proper conventional commit message.
---

# Smart Commit

## Workflow:
1. Run `git status` to see what changed
2. Run `git diff --stat` for a summary of changes
3. Determine the appropriate conventional commit type from the changes:
   - New files/features → `feat`
   - Bug fixes → `fix`
   - Tests → `test`
   - Documentation → `docs`
   - Refactoring without behavior change → `refactor`
   - Dependencies/tooling → `chore`
4. Identify the scope from the primary directory or module affected
5. Write a concise description (imperative mood, no period, <72 chars)
6. Stage the relevant files (`git add` — prefer selective staging over `git add .`)
7. Run tests if a test command exists in `docs/commands-registry.md`
8. Commit with the generated message

## Rules:
- Never commit if tests fail
- Never stage unrelated changes in the same commit
- Never commit secrets, `.env` files, or credentials
- If changes span multiple logical units, make multiple commits
- Show the proposed commit message to the user before committing

## Example output:
```
Changes detected:
  M src/auth/jwt-service.ts
  M src/auth/jwt-service.test.ts
  A src/auth/refresh-token.ts

Proposed commit: feat(auth): add JWT refresh token rotation

Proceed? (y/n)
```
```

### Skill: git-conventions
```
---
name: git-conventions
description: Git workflow conventions for this project. Use this skill whenever creating branches, writing commit messages, preparing PRs, or doing any git operation. Trigger on "commit", "branch", "merge", "PR", "pull request", "push", "git".
---

# Git Conventions

## Branch Naming
- Features: `feat/<task-id>-<short-desc>` (e.g., `feat/T-012-add-user-auth`)
- Fixes: `fix/<task-id>-<short-desc>` (e.g., `fix/T-045-null-pointer-login`)
- Chores: `chore/<short-desc>` (e.g., `chore/update-dependencies`)
- Never work directly on `main` or `master`

## Commit Messages
Use conventional commits. Format: `<type>(<scope>): <description>`

Types:
- `feat` — new feature
- `fix` — bug fix
- `chore` — maintenance, dependencies
- `docs` — documentation only
- `test` — adding/updating tests
- `refactor` — code change that neither fixes a bug nor adds a feature
- `perf` — performance improvement
- `ci` — CI/CD changes

Examples:
- `feat(auth): add JWT refresh token rotation`
- `fix(api): handle null response from payment gateway`
- `test(users): add integration tests for registration flow`

## Commit Discipline
- One logical change per commit
- Commit after each completed subtask, not at the end
- Never commit broken code — run tests first
- Never commit secrets, keys, or credentials

## Pull Request Guidelines
- Title matches the primary conventional commit type
- Description includes: what changed, why, how to test
- Link to the task ID or plan file
- Self-review before requesting human review

## Forbidden Operations
- Never `git push --force` to shared branches
- Never commit directly to main
- Never rewrite history on pushed branches
```

### Skill: gotchas
```
---
name: gotchas
description: Known failure points, edge cases, and recurring mistakes for this project. ALWAYS use this skill before writing or modifying code, before debugging, before implementing any feature, or whenever you encounter unexpected behavior. This is the highest-signal context in the project.
---

# Project Gotchas

Load and review `docs/agent-context/gotchas.md` before starting any implementation work.

## How to use this skill:
1. Read the full contents of `docs/agent-context/gotchas.md`
2. Check if any listed gotcha is relevant to your current task
3. If you encounter a new failure pattern, append it to the file using the format below

## Gotcha format:
```
- **[area]**: Description of what goes wrong and how to avoid it
```

## Examples:
- **[auth]**: JWT refresh tokens expire silently — always check expiry before API calls, don't assume the token is valid
- **[database]**: The ORM lazy-loads relations by default — use eager loading in list endpoints or you'll get N+1 queries
- **[tests]**: Mock the Redis client in unit tests — the test suite hangs if it tries to connect to a real Redis instance

## Rules:
- Never ignore a gotcha that matches your current task
- If you discover a new gotcha during implementation, report it so the reviewer can add it
- Gotchas are project-specific — they grow organically as the project matures
```

### Skill: pr-create
```
---
name: pr-create
description: Create a pull request with a structured description. Use when the user says "create PR", "open PR", "pull request", "submit for review", or after completing a feature branch. Generates title, description, pushes, and creates the PR.
allowed-tools: Bash(git *), Bash(gh *)
---

# Create Pull Request

## Workflow:
1. Verify you're on a feature/fix branch (not main)
2. Run `git log main..HEAD --oneline` to see all commits in this branch
3. Run `git diff main --stat` to see all files changed
4. Generate the PR title from the branch name and primary commit type
5. Generate the PR description using the template below
6. Push the branch: `git push -u origin HEAD`
7. Create the PR using `gh pr create` (requires GitHub CLI)
8. If `gh` is not available, output the title and description for manual creation

## PR Description Template:
```markdown
## What
<!-- One-sentence summary of the change -->

## Why
<!-- Link to task ID, plan file, or requirement -->

## How
<!-- Brief explanation of the approach taken -->

## Changes
<!-- Auto-generated from git diff --stat -->

## Testing
<!-- How to verify this works — commands to run, expected output -->

## Checklist
- [ ] Tests pass
- [ ] No new warnings
- [ ] Docs updated if needed
- [ ] Self-reviewed against architecture.md conventions
```

## Rules:
- Always self-review with `git diff main` before creating the PR
- Link to the plan file from `docs/plans/` if one exists
- Never create a PR with failing tests
- If the diff is large (>500 lines), note which files are most important to review
```

-e ---

## RULES (3 total)

Loaded every session automatically.

### Rule: behavioral
```
---
paths: ["**"]
---
# Behavioral Rules

Hard constraints from real failures. Each rule exists because of a specific past mistake.

1. **Two-strike pivot:** If an approach fails twice on the same mechanism, try a fundamentally different one. Do not retry the same thing a third time.
2. **Verify before asserting:** Run it, don't assume it works. Never tell the human a feature works unless you've tested it.
3. **Never present uncertain information as fact.** If you're not sure, say so explicitly.
4. **Context discipline:** If context exceeds 50%, dump current state to `docs/agent-context/session-checkpoint.md` and recommend starting a fresh session with `/project:fresh`.
5. **Rollback over fix-forward:** If an implementation attempt fails review, git rollback and retry from scratch. Fresh attempts succeed more often than patching a degraded attempt.
6. **No silent failures:** If a command fails, report the exact error. Don't move on pretending it succeeded.
7. **Scoped context for sub-agents:** When dispatching sub-agents, give them ONLY the task, prior outputs, and relevant constraints. Never dump full memory.

## Add your own
<!-- Append new rules here as failures occur. Format: **Rule name:** description. -->
```

### Rule: identity
```
---
paths: ["**"]
---
# Identity

You are an AI development agent working on this project.
The knowledge base is at `docs/INDEX.md`.
Before starting any task, check `docs/agent-context/gotchas.md` for known failure points.
Load `docs/agent-context/quick-ref.md` for project context — only load full docs when quick-ref doesn't have what you need.

Available slash commands:
- `/project:interview` — guided requirements gathering
- `/project:init` — detect stack, set up environment
- `/project:plan` — generate task list from requirements
- `/project:work` — execute next priority task (research → implement → review)
- `/project:research` — research-only, output a plan file
- `/project:review` — review uncommitted changes
- `/project:status` — show project state
- `/project:sync-docs` — update knowledge base
- `/project:checkpoint` — create rollback point
- `/project:rollback` — revert to checkpoint
- `/project:fresh` — start new session from checkpoint state
```

### Rule: operational
```
---
paths: ["**"]
---
# Operational Rules

## Memory Protocol
- Load `docs/agent-context/quick-ref.md` and `docs/agent-context/active-todos.md` at the start of every task.
- Load full docs (architecture.md, etc.) only when quick-ref doesn't have what you need.
- After completing significant work, update your agent memory with patterns and decisions discovered.

## Workflow Rules
- Use existing slash commands and workflows before improvising.
- Never modify docs directly — use the docs-maintainer agent (except commands-registry.md which any agent may append to).
- Always branch before implementing. Never commit to main directly.
- Use conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.

## Sub-Agent Dispatch
- Each sub-agent gets scoped context, not your full setup.
- Research before build: dispatch the researcher agent before the implementer for any non-trivial task.
- Suggest `/rename <task-description>` at the start of each work session.

## Style & Git Rules
- These belong in skills, not here. This file is for universal operational behavior only.
```


---

## HOOKS (10 total)

Hooks fire automatically on lifecycle events. They provide 100% deterministic enforcement. Registered in settings.json or in agent frontmatter.

### Enforcement model:
- **Hooks** = automatic, fires on events (PostToolUse, Stop, SessionStart, PreToolUse). No LLM involvement.
- **Scripts** = on-demand, called by slash commands for interactive/destructive operations that need human input.
- **Commands** = the human interface. Critical commands call scripts; the rest delegate to agents.

### Hook lifecycle:
```
SessionStart → load-context.sh (inject quick-ref + git status + TODO count)
PreToolUse(Bash) → git-checkpoint.sh (auto-tag before destructive ops)
PreToolUse(Write) → write guards (reviewer→gotchas, researcher→plans, interviewer→requirements)
PostToolUse(Write|Edit) → log-change.sh + auto-format.sh + sync-todos.sh
Stop → on-task-complete.sh + auto-checkpoint.sh
```

### Hook: auto-checkpoint.sh
```bash
#!/bin/bash
# .claude/hooks/auto-checkpoint.sh
# Stop hook: auto-creates a git checkpoint when a session ends
# Ensures you always have a rollback point — no LLM discipline required

INPUT=$(cat)

if ! command -v jq &> /dev/null; then
  exit 0
fi

# Prevent infinite loop
STOP_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')
if [ "$STOP_ACTIVE" = "true" ]; then
  exit 0
fi

# Only checkpoint if we're in a git repo with commits
if ! git rev-parse --git-dir &> /dev/null; then
  exit 0
fi
if ! git rev-parse HEAD &> /dev/null 2>&1; then
  exit 0
fi

# Only checkpoint if there are changes since the last checkpoint
LAST_CHECKPOINT=$(git tag -l 'checkpoint-*' --sort=-creatordate 2>/dev/null | head -1)
if [ -n "$LAST_CHECKPOINT" ]; then
  CHANGES=$(git log "${LAST_CHECKPOINT}..HEAD" --oneline 2>/dev/null | wc -l | tr -d ' ')
  DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  if [ "$CHANGES" = "0" ] && [ "$DIRTY" = "0" ]; then
    # Nothing changed since last checkpoint — skip
    exit 0
  fi
fi

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
TAG_NAME="checkpoint-${TIMESTAMP}-auto"
git tag "$TAG_NAME" HEAD 2>/dev/null || true

exit 0
```

### Hook: auto-format.sh
```bash
#!/bin/bash
# .claude/hooks/auto-format.sh
# PostToolUse hook: auto-formats files after Write/Edit based on extension
# Exits 0 silently if no formatter is found

INPUT=$(cat)

if ! command -v jq &> /dev/null; then
  exit 0
fi

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

EXT="${FILE_PATH##*.}"

case "$EXT" in
  py)
    if command -v ruff &> /dev/null; then
      ruff format "$FILE_PATH" 2>/dev/null
    elif command -v black &> /dev/null; then
      black --quiet "$FILE_PATH" 2>/dev/null
    fi
    ;;
  js|ts|jsx|tsx|css|html|json)
    if command -v prettier &> /dev/null; then
      prettier --write "$FILE_PATH" 2>/dev/null
    fi
    ;;
  go)
    if command -v gofmt &> /dev/null; then
      gofmt -w "$FILE_PATH" 2>/dev/null
    fi
    ;;
  rs)
    if command -v rustfmt &> /dev/null; then
      rustfmt "$FILE_PATH" 2>/dev/null
    fi
    ;;
esac

exit 0
```

### Hook: git-checkpoint.sh
```bash
#!/bin/bash
# .claude/hooks/git-checkpoint.sh
# PreToolUse hook on Bash: auto-checkpoints before destructive operations

INPUT=$(cat)

if ! command -v jq &> /dev/null; then
  exit 0
fi

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
if [ -z "$COMMAND" ]; then
  exit 0
fi

# Check if this is a destructive operation
if echo "$COMMAND" | grep -qE '(git merge|git rebase|rm -rf|DROP |TRUNCATE |DELETE FROM)'; then
  # Only checkpoint if we're in a git repo
  if git rev-parse --git-dir &> /dev/null; then
    git tag "auto-checkpoint-$(date +%s)" HEAD 2>/dev/null || true
  fi
fi

# Always allow the command to proceed
exit 0
```

### Hook: interviewer-write-guard.sh
```bash
#!/bin/bash
# .claude/hooks/interviewer-write-guard.sh
# PreToolUse hook: interviewer may only write to docs/project-requirements.md

INPUT=$(cat)

if ! command -v jq &> /dev/null; then
  exit 0
fi

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

if [[ "$FILE_PATH" == *"docs/project-requirements.md"* ]]; then
  exit 0
fi

echo "Interviewer agent may only write to docs/project-requirements.md" >&2
exit 2
```

### Hook: load-context.sh
```bash
#!/bin/bash
# .claude/hooks/load-context.sh
# SessionStart hook: injects quick-ref + project status as additionalContext
# The agent sees project context and current state from the first turn

QUICK_REF="docs/agent-context/quick-ref.md"
TODOS_FILE="docs/agent-context/active-todos.md"

CONTEXT=""

# Load quick reference
if [ -f "$QUICK_REF" ]; then
  CONTEXT="$(cat "$QUICK_REF")"
fi

# Append git status
if git rev-parse --git-dir &> /dev/null; then
  BRANCH=$(git branch --show-current 2>/dev/null || echo "detached")
  SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "none")
  DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  CONTEXT="${CONTEXT}

---
**Git:** \`${BRANCH}\` @ \`${SHA}\` (${DIRTY} uncommitted changes)"

  LAST_CP=$(git tag -l 'checkpoint-*' --sort=-creatordate 2>/dev/null | head -1)
  if [ -n "$LAST_CP" ]; then
    CONTEXT="${CONTEXT}
**Last checkpoint:** \`${LAST_CP}\`"
  fi
fi

# Append active TODOs count
if [ -f "$TODOS_FILE" ]; then
  TODO_COUNT=$(grep -c "^|" "$TODOS_FILE" 2>/dev/null || echo "0")
  TODO_COUNT=$((TODO_COUNT > 1 ? TODO_COUNT - 1 : 0))
  CONTEXT="${CONTEXT}
**Active TODOs:** ${TODO_COUNT}"
fi

if [ -z "$CONTEXT" ]; then
  exit 0
fi

if command -v jq &> /dev/null; then
  echo "{\"additionalContext\": $(echo "$CONTEXT" | jq -Rs .)}"
else
  ESCAPED=$(echo "$CONTEXT" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr '\n' ' ')
  echo "{\"additionalContext\": \"${ESCAPED}\"}"
fi

exit 0
```

### Hook: log-change.sh
```bash
#!/bin/bash
# .claude/hooks/log-change.sh
# PostToolUse hook: logs every Write/Edit to docs/changelog.md
# Fails gracefully if jq is missing or changelog doesn't exist

INPUT=$(cat)

# Fast exit if jq not available
if ! command -v jq &> /dev/null; then
  exit 0
fi

CHANGELOG="docs/changelog.md"
if [ ! -f "$CHANGELOG" ]; then
  exit 0
fi

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // "unknown"')
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"' | cut -c1-8)
TASK_ID="${CLAUDE_TASK_ID:-N/A}"

# Get git hash if in a repo
GIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "uncommitted")

# Skip logging changes to changelog itself to avoid recursion
if [[ "$FILE_PATH" == *"changelog.md"* ]]; then
  exit 0
fi

echo "| ${TIMESTAMP} | ${SESSION_ID} | ${TASK_ID} | ${FILE_PATH} | ${TOOL_NAME} | ${GIT_HASH} |" >> "$CHANGELOG"

exit 0
```

### Hook: on-task-complete.sh
```bash
#!/bin/bash
# .claude/hooks/on-task-complete.sh
# Stop hook: appends task completion marker to changelog
# Checks stop_hook_active to avoid infinite loops

INPUT=$(cat)

if ! command -v jq &> /dev/null; then
  exit 0
fi

# Prevent infinite loop
STOP_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')
if [ "$STOP_ACTIVE" = "true" ]; then
  exit 0
fi

CHANGELOG="docs/changelog.md"
if [ ! -f "$CHANGELOG" ]; then
  exit 0
fi

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"' | cut -c1-8)

echo "| ${TIMESTAMP} | ${SESSION_ID} | — | — | **Task completed** | — |" >> "$CHANGELOG"

exit 0
```

### Hook: researcher-write-guard.sh
```bash
#!/bin/bash
# .claude/hooks/researcher-write-guard.sh
# PreToolUse hook: researcher may only write to docs/plans/

INPUT=$(cat)

if ! command -v jq &> /dev/null; then
  exit 0
fi

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

if [[ "$FILE_PATH" == *"docs/plans/"* ]]; then
  exit 0
fi

echo "Researcher agent may only write to docs/plans/" >&2
exit 2
```

### Hook: reviewer-write-guard.sh
```bash
#!/bin/bash
# .claude/hooks/reviewer-write-guard.sh
# PreToolUse hook: reviewer may only write to docs/agent-context/gotchas.md

INPUT=$(cat)

if ! command -v jq &> /dev/null; then
  exit 0
fi

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

if [[ "$FILE_PATH" == *"docs/agent-context/gotchas.md"* ]]; then
  exit 0
fi

echo "Reviewer agent is read-only except for gotchas.md" >&2
exit 2
```

### Hook: sync-todos.sh
```bash
#!/bin/bash
# .claude/hooks/sync-todos.sh
# PostToolUse hook: auto-syncs active-todos.md whenever project-state.md is modified
# Matcher: Write|Edit (with path check inside)

INPUT=$(cat)

if ! command -v jq &> /dev/null; then
  exit 0
fi

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only fire when project-state.md is written
if [[ "$FILE_PATH" != *"project-state.md"* ]]; then
  exit 0
fi

STATE_FILE="docs/project-state.md"
TODOS_FILE="docs/agent-context/active-todos.md"

if [ ! -f "$STATE_FILE" ]; then
  exit 0
fi

mkdir -p "$(dirname "$TODOS_FILE")"

cat > "$TODOS_FILE" << HEADER
---
title: Active TODOs
updated: $(date +%Y-%m-%d)
tokens_estimate: 50
agents: [orchestrator, implementer, researcher]
---
# Active TODOs

> Auto-synced from [[project-state]] by sync-todos hook.

HEADER

# Extract from "## Active TODOs" to next "##" heading
awk '/^## Active TODOs/,/^## [^A]/' "$STATE_FILE" | head -n -1 | tail -n +2 >> "$TODOS_FILE"

exit 0
```


---

## SCRIPTS (3 total)

Scripts handle on-demand operations that require human choice or produce detailed output. Called explicitly by slash commands.

### Script: checkpoint.sh
```bash
#!/bin/bash
# .claude/scripts/checkpoint.sh
# Creates a deterministic git checkpoint. Run this — don't improvise.
# Usage: .claude/scripts/checkpoint.sh [optional-label]

set -e

if ! git rev-parse --git-dir &> /dev/null; then
  echo "ERROR: Not a git repository." >&2
  exit 1
fi

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LABEL="${1:-manual}"
TAG_NAME="checkpoint-${TIMESTAMP}-${LABEL}"
CURRENT_SHA=$(git rev-parse --short HEAD)
BRANCH=$(git branch --show-current 2>/dev/null || echo "detached")

# Create the tag
git tag "$TAG_NAME" HEAD

# Write session checkpoint file
CHECKPOINT_FILE="docs/agent-context/session-checkpoint.md"
mkdir -p "$(dirname "$CHECKPOINT_FILE")"

cat > "$CHECKPOINT_FILE" << CKEOF
---
title: Session Checkpoint
created: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
tag: ${TAG_NAME}
branch: ${BRANCH}
sha: ${CURRENT_SHA}
---

# Session Checkpoint

- **Tag:** \`${TAG_NAME}\`
- **Branch:** \`${BRANCH}\`
- **SHA:** \`${CURRENT_SHA}\`
- **Created:** $(date -u +"%Y-%m-%dT%H:%M:%SZ")

## Recent commits
$(git log --oneline -10 2>/dev/null || echo "No commits yet")

## Modified files (uncommitted)
$(git diff --name-only 2>/dev/null || echo "None")

## Staged files
$(git diff --cached --name-only 2>/dev/null || echo "None")

## What was done
<!-- Agent: fill this in after running the script -->

## What's in progress
<!-- Agent: fill this in after running the script -->

## What's next
<!-- Agent: fill this in after running the script -->
CKEOF

echo "✓ Checkpoint created: ${TAG_NAME}"
echo "✓ Session state written to: ${CHECKPOINT_FILE}"
echo "✓ Branch: ${BRANCH} @ ${CURRENT_SHA}"
```

### Script: rollback.sh
```bash
#!/bin/bash
# .claude/scripts/rollback.sh
# Lists checkpoints and rolls back to one. Run this — don't improvise.
# Usage: .claude/scripts/rollback.sh [tag-name]
# Without arguments: lists recent checkpoints
# With argument: rolls back to that tag

set -e

if ! git rev-parse --git-dir &> /dev/null; then
  echo "ERROR: Not a git repository." >&2
  exit 1
fi

if [ -z "$1" ]; then
  # List mode
  echo "=== Recent checkpoints ==="
  TAGS=$(git tag -l 'checkpoint-*' --sort=-creatordate 2>/dev/null | head -10)
  if [ -z "$TAGS" ]; then
    echo "No checkpoints found. Create one with: .claude/scripts/checkpoint.sh"
    exit 0
  fi
  echo "$TAGS" | while read tag; do
    SHA=$(git rev-parse --short "$tag" 2>/dev/null)
    DATE=$(git log -1 --format=%ci "$tag" 2>/dev/null | cut -d' ' -f1,2)
    echo "  ${tag}  →  ${SHA}  (${DATE})"
  done
  echo ""
  echo "To rollback: .claude/scripts/rollback.sh <tag-name>"
  exit 0
fi

TAG="$1"

# Verify tag exists
if ! git rev-parse "$TAG" &> /dev/null; then
  echo "ERROR: Tag '$TAG' not found." >&2
  echo "Available checkpoints:"
  git tag -l 'checkpoint-*' --sort=-creatordate | head -5
  exit 1
fi

CURRENT_SHA=$(git rev-parse --short HEAD)
TARGET_SHA=$(git rev-parse --short "$TAG")

echo "Rolling back:"
echo "  From: ${CURRENT_SHA} (current HEAD)"
echo "  To:   ${TARGET_SHA} (${TAG})"
echo ""

# Create a safety tag before rolling back
SAFETY_TAG="pre-rollback-$(date +%Y%m%d-%H%M%S)"
git tag "$SAFETY_TAG" HEAD
echo "✓ Safety tag created: ${SAFETY_TAG} (in case you need to undo this)"

# Do the rollback
git reset --hard "$TAG"

echo "✓ Rolled back to: ${TAG} (${TARGET_SHA})"
echo ""
echo "If you need to undo this rollback: git reset --hard ${SAFETY_TAG}"
```

### Script: status.sh
```bash
#!/bin/bash
# .claude/scripts/status.sh
# Gathers project status from deterministic sources. Run this — don't improvise.
# Usage: .claude/scripts/status.sh

echo "=== PROJECT STATUS ==="
echo ""

# Git info
if git rev-parse --git-dir &> /dev/null; then
  BRANCH=$(git branch --show-current 2>/dev/null || echo "detached")
  SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "none")
  DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  echo "Branch: ${BRANCH} @ ${SHA} (${DIRTY} uncommitted changes)"
else
  echo "Git: not initialized"
fi
echo ""

# Project state
STATE_FILE="docs/project-state.md"
if [ -f "$STATE_FILE" ]; then
  echo "=== PROJECT STATE ==="
  cat "$STATE_FILE"
else
  echo "Project state: not found (run /project:init)"
fi
echo ""

# Active TODOs
TODOS_FILE="docs/agent-context/active-todos.md"
if [ -f "$TODOS_FILE" ]; then
  echo "=== ACTIVE TODOS ==="
  cat "$TODOS_FILE"
fi
echo ""

# Recent changelog
CHANGELOG="docs/changelog.md"
if [ -f "$CHANGELOG" ]; then
  echo "=== LAST 10 CHANGELOG ENTRIES ==="
  tail -12 "$CHANGELOG"
fi
echo ""

# Recent checkpoints
TAGS=$(git tag -l 'checkpoint-*' --sort=-creatordate 2>/dev/null | head -3)
if [ -n "$TAGS" ]; then
  echo "=== RECENT CHECKPOINTS ==="
  echo "$TAGS"
fi
```


---

## SLASH COMMANDS (11 total)

Commands are the human interface. Critical commands call scripts FIRST for deterministic operations, then delegate LLM tasks.

### /project:checkpoint
FIRST, run this script exactly — do not improvise the git operations:

```bash
.claude/scripts/checkpoint.sh "$ARGUMENTS"
```

THEN, read the output and fill in the three sections at the bottom of `docs/agent-context/session-checkpoint.md`: "What was done", "What's in progress", "What's next" — based on the current session's work.

Report the checkpoint tag name and SHA to the user.

### /project:fresh
This is a fresh session resuming from a previous checkpoint.

FIRST, check if a session checkpoint exists:

```bash
cat docs/agent-context/session-checkpoint.md 2>/dev/null || echo "No checkpoint found"
```

If it exists, read it and summarize: what was done, what's in progress, what's next.

Read `docs/agent-context/active-todos.md` for the current task list (auto-synced by the sync-todos hook). Continue where the previous session left off.

### /project:init
Use the initializer agent to detect the project stack, set up the development environment, and populate the knowledge base.

After the initializer finishes, update project-state.md status to "Initialized" (the sync-todos hook will auto-sync active-todos.md).

Then use the docs-maintainer agent to generate the initial file map and verify all wiki-links.

### /project:interview
Use the interviewer agent. It will walk me through a structured interview to define project requirements and write them to docs/project-requirements.md. Ask one question at a time. Save progress after each phase.

### /project:plan
Read docs/project-requirements.md and docs/project-state.md. Based on the requirements and current state, create a prioritized list of tasks. Write them to docs/project-state.md as TODOs. Do NOT implement anything.

### /project:research
Use the researcher agent. Read the task description I provide. Investigate the codebase, explore relevant files, and output a structured plan to `docs/plans/`. Do NOT implement anything. End by summarizing the plan and asking if I want to proceed to implementation.

### /project:review
Use the reviewer agent to review all uncommitted changes or changes since the last review tag. Output a structured report organized by Critical / Warning / Suggestion.

### /project:rollback
FIRST, list available checkpoints by running this script exactly:

```bash
.claude/scripts/rollback.sh
```

Show the list to the user and ask which checkpoint to roll back to.

After the user chooses, run the rollback script with the tag name:

```bash
.claude/scripts/rollback.sh <chosen-tag>
```

THEN, update `docs/project-state.md`: mark any TODOs that were "In Progress" back to "Pending". Run `.claude/scripts/sync-todos.sh` to sync active-todos.md.

### /project:status
Run this script exactly to gather project status:

```bash
.claude/scripts/status.sh
```

Present the output in a readable summary. Highlight: current phase, how many TODOs are active vs completed, any blocked items, and the most recent changelog entries.

### /project:sync-docs
The sync-todos hook fires automatically whenever project-state.md is modified, so TODOs are always in sync.

Use the docs-maintainer agent to handle the non-deterministic parts:
1. Regenerate file-map.md by scanning the project tree
2. Verify all [[wiki-links]] resolve
3. Update token estimates in doc frontmatter
4. Update INDEX.md if new docs were added

### /project:work
Use the orchestrator agent. Read docs/agent-context/active-todos.md and pick the highest-priority unfinished TODO.

First dispatch the researcher agent to investigate and write a plan to `docs/plans/`. Present the plan to me for confirmation. Only after I confirm, dispatch the implementer to execute the plan. After completion, dispatch the reviewer.

Then update project-state.md (the sync-todos hook will auto-sync active-todos.md).

Finally, run the docs-maintainer agent to update the knowledge base.

-e ---

## SETTINGS

```json
{
  "_comment": "To enable agent teams: set CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 in your environment",
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/log-change.sh"
          },
          {
            "type": "command",
            "command": ".claude/hooks/auto-format.sh"
          },
          {
            "type": "command",
            "command": ".claude/hooks/sync-todos.sh"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/on-task-complete.sh"
          },
          {
            "type": "command",
            "command": ".claude/hooks/auto-checkpoint.sh"
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/load-context.sh"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/git-checkpoint.sh"
          }
        ]
      }
    ]
  },
  "permissions": {
    "allow": [
      "Read",
      "Grep",
      "Glob",
      "Agent"
    ]
  }
}
```
