# NotebookLM Setup — Multi-Agent Claude Code Workflow

## Part 1: Sources to Add

### Step 1 — Upload the template files directly

Upload these files from the zip as documents:

1. `_guides/multi-agent-workflow-prompt.md` — the master scaffold prompt
2. `CLAUDE.md` — agent-facing configuration
3. `HUMAN.md` — human-facing guide
4. `_guides/guide-new-project.md` — new project setup
5. `_guides/guide-existing-project.md` — existing project setup
6. `_guides/example-project-requirements.md` — example requirements

### Step 2 — Add Claude Code official documentation URLs

Add these as website sources in NotebookLM:

```
https://code.claude.com/docs/en/sub-agents.md
https://code.claude.com/docs/en/hooks
https://code.claude.com/docs/en/skills
https://code.claude.com/docs/en/model-config
https://code.claude.com/docs/en/common-workflows
https://code.claude.com/docs/en/agent-teams
https://code.claude.com/docs/en/cli-reference
https://code.claude.com/docs/en/interactive-mode
https://code.claude.com/docs/en/permissions
https://code.claude.com/docs/en/settings
https://code.claude.com/docs/en/memory
```

### Step 3 — Add community reference URLs

```
https://smart-webtech.com/blog/claude-code-workflows-and-best-practices/
https://www.pubnub.com/blog/best-practices-for-claude-code-sub-agents/
https://github.com/shanraisshan/claude-code-best-practice
```

### Step 4 — Upload the consolidated technical reference

Upload `_guides/notebooklm-technical-reference.md` from the zip. This single file contains all 8 agent definitions, 5 skills, 3 rules, 8 hooks (with full source code), 11 slash commands, and settings.json — consolidated into one paste-able document with section headers and explanatory context.

---

## Part 2: Podcast Generation Prompt

Paste this into NotebookLM's Audio Overview customization:

```
Create a podcast episode called "Building a Multi-Agent Development Workflow for Claude Code" between two hosts. One host is a senior developer who built this system, the other is a curious developer who has used Claude Code casually but wants to level up. The tone should be practical and conversational — like two engineers at a whiteboard, not a lecture.

Structure the episode in this order:

1. THE PROBLEM (3 min)
Start with why a single Claude Code session breaks down on real projects: context window fills up, no memory between sessions, inconsistent conventions, no audit trail, agents doing random things without guardrails. Reference the Reddit thread where a 6-year developer says "feels like I'm just scratching the surface and over-staffing my setup with bullshit without a real flow."

2. THE THREE-TIER CONTEXT SYSTEM (5 min)
This is the core insight. Explain the three layers and WHY each exists:
- CLAUDE.md: injected on EVERY turn, so it must be tiny (<50 lines). Only universal rules. If you put git conventions here, you waste context on every non-git turn.
- Rules (.claude/rules/): loaded every session automatically. Three files: identity (who the agent is), behavioral (hard constraints from real failures — "two-strike pivot", "verify before asserting"), operational (memory protocol, dispatch rules). Stress that behavioral rules are the most valuable — each one traces to a specific past failure. They compound over time.
- Skills (.claude/skills/): on-demand, loaded ONLY when relevant. Git conventions load at commit time, code style loads during review, gotchas preloaded into the implementer. This is how you keep context lean.

Walk through a concrete example: "When the implementer is writing a React component, it has CLAUDE.md (40 tokens of rules), the identity rule, behavioral rule, operational rule, plus the gotchas skill injected at startup, and the code-style skill auto-triggered by the task. But it does NOT have git-conventions loaded — those only fire when it's time to commit. That's maybe 3000 tokens of guidance instead of 8000."

3. THE KNOWLEDGE BASE (4 min)
Explain the Obsidian vault structure. Key insight: quick-ref.md is the hero. It's <500 tokens and is what agents load by default instead of the full 5000-token architecture doc. Only when quick-ref doesn't have what they need do they load the full doc. This saves massive context over a long session.

Explain gotchas.md as the "highest-signal document in the project" — it captures what specifically pushes Claude off track. The reviewer agent appends to it when it finds recurring mistakes. It grows organically into institutional knowledge.

Explain the changelog as append-only, auto-populated by a PostToolUse hook — no agent discipline required.

4. THE EIGHT AGENTS (8 min)
Walk through each agent, but focus on the WHY, not just the what:

- Interviewer: "Instead of staring at a blank requirements doc, you run /project:interview and it walks you through one question at a time. It pushes back on vague answers — 'fast' is not a requirement, 'API response under 200ms' is. It saves after each phase so if your session dies, progress is kept."

- Researcher: "This is the single biggest quality improvement according to production users. When Claude researches and builds in the same session, scope creep is inevitable. The researcher outputs a plan file to docs/plans/. The implementer reads that file. Separate sessions, markdown handoff."

- Orchestrator: "Runs on Opus because it needs complex reasoning for task decomposition. Enforces research-first: always dispatches the researcher before the implementer. Has a rollback-first rule: if implementation fails review, it rolls back instead of patching. It decides between subagents (sequential, for dependent tasks) and agent teams (parallel, for 3+ independent tasks)."

- Implementer: "Runs on Sonnet — good enough for code, way cheaper than Opus. Uses worktree isolation so parallel work doesn't create merge conflicts. Has the gotchas skill preloaded. Two-strike rule: if it fails twice, it stops and reports back instead of spiraling."

- Reviewer: "Read-only except for one file: gotchas.md. When it spots a recurring mistake, it appends a new gotcha. This is how the system gets smarter over time."

- Tester: "TDD validation approach — writes tests BEFORE checking implementation, based on requirements and expected behavior."

- Docs-maintainer: "Runs on Haiku — cheapest model, simple file operations. Runs in the background. Keeps the knowledge base lean and synced."

- Initializer: "Runs once. Scans your project, detects the stack, creates venv, fills in architecture.md and quick-ref.md."

Explain the model routing: Opus for orchestration, Sonnet for substantive work, Haiku for simple maintenance. Each agent has effort levels tuned: high for coding/reviewing, medium for orchestrating, low for docs sync.

5. THE HOOKS SYSTEM (4 min)
Explain hooks as "things that MUST happen 100% of the time" vs CLAUDE.md rules which are followed ~70%. Cover:
- Changelog logger: every Write/Edit auto-logged, no agent needs to remember
- Auto-format: detects file extension, runs the right formatter
- Git checkpoint: auto-tags HEAD before destructive operations
- Write guards: reviewer can only write to gotchas.md, researcher can only write to docs/plans/, interviewer can only write to project-requirements.md. These are "structural impossibilities, not polite requests."
- Stop hook: marks task completion in changelog
- Context loader: injects quick-ref.md on session start

6. THE SLASH COMMANDS (3 min)
Frame these as "the human interface — you don't need to know agent names." Walk through the daily flow:
- /project:interview → define what you're building
- /project:init → set up the environment
- /project:plan → break requirements into tasks
- /project:work → the full pipeline: research → confirm plan → implement → review
- /project:checkpoint and /project:fresh → session management when context degrades

7. COMMUNITY WISDOM (3 min)
The best insights from the Reddit thread:
- "Rules over skills for consistency" — if it's in a skill, consistency is opt-in
- "Slow is smooth, smooth is fast" — pair-programming style beats orchestration fleets
- "Context below 10%" — the 30-year veteran who never lets context fill up
- "Skills should encode decisions, not tasks" — decision skills compound, task skills get stale
- "Build verification UIs, not more skills" — automate checking, not coding

8. GETTING STARTED (2 min)
End with the practical steps: unzip the template, chmod the hooks, run claude, /project:interview, /project:init, /project:plan, /project:work. Mention the existing project guide for teams with established codebases.

Throughout the episode, use specific examples and numbers. Don't be abstract. When you say "saves context," say "saves 5000 tokens per turn." When you say "auto-logged," describe the actual table row format. Make it feel like the listener could go build this right now.
```

---

## Part 3: Infographic Generation Prompt

Use this prompt in Claude (with the template files uploaded) to generate an infographic:

```
Create a detailed, visually structured infographic for the Multi-Agent Claude Code Workflow. This will be a tall, single-column infographic designed for sharing on social media or printing as a reference poster. Use a dark theme with color-coded sections.

## Layout Structure (top to bottom):

### Header
Title: "Multi-Agent Development Workflow for Claude Code"
Subtitle: "8 agents · 5 skills · 8 hooks · 11 commands · 1 knowledge base"
Small text: "Reusable template — works for any project, any stack"

### Section 1: The Three-Tier Context System
Show three horizontal layers as a stack diagram:
- Top layer (smallest, bright red): "CLAUDE.md — <50 lines, injected EVERY turn"
- Middle layer (medium, orange): "Rules — 3 files, loaded every session automatically"
- Bottom layer (widest, blue): "Skills — 5 skills, loaded only when relevant"
Arrow pointing down labeled "Context cost decreases ↓"
Side note: "Golden rule: if it must happen 100% of the time → hook. If every session → rule. If sometimes → skill. If every turn → CLAUDE.md (keep it tiny)."

### Section 2: The Agent Pipeline
Show a horizontal flowchart with colored boxes matching agent colors:
Red box "Interviewer" → arrow "requirements" →
Pink box "Initializer" → arrow "environment" →
Purple box "Orchestrator" → branches into:
  ├─ Blue box "Researcher" → arrow "plan file" →
  │  Green box "Implementer" → arrow "code" →
  │  Yellow box "Reviewer" → arrow "feedback" →
  │  Orange box "Tester" → arrow "results" →
  └─ Cyan box "Docs Maintainer" (background, runs after each task)

Below each box, show: model (Opus/Sonnet/Haiku), memory (yes/no), isolation (worktree/none)

### Section 3: The Knowledge Base
Show the Obsidian vault as a node graph:
Central node "INDEX.md" connecting to:
- "project-requirements.md" (what we build)
- "project-state.md" (where we are)  
- "architecture.md" (how we build)
- "commands-registry.md" (what works)
- "changelog.md" (what changed — auto-populated)
Separate cluster labeled "Agent Context (lean)":
- "quick-ref.md" ← highlight this: "<500 tokens — agents load this by default"
- "active-todos.md"
- "file-map.md"
- "gotchas.md" ← highlight: "highest-signal doc — grows organically"

### Section 4: Skills Quick Reference
5 cards in a row:
| Gotchas | Git Conventions | Code Style | Commit | PR Create |
Each card shows: trigger keywords, ~token size, which agents use it

### Section 5: Hooks at a Glance
Show as a timeline/lifecycle:
SessionStart → "load-context.sh (injects quick-ref)"
PreToolUse(Bash) → "git-checkpoint.sh (auto-tags before destructive ops)"
PreToolUse(Write) → "write-guards (reviewer→gotchas only, researcher→plans only, interviewer→requirements only)"
PostToolUse(Write|Edit) → "log-change.sh (changelog) + auto-format.sh (ruff/prettier/gofmt)"
Stop → "on-task-complete.sh (marks completion)"

### Section 6: Slash Commands Cheat Sheet
Two columns:
Daily workflow: /project:interview, /project:init, /project:plan, /project:work, /project:research, /project:review
Session management: /project:status, /project:sync-docs, /project:checkpoint, /project:rollback, /project:fresh

### Section 7: Daily Flow Timeline
Morning → "status → plan → work"
During work → "checkpoint before risky ops · review after each feature · /fresh if context heavy"
End of day → "checkpoint → sync-docs → status"

### Footer
"Community-sourced from r/ClaudeCode · Based on patterns from 120+ dev teams"
"Template: github.com/[your-repo] · Browse docs in Obsidian"

## Design Notes:
- Use the agent colors consistently: red, blue, purple, green, yellow, orange, cyan, pink
- Dark background (#1a1a2e or similar)
- Monospace font for file paths and commands
- Keep text concise — this is a reference poster, not a document
- Total height: approximately 3000-4000px at 1200px wide
```
