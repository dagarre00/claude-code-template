<!-- Generated from .harness/; DO NOT EDIT. Run node scripts/sync-harness.mjs. -->

# Project

- Name: `<set during project initialization>`
- Vision: `<set during project initialization>`
- Stack: `<detect or ask during project initialization>`
- Application tests: `<verify during project initialization>`

# Project Schema — Wiki-Driven Development

This is a reusable development template for Claude Code, Codex, and Antigravity
CLI. The wiki is the application spec; `.harness/` is the canonical source for
the agent workflow. Generated harness files are delivery artifacts.

## Start every session

1. Read the behavioral rules included below.
2. Before implementation, read `docs/wiki/gotchas.md`, `docs/wiki/todos.md`, the
   matching entity Behavior cases, and relevant requirements and architecture.
3. Search `docs/wiki/` for related concepts and decisions before changing behavior.
4. Load only relevant skills. If a harness does not expose a skill loader, read
   `.harness/skills/<name>/SKILL.md` and its required supporting files directly.
5. Follow the current user's scope. When maintaining this uninitialized template,
   keep `docs/wiki/` and `docs/raw/` scaffolds blank: do not add migration todos,
   requirements, entities, ADRs, transcripts, or log entries. Put maintenance
   evidence in tests and commit messages. Project initialization fills these pages
   only from the adopting project's facts and the human's answers.

## Canonical authoring

Edit `.harness/project.md` for project identity and `.harness/instructions.md` for
shared operating instructions, plus `.harness/rules/`, `.harness/commands/project/`,
`.harness/skills/`, `.harness/agents/`, `.harness/templates/`, and
`.harness/worker-contract.md`. Engine, model, reasoning, and role overrides live
once in `.harness/settings.json`, which the coordination server reads at dispatch.
After any edit, run
`node scripts/sync-harness.mjs`, then `node scripts/sync-harness.mjs --check` and
`node --test tests/harness.test.mjs`. Commit source and generated outputs together.
Never edit `AGENTS.md`, `CLAUDE.md`, `.claude/skills/`, or `.agents/skills/`
directly. Commands and agents generate no files at all: the server serves
commands as MCP prompts, and a worker's role is prepended to its prompt.
Do not replace user-owned settings files. See `docs/harnesses.md` for the mapping.

## Workflow and delegation

The interactive conductor uses the coordination MCP server for every worker
dispatch, status check, cancellation, and local integration. Read and follow
`.harness/skills/mcp-coordination/SKILL.md`. There is no native delegation path:
no agent files are generated, so MCP dispatch is the only way to run a worker.
All project commands are conductor-only. If MCP is unavailable, report the blocker.

One developer owns Spec → Red → Green → Refactor → wiki update. The conductor
dispatches a read-only planner before complex/batched work and an independent
read-only adversary afterwards. This explicitly authorizes those worker roles.
Each worker receives an isolated worktree at committed HEAD, bounded context,
explicit owned paths, and the canonical worker contract. It never recursively
orchestrates, changes branches, pushes, opens PRs, or cleans up worktrees.

Use `get_settings()` to inspect the actual role configuration. Default engine
selection inherits the conductor CLI; per-role engine/model/reasoning overrides
are configured in `.harness/settings.json`. Prefer a different model for
adversarial review when available. If the resolved models are the same, preserve
fresh context and disclose reduced model independence. No profile authorizes
silently switching providers, installing a CLI, or bypassing CLI permissions.

The planner and reviewers return complete reports; the conductor persists scratch
mailboxes and passes plans inline to dependent workers. Ignored scratch is not
shared across worktrees. `wiki-maintainer` is manual only through
`project-wiki-lint` or an explicit human request; never auto-dispatch it.
Noninteractive workers return blockers at human checkpoints. The conductor asks
through the available question mechanism or plain conversation.

Local worker merges are controlled by MCP after verification, with expected
target and worker SHAs. The conductor owns pushing the integration branch and
opening feature PRs; the human owns remote PR merges. Worktrees prevent ordinary
file collisions but are **not security sandboxes**: permissions still apply and
the Git store and credentials may be shared.

## Files and shell commands

Paths written in backticks are repository-root paths unless explicitly relative.
Markdown links are navigation, not file inclusion. Read linked instructions when
directed. Only `CLAUDE.md` uses a native `@` import; other prompt content is expanded
by the generator. Do not assume `@path` or shell interpolation works in arbitrary
agent or skill bodies. Shared skills take the user's trailing context as their
argument, including spaces, quotes, Unicode, and newlines. Forward it verbatim
when delegating; never interpolate it into shell command text.

Shell examples labeled `bash` require Bash (Git Bash on Windows), not PowerShell.
Use the active shell's equivalents where necessary, preserving error checks and
quoting. The template's Node.js checks run directly in either shell. Do not confuse
template checks with the adopting application's test command.

## Wiki map

- `docs/raw/`: immutable input; append new project sources, never edit old sources.
- `docs/wiki/requirements.md`: what the application must do.
- `docs/wiki/architecture.md`: stack, layout, patterns, testing strategy.
- `docs/wiki/entities/`: feature/module specs and Behavior cases.
- `docs/wiki/concepts/`, `decisions/`, `summaries/`: patterns, ADRs, source summaries.
- `docs/wiki/design-system.md`: UI-only design contract, created when needed.
- `docs/wiki/commands.md`: verified application commands.
- `docs/wiki/todos.md`, `gotchas.md`, `log.md`, `wiki-todos.md`: work, traps, history,
  deferred wiki maintenance. Closed todos are removed; git records shipped work.

The wiki follows the Obsidian LLM-wiki standard in
`.harness/skills/wiki-update/SKILL.md`. Navigation uses the directory tree and graph;
there is no hand-maintained wiki index or glossary. Stack knowledge belongs in
skills, not additional domain agents. Evolve the toolkit through `update-toolkit`.


# Behavioral Rules

Hard constraints from real failures. These override default agent inclinations.

1. **Wiki-first, code-second.** Never change code behavior without also updating the relevant `docs/wiki/entities/<slug>.md`. If the spec is wrong, fix the spec first, then the code — in the same commit.

2. **Tests before implementation.** Never write production code without a failing test first. The Red phase is mandatory. Nothing enforces this on `feat/*` and `fix/*` — keeping the discipline is on you.

3. **Never modify tests to make them pass.** If a test seems wrong, update the entity Behavior spec → regenerate the test → implement. Changing a test to match broken code is not TDD.

4. **Tests must fail for the right reason.** A passing test before implementation tests existing behavior, not the new feature. Confirm RED is real (missing feature, not a typo or import error).

5. **Two-strike pivot.** Two failures on the same mechanism → stop and preserve the state. A worker returns both failures and its task ID to the conductor without tagging or resetting. The conductor may tag known committed state (`git tag checkpoint-<stamp>`) and puts any proposed reset to the human via `human-checkpoint`, presenting both failed attempts. Only on their say-so do you `git reset --hard` and re-spec via `project-interview`. The reset is gated because it is the most destructive step in this workflow: the tag protects committed history, but nothing protects uncommitted work — before it runs, `git status --porcelain` and account for every line (rule 21).

6. **Verify before asserting.** Run it, don't assume. Never tell the human a feature works unless tests pass and you read the output yourself.

7. **Never present uncertain information as fact.** If you're not sure, say so.

8. **Human in the loop.** When you need a decision the wiki doesn't answer, stop and ask. Use the `human-checkpoint` skill to format the ask. Do not silently improvise.

9. **No silent failures.** If a command fails, report the exact error.

10. **Scoped context for sub-agents.** Give sub-agents only the task, prior outputs, and relevant constraints. Never dump full memory.

11. **Raw sources are immutable.** Never edit files under `docs/raw/`. Only append new ones.

12. **Two review roles — never merged, both read-only.** The `reviewer` is periodic and whole-repo, in a fresh session context via `project-review`, never inside the work loop. The `adversary` is diff-scoped and per-change, dispatched by `project-work` step 7a (`[complex]`/batched) or `project-adversary`. Both read without the author's context and raise **findings only** — no edits, commits, pushes, or resets. A developer never audits its own work; a reviewer of either kind never fixes what it finds.

13. **Progressive disclosure.** Don't preload domain knowledge. Skills auto-load when their `description` matches the task. If a needed skill doesn't exist, create one via the `update-toolkit` skill rather than stuffing it into an agent prompt.

14. **Skills are how-to, not what-is.** When writing or editing a skill, the body must be a procedure: read these wiki pages, follow these steps, update these pages. Never explain a concept the LLM already knows.

15. **One agent owns the TDD loop.** The `developer` writes the failing test, confirms Red itself (rule 4 — don't trust a prior step), then implements. No tester/implementer split, no handoff JSON. The only upstream split is the `planner` (the reasoning profile), which returns a complete Markdown plan for `[complex]`/batched work. The conductor may persist `.harness/handoff/<slug>-plan.md` and passes the full plan inline to the developer; ignored scratch is not shared between worktrees. The entity Behavior cases remain the spec.

16. **Append, don't bury.** When writable agents discover something within their owned scope the maintainer should clean up later (orphan page, missing ADR, repeated concept), append a one-line entry to `docs/wiki/wiki-todos.md`. Don't wait for `project-wiki-lint`. Read-only agents report the discovery to the conductor instead of writing a queue entry.

17. **Use the existing workflow before improvising.** Slash commands and skills exist for a reason. If the workflow seems missing, add a command or skill via the `update-toolkit` skill — don't work around the gap silently.

18. **Obsidian LLM-wiki standard — hard rules.** Violating these breaks rendering, the graph, or dedup. Full standard: `wiki-update` skill. The invariants, inside `docs/wiki/`:
    - **Wikilink syntax.** Internal links are `[[wiki-style]]` (`[[entities/auth]]`, `[[gotchas#login-flow]]`, `[[concepts/retry-pattern|alias]]`), tags `#tag`, embeds `![[summaries/x]]`. External URLs and non-wiki files keep standard markdown links. A broken wikilink is a bug.
    - **Identity = filename.** No `id`/`name` field; alternative names go in `aliases`. Filenames never contain `* " \ / < > : | ? # ^ [ ]`.
    - **One page = one concept.** Before creating a page, check existing filenames and `aliases`; if the concept exists → update, don't duplicate.
    - **Flat frontmatter, quoted-solitary wikilinks.** No nested objects; plural special keys (`tags`, `aliases`, `cssclasses`); one `"[[page]]"` per list element.
    - **Closed vocabularies** for `type`/`abstraction`/`status` (defined in `wiki-update`); properties lowercase `snake_case`.
    - **Provenance, never invent.** Every non-trivial claim traces to a `docs/raw/` file; an unfillable gap is an `open_questions` entry or a question to the human, never invented prose.

19. **Branch for code changes; living wiki commits directly on develop (or current branch).**
    - **Code (`feat/*`, `fix/*`, `refactor/*`, `perf/*`)** is built on a dedicated branch cut from `develop` and merged via PR. The `developer` commits each Behavior case locally on its assigned worker branch. MCP integrates completed workers into the conductor's feature branch; the conductor verifies, pushes, and opens the PR.
    - **Living documentation & operations (`docs/wiki/`, `docs/raw/`, `.harness/` config)** from maintenance commands commit and push directly to `develop` — or stay on the active `feat/*`/`fix/*`/`chore/*` branch when mid-cycle. Strict PR gating for code, no PR fatigue for knowledge.
    - **The conductor pushes integration commits.** Workers never push. Their local branches and logs preserve results until integration, but are not an off-device backup. After each verified worker merge or conductor commit, push the integration branch. On network failure, retry with bounded backoff and report any remaining unpushed commits. No remote → skip the push and report local-only work.
    - **The log entry belongs to the mutation, not to the command.** Whatever changed tracked files — a command, a bare chat instruction, a one-off fix — appends a `## [YYYY-MM-DD HH:MM] <kind>` entry to `docs/wiki/log.md` in the same commit (`chore` when no kind fits). A timeline with holes is worse than none, because the wiki cites it as evidence. Coordinate ledger ownership: include log changes in the worker's owned paths or have the conductor record them after integration. During blank-template maintenance, do not fill wiki/raw scaffolds; record evidence in tests and commit messages instead.

20. **Every finding gets a written disposition, and the record is committed.** Each numbered adversary finding ends as **Filed** (a real todo line), **Fixed** (name what changed), or **Rejected** (one-sentence reason). Silence is not a disposition and "unlikely" is not a reason. Rejecting by citing an unwritten invariant → write the invariant down as part of the rejection.
    - **Filed is the default; fixing needs a human.** Findings become todos at the priority their severity maps to — not fixed in the cycle that surfaced them, not even two-line ones. Exception: a `critical`/`major` goes to the human via `human-checkpoint` (fix-now or queue); it is filed at P0/P1 only if they decline or are unreachable, and that is said prominently. A human instruction like "fix all the findings" is itself the approval, at that scope.
    - **The record is the commit.** Triage in the gitignored mailbox, then write each disposition into the commit that answers it: fixes name their finding; each round closes with a `docs(<slug>): adversary round N` commit whose body lists every finding's disposition. `git log --grep="adversary round"` must read the reasons back a cycle later — a disposition that exists only in deleted scratch satisfies nothing. Protocol: `adversarial-review` skill.

21. **A dirty tree you did not dirty belongs to someone else.** Workers run in separate worktrees; the integration checkout can still contain human or other-session changes. "Clean working tree" preconditions mean a verified clean checkout, not permission to erase unknown work. Never `stash`, `reset --hard`, `checkout --`, or `clean` over changes whose author you cannot account for — stop and run `human-checkpoint` naming the paths. Before any tree-wide destructive git operation, `git status --porcelain` and account for every line: a path you didn't touch this session is evidence, not dirt.

22. **A filed backlog needs a consumer, or filing is just deletion with extra steps.** Rule 20 makes filing the default, so `minor` findings accumulate by design (`nit` findings are never filed — the adversary tallies them and they end there). Two computable guards: `FINDINGS_MAX` caps the open `[adversary]` backlog (`docs/wiki/todos.md § Filed-findings backlog`), and `project-wiki-lint` re-triages it every pass — re-grading, merging duplicates, closing what later work fixed. A finding that sat unread through five cycles had the wrong severity, not too short a queue.

23. **MCP is the worker control plane.** The conductor follows `mcp-coordination` for spawn, status, cancellation, and SHA-pinned local integration. Workers obey `.harness/worker-contract.md`: no recursive dispatch, branch changes, pushes, PRs, merges, resets, stashes, tags, or cleanup. The toolkit generates no native agent files, so MCP dispatch is the only way to run a worker; a host CLI's own subagent tooling is not a second path. Serialize overlapping ownership and merge dependencies before dispatching dependents. On failure, preserve worktrees and logs; never force-clean to manufacture success.

## Adding rules

When a new failure pattern emerges that's broader than a project-specific quirk (i.e. it's a discipline issue, not a domain detail), append it here as a numbered rule. Project-specific failures go in `docs/wiki/gotchas.md`.

## Command catalog

Commands are MCP prompts served by the coordination server, not generated files, so one name works in every harness. Each accepts trailing free-text context. Logical IDs in shared procedures name the corresponding entry below.

Invoke a command as the MCP prompt `/mcp__coordination__<name>`, or call `get_workflow("<short name>", context)` and follow the body it returns.

| Command | Prompt name | Short name for `get_workflow` |
| --- | --- | --- |
| Point a read-only second model at the current change. | `project-adversary` | `adversary` |
| Post-init survey that reads the wiki and recommends specific agents and skills tailored to this project's stack, domain, and external services. | `project-agent-scout` | `agent-scout` |
| Package scoped work as a self-contained execution brief for a later MCP worker. | `project-handoff` | `handoff` |
| Detect project state, interview for requirements, scaffold docs/wiki, personalize canonical project context, and regenerate all harness entry points. | `project-init` | `init` |
| Grill-me-relentlessly Q&A to define a plan, a feature, or fill requirements. | `project-interview` | `interview` |
| Thorough review of the codebase against the wiki. | `project-review` | `review` |
| Direct ingest of a file or research topic into the wiki. | `project-wiki-ingest` | `wiki-ingest` |
| Periodic wiki health check. | `project-wiki-lint` | `wiki-lint` |
| Conductor-only TDD workflow. | `project-work` | `work` |

## Agent catalog

- `adversary` (reasoning): Read-only diff hunter. Returns numbered findings to the caller for its mailbox; never edits, commits, or pushes. Dispatched by project-work for complex/batched cycles or project-adversary. Distinct from the periodic reviewer.
- `developer` (balanced): TDD cycle in one agent — writes failing tests, makes them pass with minimal code, refactors, and updates the wiki. Follows a planner's plan for complex/batched work. Loads task-specific skills on demand. Triggered by project-work.
- `planner` (reasoning): Read-only planning worker. Returns a complete stepwise plan for complex or batched work through the coordination MCP server. Never writes files, tests, code, commits, or scratch.
- `researcher` (fast): Web research agent. Searches the web, fetches pages, synthesizes findings, and writes a structured raw research document to docs/raw/research/. Dispatched by project-wiki-ingest or directly by the human for research-heavy tasks. Never writes to docs/wiki/ directly — that's the ingest command's job.
- `reviewer` (balanced): Periodic thorough review. Runs in a fresh session context with no developer baggage. Audits code vs wiki, flags critical issues, warnings, drift, missing tests, security/perf concerns. Triggered by project-review.
- `wiki-maintainer` (balanced): Periodic wiki health — reconciliation pass (computable gaps/contradictions), lint invariants, batch ingest of straggler raw sources, cross-linking, legacy-page migration, ADR filing. MANUAL ONLY — never auto-invoked by another agent. Triggered exclusively by project-wiki-lint or an explicit human request. Individual ingests go through project-wiki-ingest, not through you.
