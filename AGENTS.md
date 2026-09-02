# Antigravity Workspace Rules & Project Schema

This repository is a **template for agentic software development**. Two ideas govern everything:

1. **The wiki is the spec.** `docs/wiki/` is the source of truth for what the project is and how it works. Code that disagrees with the wiki is the bug.
2. **Progressive disclosure beats specialized agents.** A single `developer` agent runs the whole TDD cycle, loading task-specific skills on demand. The two deliberate splits are the `planner`, which decomposes `[complex]` or batched work before the developer executes it, and the `adversary`, which reads the resulting diff afterwards with none of the developer's context and raises findings it is not allowed to fix. Skills are short, procedural how-to for _this project_ — never abstract explanations of _what something is_.

## Single Source of Truth

To eliminate drift, all procedural skills, subagent definitions, and behavioral rules are defined canonically in [`.claude/`](.claude/):
- **Behavioral Rules:** [`.claude/rules/behavioral.md`](.claude/rules/behavioral.md)
- **Procedural Skills:** [`.claude/skills/<skill>/SKILL.md`](.claude/skills/) (mounted natively into Antigravity via [`.agents/skills.json`](.agents/skills.json))
- **Subagent Specifications:** [`.claude/agents/<agent>.md`](.claude/agents/)
- **Claude Commands:** [`.claude/commands/project/<command>.md`](.claude/commands/project/)

Antigravity command skills in [`.agents/skills/`](.agents/skills/) directly orchestrate these canonical procedures.

## Antigravity (AGY) Runtime Mappings

When following procedures from `.claude/`, apply these runtime conventions:

| Claude Concept / Tool | Antigravity (AGY) Equivalent | Notes |
| --------------------- | ---------------------------- | ----- |
| `AskUserQuestion` | `ask_question` tool | Format 2–4 options as user's response; list `(Recommended)` first. Otherwise output chat text and wait. |
| Subagent dispatch (`Agent`) | `invoke_subagent` tool | Use `TypeName: "self"` with named `Role` and prompt from `.claude/agents/<agent>.md`. |
| Model Tier | `inherit` model | Subagents inherit the active session model (e.g. Gemini 3.7 Flash / Pro). |
| Mailbox / Plan / Handoff scratch | `.claude/handoff/` | Gitignored scratch files (`*-plan.md`, `*-findings.md`, `*-handoff.md`). |
| GitHub MCP PR | `gh pr create` CLI fallback | Standard CLI if GitHub MCP server is absent. |

## Identity

You are an AI development agent working on this project in Antigravity (AGY). At the top of every session, read this file. Then, **before any implementation or code change**, check the wiki — never modify behavior blind:

1. Read `docs/wiki/gotchas.md` for known failure points.
2. Read `docs/wiki/todos.md` to know what's next.
3. If the task touches a feature, read the matching `docs/wiki/entities/<slug>.md` and the relevant section of `docs/wiki/requirements.md`.
4. Grep `docs/wiki/` for terms from the task to find related concepts, decisions, or summaries before you act.
5. Follow the active command skill — command skills orchestrate TDD, branching, interviews, diff reviews, and wiki updates.

## Operating Principles & Three Layers

- **Progressive disclosure.** Agents start with minimal context. Skills load on demand based on task content.
- **Spec → Test → Code.** Write the entity Behavior cases first, derive failing tests, then implement.
- **Wiki always current.** Code edits and wiki edits ship together, in the same commit.
- **Human in the loop.** When you need the human, stop and ask via `human-checkpoint` / `ask_question`.

### Three layers
1. **Raw sources** — `docs/raw/` (immutable, append-only inbox).
2. **Wiki** — `docs/wiki/` (LLM-owned compiled state; living spec).
3. **Schema** — `AGENTS.md`, `CLAUDE.md`, `.claude/`, `.agents/skills/`.

## Where things live

| Question you have                    | File                                                                         |
| ------------------------------------ | ---------------------------------------------------------------------------- |
| What should this project do?         | `docs/wiki/requirements.md` — living spec; code that disagrees is the bug    |
| How is it built?                     | `docs/wiki/architecture.md` (stack, patterns, testing strategy)              |
| What does this feature do, exactly?  | `docs/wiki/entities/<slug>.md` — one page per feature/module; Behavior cases |
| What should the UI look and feel like? | `docs/wiki/design-system.md` — token roles, contrast/a11y assertions        |
| Why did we choose X?                 | `docs/wiki/decisions/` — ADRs                                                |
| What pattern do we use for X?        | `docs/wiki/concepts/` — patterns, conventions, domain ideas                  |
| What can go wrong?                   | `docs/wiki/gotchas.md` — known failure points                                |
| What's next?                         | `docs/wiki/todos.md` — priority-ordered queue; `[wiki]` lines are lint work  |
| What's shipped?                      | git history — one commit per Behavior case; closed todos **removed** from `todos.md` |
| How do I run the tests?              | `docs/wiki/commands.md` — working shell commands                             |
| Branch / commit rules?               | `docs/wiki/git-conventions.md`                                               |
| What happened, and when?             | `docs/wiki/log.md` — chronological ops log                                   |
| What wiki cleanup is deferred?       | `docs/wiki/wiki-todos.md` — `/project:wiki-lint` processes it                |
| What did source X say?               | `docs/wiki/summaries/` — one page per ingested source in `docs/raw/`         |
| Where are the immutable sources?     | `docs/raw/` — `interviews/`, `research/`; append-only                        |
| What are the binding rules?          | `.claude/rules/behavioral.md` (inlined below)                                |
| How do I structure a wiki page?      | `.claude/skills/wiki-update/SKILL.md` — standard + templates                 |

## Commands (Exposed via Antigravity Skills)

| Command / Skill | Purpose | Argument |
| --------------- | ------- | -------- |
| `project-init` (`/init`) | Detect project state, scaffold `docs/wiki/`, fill base docs, initialize git if needed | Context to read first, or a stated fact |
| `project-interview` (`/interview`) | Grill-me-relentlessly Q&A for requirements/feature. Streams transcript to `docs/raw/interviews/`, then updates wiki | The topic to grill on |
| `project-work` (`/work`) | Pick top todo (or batch), branch from `develop`, dispatch `planner` then `developer`, commit, push, PR | Which todo/entity to work, or batch |
| `project-adversary` (`/adversary`) | Point read-only second model (fresh context) at diff. Findings only — triage each one | Base ref to diff against, or lens |
| `project-review` (`/review`) | Thorough review of code vs wiki in fresh session context | Area or lens to pin review to |
| `project-wiki-lint` (`/wiki-lint`) | Wiki health check: reconciliation, lint invariants, orphans, broken links, drift | Subtree or single check to focus on |
| `project-wiki-ingest` (`/wiki-ingest`) | Ingest file or research topic into wiki (`spec.pdf` or `search for ...`) | File path or query (**required**) |
| `project-agent-scout` (`/agent-scout`) | Post-init survey: recommends agents and skills tailored to this project's stack, domain, and services | Signal category, feature, or output filter |
| `project-handoff` (`/handoff`) | Package a todo as a self-contained brief for an external (non-Claude) LLM agent | Which todo/entity to delegate, or a batch |

## Agent Routing (All Subagents Inherit Active Session Model)

| Task | Agent Spec | AGY Invocation |
| ---- | ---------- | -------------- |
| Complex/batched planning (before tests) | [`.claude/agents/planner.md`](.claude/agents/planner.md) | `invoke_subagent` (TypeName: `self`, Role: `Planner`, Model: `inherit`) |
| Code implementation (Red → Green → Refactor) | [`.claude/agents/developer.md`](.claude/agents/developer.md) | In-orchestrator or `invoke_subagent` (TypeName: `self`, Role: `Developer`, Model: `inherit`) |
| Adversarial diff audit (findings only) | [`.claude/agents/adversary.md`](.claude/agents/adversary.md) | `invoke_subagent` (TypeName: `self`, Role: `Adversary`, Model: `inherit`; prompt enforces read-only) |
| Periodic full audit (≈every 5 todos) | [`.claude/agents/reviewer.md`](.claude/agents/reviewer.md) | `invoke_subagent` (TypeName: `self`, Role: `Reviewer`, Model: `inherit`) |
| Periodic wiki health, ingest, cross-link | [`.claude/agents/wiki-maintainer.md`](.claude/agents/wiki-maintainer.md) | **Manual only** via `project-wiki-lint` (TypeName: `self`, Role: `Wiki Maintainer`, Model: `inherit`) |
| Web research — search, fetch, synthesize | [`.claude/agents/researcher.md`](.claude/agents/researcher.md) | `invoke_subagent` (TypeName: `self`, Role: `Researcher`, Model: `inherit`) |

## Hard Behavioral Constraints (Behavioral Rules)

1. **Wiki-first, code-second.** Never change code behavior without also updating the relevant `docs/wiki/entities/<slug>.md`. Spec first, then code — same commit.
2. **Tests before implementation.** Never write production code without a failing test first (Red phase mandatory).
3. **Never modify tests to make them pass.** Update the entity Behavior spec → regenerate test → implement.
4. **Tests must fail for the right reason.** Confirm RED is real (missing feature, not typo/import error).
5. **Two-strike pivot.** Two failures on same mechanism → tag state (`git tag checkpoint-<stamp>`), stop, ask human via `human-checkpoint` / `ask_question`.
6. **Verify before asserting.** Run test commands and read output directly; don't assume.
7. **Never present uncertain information as fact.**
8. **Human in the loop.** When a decision isn't answered by the wiki, ask via `human-checkpoint` (`ask_question`).
9. **No silent failures.** Report exact errors.
10. **Scoped context for sub-agents.** Pass only task, outputs, and constraints.
11. **Raw sources are immutable.** Never edit under `docs/raw/`; append-only.
12. **Two review roles — never merged, both read-only.** `reviewer` is periodic whole-repo (`project-review`). `adversary` is diff-scoped per-change (`project-adversary` / `project-work`). Findings only; no code edits.
13. **Progressive disclosure.** Skills load on demand.
14. **Skills are how-to, not what-is.**
15. **One agent owns the TDD loop.** `developer` owns Red → Green → Refactor → Commit.
16. **Append, don't bury.** Queue deferred cleanups in `docs/wiki/wiki-todos.md`.
17. **Use the existing workflow before improvising.**
18. **Obsidian LLM-wiki standard — hard rules.** Internal links `[[wiki-style]]`, flat frontmatter, solitary quoted wikilinks in properties, closed vocabulary, provenance traces to `docs/raw/`.
19. **Branch for code changes; living wiki commits directly on develop.**
20. **Every finding gets a written disposition, and the record is committed.** Filed (default), Fixed (approved only), or Rejected (one-sentence reason).
21. **A dirty tree you did not dirty belongs to someone else.** Never wipe unaccounted changes.
22. **A filed backlog needs a consumer.** Re-triage adversary backlog during `project-wiki-lint`.
