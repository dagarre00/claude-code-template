<!-- Generated from .agents/ by tools/workflow-mcp. DO NOT EDIT.
     Edit the canonical source in .agents/ and regenerate. -->

# Project

- Name: `<set during project initialization>`
- Vision: `<set during project initialization>`
- Stack: `<detect or ask during project initialization>`
- Application tests: `<verify during project initialization>`

This is a reusable development template for Claude Code, Codex, and Antigravity
CLI. The wiki is the application spec; `.agents/` is the canonical source for the
agent workflow, read directly by every CLI that can read repository files.

`/project:init` fills the four fields above from the adopting project's facts.

# How this repository works

`.agents/` is the single canonical source for the agent workflow. Every CLI
reads it directly:

- **Claude Code** loads `.agents/` as a plugin named `project` — skills,
  commands and agent definitions — configured in `.claude/settings.json`.
- **Codex** reads `.agents/skills/` natively, plus this file.
- **Antigravity** reads no repository files in print mode; its workers receive
  everything in the prompt composed by the workflow MCP.

Nothing under `.agents/` is ever copied. Only this file and `CLAUDE.md` are
generated, because those two filenames are hardcoded by the CLIs that read them.

## Working here

1. Read the behavioral rules below — they override default inclinations.
2. Before implementation, read `docs/wiki/gotchas.md`, `docs/wiki/todos.md`,
   the matching entity Behavior cases, and the relevant requirements and
   architecture.
3. Search `docs/wiki/` for related concepts and decisions before changing
   behavior.
4. Load only the skills the task needs. If a CLI exposes no skill loader, read
   `.agents/skills/<name>/SKILL.md` directly.

To change the workflow itself, edit `.agents/` and regenerate — never edit
`AGENTS.md` or `CLAUDE.md` by hand.

## Delegating work

Workers are dispatched through the workflow MCP server
(`tools/workflow-mcp`), which composes a prompt from `.agents/` and hands
back a command to run. A worker receives that prompt and nothing else: every
engine is launched with its project-file discovery suppressed, so the prompt is
the complete statement of how it must work. The conductor owns branches,
commits, pushes and pull requests; workers deliver files.

**MCP is the only dispatch path.** Never delegate a role to a host CLI's own
subagent mechanism, and never recreate `.agents/agents/` — roles deliberately
live in `.agents/roles/`, which no plugin loader scans, so they cannot be
published as native subagent types. A natively dispatched role would inherit the
conductor's whole context and run in the conductor's checkout with no worktree,
no owned paths and no suppression: every guarantee above, lost silently.

Only a dispatched worker is a leaf. The conductor may dispatch as many workers
as a cycle needs — `/project:work` runs a planner, a developer and an
adversary — and it is not itself a worker.

## Commands

`skills` names what each **dispatched role** receives inlined in its composed
prompt — not what the conductor uses, which it loads itself from
`.agents/skills/`. Two roles dispatched by one command may never share a skill:
if both need the same procedure, one role would have done the work of both.

| Command | Purpose | Skills per dispatched role |
| --- | --- | --- |
| `/project:adversary` | Point a read-only second model at the current change. Dispatches the adversary agent (Opus, fresh context) over the diff, collects numbered findings in a mailbox file, triages each one, and re-reviews once. Diff-scoped and per-change — unlike /project:review, which is periodic and whole-repo. | **adversary**: `adversarial-review` |
| `/project:init` | Detect project state, interview for requirements, scaffold docs/wiki, update CLAUDE.md with project parameters. Run once at project start, or to recover from a broken wiki layout. | conductor only |
| `/project:interview` | Grill-me-relentlessly Q&A to define a plan, a feature, or fill requirements. Walks down each branch of the decision tree, resolving dependencies one at a time. Always provides a recommended answer. Streams a transcript to docs/raw/interviews/ Q-by-Q and A-by-A (never batched at the end), then updates affected wiki pages. | conductor only |
| `/project:review` | Thorough review of the codebase against the wiki. Runs the reviewer agent in a fresh session context with no developer baggage. Flags critical issues, warnings, drift, missing tests, security/perf concerns. Use periodically (~every 5 todos), never inside /project:work. | conductor only |
| `/project:wiki-ingest` | Direct ingest of a file or research topic into the wiki. Use /project:wiki-ingest specification.pdf to ingest a document, or /project:wiki-ingest search for exchange rates APIs to research and ingest. Focused — no lint pass, just ingest. | conductor only |
| `/project:wiki-lint` | Periodic wiki health check. Dispatches the wiki-maintainer to process the wiki-todos.md queue, run the computable reconciliation pass (schema gaps, asymmetric relations, unresolved contradicts), check lint invariants, find orphans, broken [[links]], stale claims, and missing ADRs. Run every few work cycles or when wiki-todos.md is piling up. | **wiki-maintainer**: `wiki-update` |
| `/project:work` | Pick the top todo (or batch consecutive todos sharing context), open a feat/* branch from develop, dispatch the planner (Opus) for complex/batched work, then the developer through red→green→refactor→wiki-update, then commit, push, and (if the entity is fully done) open a PR to develop and return to develop. The core development loop. | **planner**: `plan-writing`, `spec-writing`<br>**developer**: `tdd-loop`, `wiki-update`, `gotcha-recording`, `decision-recording`<br>**adversary**: `adversarial-review` |

## Roles

| Role | Profile | Access | Purpose |
| --- | --- | --- | --- |
| `adversary` | reasoning | read-only | Read-only diff hunter. Reviews the current change against the wiki with zero developer context and returns numbered findings in its report, which the conductor files into the mailbox — never edits, commits, or pushes. Dispatched by /project:work for [complex] or batched cycles, and by /project:adversary on demand. Distinct from the periodic whole-repo reviewer. |
| `developer` | balanced | write | TDD cycle in one agent — writes failing tests, makes them pass with minimal code, refactors, and updates the wiki. Follows a planner's plan for complex/batched work. Loads task-specific skills on demand. Triggered by /project:work. |
| `planner` | reasoning | read-only | Decomposes complex or batched todos into a stepwise implementation plan for the developer. Dispatched by /project:work when a todo is flagged [complex] or 2+ todos are batched. Reads entity Behavior cases, surveys the codebase, writes .handoff/<slug>-plan.md. Runs on Opus. |
| `researcher` | fast | write | Web research agent. Searches the web, fetches pages, synthesizes findings, and writes a structured raw research document to docs/raw/research/. Dispatched by /project:wiki-ingest or directly by the human for research-heavy tasks. Never writes to docs/wiki/ directly — that's the ingest command's job. |
| `reviewer` | balanced | read-only | Periodic thorough review. Runs in a fresh session context with no developer baggage. Audits code vs wiki, flags critical issues, warnings, drift, missing tests, security/perf concerns. Triggered by /project:review. |
| `wiki-maintainer` | balanced | write | Periodic wiki health — reconciliation pass (computable gaps/contradictions), lint invariants, batch ingest of straggler raw sources, cross-linking, legacy-page migration, ADR filing. MANUAL ONLY — never auto-invoked by another agent. Triggered exclusively by /project:wiki-lint or an explicit human request. Individual ingests go through /project:wiki-ingest, not through you. |

## Skills

- `adversarial-review` — How to run and answer an adversarial diff review in this project — dispatching the read-only adversary, the mailbox file format, the six-category sweep, severity vocabulary, and the triage protocol for each finding. Use when finishing a [complex] or batched cycle, or whenever a change needs a second set of eyes before commit. Trigger on "adversarial review", "second model", "review the diff", "findings", "mailbox", "triage findings", "red team the change", "before I call it done".
- `decision-recording` — How to file an Architectural Decision Record (ADR) when making a non-trivial design choice. Use when picking between reasonable alternatives that will be hard to change later. Trigger on "ADR", "decision", "design choice", "architecture decision", "we decided", "why we picked".
- `design-system-check` — How to make a UI change in this project against docs/wiki/design-system.md — read the token roles before writing, reference roles instead of raw values, and verify the page's assertions before commit. Use for any change that touches visual output. Trigger on "UI change", "component", "styling", "CSS", "add a button", "design system", "design tokens", "colour", "typography", "spacing", "contrast", "accessibility", "dark mode", "responsive".
- `feature-branching` — Branching procedure for this project — when to branch, batching rules, finishing-up checklist. Commit-message format itself lives in docs/wiki/git-conventions.md. Trigger on "start branch", "feat/", "fix/", "batch todos", "finish feature".
- `git-recovery` — Emergency and advanced git operations, and merge/rebase conflict resolution. Stash, cherry-pick, bisect, blame, undo a commit, recover lost work, clean up a branch, resolve conflicts. Trigger on "stash", "cherry-pick", "bisect", "git blame", "lost commit", "undo commit", "recover", "clean up branch", "drop commit", "reflog", "merge conflict", "rebase conflict", "CONFLICT (content)", "<<<<<<", "resolve conflict", "git merge failed", "git rebase failed".
- `gotcha-recording` — How to capture a project-specific failure mode in docs/wiki/gotchas.md so future agents avoid it. Use when you just got burned by something non-obvious that other agents will hit. Trigger on "gotcha", "burned by", "footgun", "got bitten", "edge case", "surprising behavior".
- `human-checkpoint` — When and how to pause for the human — present a clear ask, options, and recommendation. Use whenever you need a decision the wiki doesn't answer, hit a two-strike pivot, or face risky/irreversible state. Trigger on "ask the human", "stop and ask", "human checkpoint", "need decision", "risky operation".
- `plan-writing` — How to write an implementation plan for a complex or batched todo in this project. Loads when the planner agent runs, or when the human asks for "a plan", "decomposition", "breakdown", "implementation strategy", "sequencing".
- `pr-create` — How to draft and open a pull request for this project. Loads when a feature branch is finished — all Behavior cases [x] via /project:work, or the human asks for a PR. Trigger on "open PR", "create pull request", "PR template", "PR body", "draft PR", "feature complete", "all cases ticked".
- `spec-writing` — How to write entity Behavior cases that produce good tests. Use when adding a new entity page, refining behavior during /project:interview, or splitting a vague case into testable ones. Trigger on "behavior cases", "spec", "entity behavior", "acceptance criteria", "what does this entity do".
- `tdd-loop` — Red-green-refactor procedure for this project. Use when implementing any feature or bugfix, before writing any production code. Trigger on "TDD", "red phase", "green phase", "refactor", "failing test", "make test pass", "tdd loop".
- `update-toolkit` — How to add, modify, or retire an agent, a skill, or a slash command in this project — the meta skill that evolves the agent's own toolkit. Use when the workflow needs a new specialist role, a new how-to procedure, or a new repeatable entry point; when an existing one drifts; or when one is unused. Trigger on "new agent", "add agent", "modify agent", "agent role", "new skill", "add skill", "modify skill", "skill drift", "missing how-to", "new command", "add command", "slash command", "modify command".
- `wiki-update` — How to structure a wiki page under the Obsidian LLM-wiki standard — placement/dedup before creating, canonical templates, facet vocabulary, link ontology — and how to route discoveries (gotchas / ADRs / cross-page cleanup). Use when creating or restructuring any docs/wiki/ page, or deciding whether a discovery belongs inline or in the maintainer queue. Trigger on "new entity page", "new concept page", "wiki page structure", "frontmatter", "wikilink property", "aliases", "inline vs maintainer", "wiki-todos queue", "found a pattern", "found a contradiction".

## Wiki map

- `docs/raw/`: immutable input; append new sources, never edit old ones.
- `docs/wiki/requirements.md`: what the application must do.
- `docs/wiki/architecture.md`: stack, layout, patterns, testing strategy.
- `docs/wiki/entities/`: feature/module specs and Behavior cases.
- `docs/wiki/concepts/`, `decisions/`, `summaries/`: patterns, ADRs, sources.
- `docs/wiki/commands.md`: verified application commands.
- `docs/wiki/todos.md`, `gotchas.md`, `log.md`, `wiki-todos.md`: work,
  traps, history, deferred wiki maintenance.

---
name: behavioral-rules
description: Hard behavioral constraints for all agents. Loaded at session start.
type: rule
---

# Behavioral Rules

Hard constraints from real failures. These override default agent inclinations.

1. **Wiki-first, code-second.** Never change code behavior without also updating the relevant `docs/wiki/entities/<slug>.md`. If the spec is wrong, fix the spec first, then the code — in the same commit.

2. **Tests before implementation.** Never write production code without a failing test first. The Red phase is mandatory. Nothing enforces this on `feat/*` and `fix/*` — keeping the discipline is on you.

3. **Never modify tests to make them pass.** If a test seems wrong, update the entity Behavior spec → regenerate the test → implement. Changing a test to match broken code is not TDD.

4. **Tests must fail for the right reason.** A passing test before implementation tests existing behavior, not the new feature. Confirm RED is real (missing feature, not a typo or import error).

5. **Two-strike pivot.** Two failures on the same mechanism → tag the state (`git tag checkpoint-<stamp>`), stop, and put the reset to the human via `human-checkpoint`, presenting both failed attempts. Only on their say-so do you `git reset --hard` and re-spec via `/project:interview`. The reset is gated because it is the most destructive step in this workflow: the tag protects committed history, but nothing protects uncommitted work — before it runs, `git status --porcelain` and account for every line (rule 21). <!-- conductor-only -->

6. **Verify before asserting.** Run it, don't assume. Never tell the human a feature works unless tests pass and you read the output yourself.

7. **Never present uncertain information as fact.** If you're not sure, say so.

8. **Human in the loop.** When you need a decision the wiki doesn't answer, stop and ask. Use the `human-checkpoint` skill to format the ask. Do not silently improvise.

9. **No silent failures.** If a command fails, report the exact error.

10. **Scoped context for sub-agents.** Give sub-agents only the task, prior outputs, and relevant constraints. Never dump full memory. <!-- conductor-only -->

11. **Raw sources are immutable.** Never edit files under `docs/raw/`. Only append new ones.

12. **Two review roles — never merged, both read-only.** The `reviewer` is periodic and whole-repo, in a fresh session context via `/project:review`, never inside the work loop. The `adversary` is diff-scoped and per-change, dispatched by `/project:work` step 7a (`[complex]`/batched) or `/project:adversary`. Both read without the author's context and raise **findings only** — no edits, commits, pushes, or resets. A developer never audits its own work; a reviewer of either kind never fixes what it finds. <!-- conductor-only -->

13. **Progressive disclosure.** Don't preload domain knowledge. Skills auto-load when their `description` matches the task. If a needed skill doesn't exist, create one via the `update-toolkit` skill rather than stuffing it into an agent prompt.

14. **Skills are how-to, not what-is.** When writing or editing a skill, the body must be a procedure: read these wiki pages, follow these steps, update these pages. Never explain a concept the LLM already knows.

15. **One agent owns the TDD loop.** The `developer` writes the failing test, confirms Red itself (rule 4 — don't trust a prior step), then implements. No tester/implementer split, no handoff JSON. The only upstream split is the `planner` (Opus), whose `.handoff/<slug>-plan.md` for `[complex]`/batched work is markdown scratch the developer reads, never a contract to validate.

16. **Append, don't bury.** When agents discover something the maintainer should clean up later (orphan page, missing ADR, repeated concept), append a one-line entry to `docs/wiki/wiki-todos.md`. Don't wait for `/project:wiki-lint`.

17. **Use the existing workflow before improvising.** Slash commands and skills exist for a reason. If the workflow seems missing, add a command or skill via the `update-toolkit` skill — don't work around the gap silently.

18. **Obsidian LLM-wiki standard — hard rules.** Violating these breaks rendering, the graph, or dedup. Full standard: `wiki-update` skill. The invariants, inside `docs/wiki/`:
    - **Wikilink syntax.** Internal links are `[[wiki-style]]` (`[[entities/auth]]`, `[[gotchas#login-flow]]`, `[[concepts/retry-pattern|alias]]`), tags `#tag`, embeds `![[summaries/x]]`. External URLs and non-wiki files keep standard markdown links. A broken wikilink is a bug.
    - **Identity = filename.** No `id`/`name` field; alternative names go in `aliases`. Filenames never contain `* " \ / < > : | ? # ^ [ ]`.
    - **One page = one concept.** Before creating a page, check existing filenames and `aliases`; if the concept exists → update, don't duplicate.
    - **Flat frontmatter, quoted-solitary wikilinks.** No nested objects; plural special keys (`tags`, `aliases`, `cssclasses`); one `"[[page]]"` per list element.
    - **Closed vocabularies** for `type`/`abstraction`/`status` (defined in `wiki-update`); properties lowercase `snake_case`.
    - **Provenance, never invent.** Every non-trivial claim traces to a `docs/raw/` file; an unfillable gap is an `open_questions` entry or a question to the human, never invented prose.

19. **Branch for code changes; living wiki commits directly on develop (or current branch).** <!-- conductor-only -->
    - **Code (`feat/*`, `fix/*`, `refactor/*`, `perf/*`)** is built on a dedicated branch cut from `develop` and merged via PR. The `developer` commits and pushes each Behavior case as it lands; `/project:work` adds the log entry and opens the PR.
    - **Living documentation & operations (`docs/wiki/`, `docs/raw/`, `.agents/` config)** from maintenance commands commit and push directly to `develop` — or stay on the active `feat/*`/`fix/*`/`chore/*` branch when mid-cycle. Strict PR gating for code, no PR fatigue for knowledge.
    - **Always push after committing.** Execution containers recycle between sessions; an unpushed commit is lost work. On network failure, retry with backoff. No remote → skip the push and note it in the report.
    - **The log entry belongs to the mutation, not to the command.** Whatever changed tracked files — a command, a bare chat instruction, a one-off fix — appends a `## [YYYY-MM-DD HH:MM] <kind>` entry to `docs/wiki/log.md` in the same commit (`chore` when no kind fits). A timeline with holes is worse than none, because the wiki cites it as evidence.

20. **Every finding gets a written disposition, and the record is committed.** Each numbered adversary finding ends as **Filed** (a real todo line), **Fixed** (name what changed), or **Rejected** (one-sentence reason). Silence is not a disposition and "unlikely" is not a reason. Rejecting by citing an unwritten invariant → write the invariant down as part of the rejection. <!-- conductor-only -->
    - **Filed is the default; fixing needs a human.** Findings become todos at the priority their severity maps to — not fixed in the cycle that surfaced them, not even two-line ones. Exception: a `critical`/`major` goes to the human via `human-checkpoint` (fix-now or queue); it is filed at P0/P1 only if they decline or are unreachable, and that is said prominently. A human instruction like "fix all the findings" is itself the approval, at that scope.
    - **The record is the commit.** Triage in the gitignored mailbox, then write each disposition into the commit that answers it: fixes name their finding; each round closes with a `docs(<slug>): adversary round N` commit whose body lists every finding's disposition. `git log --grep="adversary round"` must read the reasons back a cycle later — a disposition that exists only in deleted scratch satisfies nothing. Protocol: `adversarial-review` skill.

21. **A dirty tree you did not dirty belongs to someone else.** Agents run concurrently on one checkout, so "clean working tree" preconditions read "clean **and mine**". Never `stash`, `reset --hard`, `checkout --`, or `clean` over changes whose author you cannot account for — stop and run `human-checkpoint` naming the paths. Before any tree-wide destructive git operation, `git status --porcelain` and account for every line: a path you didn't touch this session is evidence, not dirt.

22. **A filed backlog needs a consumer, or filing is just deletion with extra steps.** Rule 20 makes filing the default, so `minor` findings accumulate by design (`nit` findings are never filed — the adversary tallies them and they end there). Two computable guards: `FINDINGS_MAX` caps the open `[adversary]` backlog (`docs/wiki/todos.md § Filed-findings backlog`), and `/project:wiki-lint` re-triages it every pass — re-grading, merging duplicates, closing what later work fixed. A finding that sat unread through five cycles had the wrong severity, not too short a queue. <!-- conductor-only -->

## Adding rules

When a new failure pattern emerges that's broader than a project-specific quirk (i.e. it's a discipline issue, not a domain detail), append it here as a numbered rule. Project-specific failures go in `docs/wiki/gotchas.md`.
