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

`.agents/` is the single canonical source for the agent workflow, read in
place by every CLI and never copied:

- **Claude Code** loads it as a plugin named `project` (skills and commands),
  configured in `.claude/settings.json`.
- **Codex** reads `.agents/skills/` natively, plus this file.
- **Antigravity** reads no repository files in print mode; its workers get
  everything from the prompt the workflow MCP composes.

Only this file and `CLAUDE.md` are generated, because the CLIs hardcode those
names. To change the workflow, edit `.agents/` and regenerate (`sync`) — never
edit `AGENTS.md` or `CLAUDE.md` by hand.

Commands have no MCP surface. Claude Code runs them as `/project:<name>`; any
other conductor reads `.agents/commands/<name>.md` when a human names one.

## Working here

1. The behavioral rules below override default inclinations.
2. Before implementation, read `docs/wiki/gotchas.md`, `docs/wiki/todos.md`,
   the matching entity Behavior cases, and the relevant requirements and
   architecture. Search `docs/wiki/` for related concepts and decisions before
   changing behavior.
3. Load only the skills the task needs. A CLI with no skill loader reads
   `.agents/skills/<name>/SKILL.md` directly.

## Delegating work

Workers are dispatched only through the workflow MCP (`tools/workflow-mcp`;
procedure: the `worker-dispatch` skill). It composes a prompt from `.agents/`
and returns a command to run, and every engine is launched with project-file
discovery suppressed, so that prompt is all a worker knows. The conductor owns
branches, commits, pushes and pull requests; workers deliver files.

**Never dispatch a role through a host CLI's own subagent tool** (Task/Agent) —
not even when the role's engine is the conductor's own: Claude Code running
`developer` on Sonnet still goes through `prepare_worktree`/`build_worker_prompt`.
A native subagent inherits the conductor's context and checkout: no worktree,
no owned paths, no suppression. That is also why roles live in `.agents/roles/`,
which no plugin loader scans — never recreate `.agents/agents/`.

A dispatched worker is a leaf; the conductor may dispatch as many as a cycle needs.

## Commands

The last column is what each dispatched role receives inlined in its prompt, not
what the conductor loads. Two roles of one command never share a skill — if both
need the same procedure, one role would do.

| Command | Purpose | Skills per dispatched role |
| --- | --- | --- |
| `/project:adversary` | Point a read-only second model at the current change — dispatch the adversary over the diff with none of the author's context, dispose of every numbered finding in writing, and re-review only what was fixed. Per-change; /project:review is the periodic whole-repo audit. | **adversary**: `adversarial-review` |
| `/project:init` | Run once at project start, or to repair a broken wiki layout — verify the workflow wiring, configure per-role engines and models, interview for requirements, scaffold docs/wiki with real answers, bootstrap a runnable test command, enforce the architecture, set up CI, and regenerate AGENTS.md/CLAUDE.md. | conductor only |
| `/project:interview` | Grill-me Q&A that defines a feature, a plan or the requirements — one question at a time, each with a recommended answer, resolving dependencies first; streams the transcript to docs/raw/interviews/ question by question and answer by answer, then updates the affected wiki pages. | conductor only |
| `/project:review` | Periodic whole-repo audit of the code against the wiki by the reviewer, in a fresh context with no developer baggage — critical issues, drift, missing tests, security and performance. Run about every 5 todos, before a release, or on suspected drift; never inside /project:work. | conductor only |
| `/project:sync-template` | Pull the generic workflow — .agents/ text and tools/workflow-mcp/ — from a template checkout into this adopting project, leaving project-owned files alone. Run in an adopting project, never in the template. Use when the template has fixes this project lacks, or a cycle here rediscovers a bug already fixed upstream. | conductor only |
| `/project:wiki` | Wiki operations, both run by the wiki-maintainer so the conductor never reads a source or the findings backlog itself. With an argument, ingest one source (a file path, or "search for <topic>" to research first); with none, the periodic health pass — wiki-todos queue, reconciliation, lint, orphans, broken links and the filed-findings backlog. | **wiki-maintainer**: `wiki-update` |
| `/project:work` | The core development loop — pick the top todo (or a batch sharing context), branch feat/* from develop, plan complex work, put the brief through the plan-adversary, run the developer Red→Green→refactor→wiki one Behavior case at a time, review the diff on complex cycles, and open a PR to develop once the entity is done. | **planner**: `plan-writing`, `spec-writing`<br>**plan-adversary**: `plan-review`<br>**developer**: `tdd-loop`, `clean-architecture`, `wiki-update`, `gotcha-recording`, `decision-recording`<br>**adversary**: `adversarial-review` |

## Roles

| Role | Profile | Access | Purpose |
| --- | --- | --- | --- |
| `adversary` | reasoning | read-only | Read-only diff hunter. Reviews a change against the wiki with none of the author's context and returns numbered findings; never edits. Dispatched by /project:work on [complex] or batched cycles, and by /project:adversary. |
| `developer` | balanced | write | Runs the whole TDD cycle, one Behavior case at a time — failing test, minimal code, refactor, wiki update — following the planner's plan when there is one. Dispatched by /project:work. |
| `plan-adversary` | balanced | read-only | Read-only pre-implementation hunter. Attacks the brief — the plan, or the todo line on a simple cycle — before any test exists and returns numbered findings; never writes a plan, a test or code. Dispatched by /project:work step 4a on every cycle. |
| `planner` | reasoning | read-only | Read-only. Decomposes a [complex] or batched todo into a stepwise implementation plan, returned in its report, for the developer to follow. Dispatched by /project:work. |
| `researcher` | fast | write | Searches and fetches the web and writes a cited raw research document to docs/raw/research/; never writes the wiki. Dispatched by /project:wiki for research ingest, or directly for research-heavy tasks. |
| `reviewer` | balanced | read-only | Read-only periodic auditor. Reviews the whole repository against the wiki in a fresh context — critical issues, drift, missing tests, security and performance. Dispatched by /project:review. |
| `triage` | balanced | read-only | Read-only second opinion on findings a reviewer already raised — an adversary's on a diff or a plan-adversary's on a brief — saying whether each holds, the disposition it recommends, and what a fix would touch. Dispatched by the conductor while disposing of a round. Never fixes, raises new findings or decides. |
| `wiki-maintainer` | balanced | write | Ingests sources into the wiki and runs its periodic health pass — wiki-todos queue, reconciliation, lint invariants, filed-findings re-triage, cross-linking, legacy migration. Manual only; dispatched exclusively by /project:wiki, in either mode. |

## Skills

Each skill is `.agents/skills/<name>/SKILL.md`, triggered by its `description`
frontmatter. Claude Code (as `project:<name>`) and Codex list them natively;
elsewhere, list that directory. Skills marked conductor-only are never sent to a
worker.

## Wiki map

- `docs/raw/` — immutable sources; add new ones, never edit old ones.
- `docs/wiki/requirements.md` — what the application must do;
  `architecture.md` — stack, layout, layers, testing strategy.
- `docs/wiki/entities/` — feature specs and their Behavior cases;
  `concepts/`, `decisions/`, `summaries/` — patterns, ADRs, source digests.
- `docs/wiki/commands.md` — verified application commands.
- `docs/wiki/todos.md`, `gotchas.md`, `log.md`, `wiki-todos.md` — work queue,
  traps, history, deferred wiki maintenance.

# Behavioral Rules

Hard constraints from real failures. They override default inclinations.

**Numbers are positions, not ids.** Workers receive these rules with the conductor-only ones removed and the rest renumbered, so text a worker may receive cites a rule by what it says, never by number. <!-- conductor-only -->

1. **Wiki-first, code-second.** Never change code behavior without updating the relevant `docs/wiki/entities/<slug>.md`. If the spec is wrong, fix the spec first, then the code — in the same commit.

2. **Tests before implementation.** No production code without a failing test first. A dispatched developer's Red is re-proven mechanically (its tests must fail with every other change reverted), but writing the test first is still on you.

3. **Never modify tests to make them pass.** A test that seems wrong means the Behavior spec changes first, then the test, then the code.

4. **Tests must fail for the right reason.** Red is the missing behavior — not a typo, a fixture error or a broken import. A test that passes before implementation tests existing behavior.

5. **Two-strike pivot.** Two failures on the same mechanism → `git tag checkpoint-<stamp>`, stop, and put the reset to the human via `human-checkpoint` with both attempts. Only on their say-so, `git reset --hard` and re-spec via `/project:interview`. Nothing protects uncommitted work, so first run `git status --porcelain` and account for every line (rule 21). <!-- conductor-only -->

6. **Verify before asserting.** Never say something works unless you ran it and read the output.

7. **Never present uncertain information as fact.** If you're not sure, say so.

8. **Human in the loop.** When you need a decision the wiki doesn't answer, stop and ask — the question, the options you see, your recommendation. A worker asks through its report; the conductor asks the human. Never silently improvise.

9. **No silent failures.** A failed command is reported with its exact error.

10. **Scoped context for sub-agents.** Give a worker only its task, prior outputs and relevant constraints — never your whole context. <!-- conductor-only -->

11. **Raw sources are immutable.** Never edit files under `docs/raw/`; only add new ones.

12. **Three read-only review roles, never merged.** The `plan-adversary` attacks the brief before any test (`/project:work` step 4a, every cycle). The `adversary` attacks the diff after cases land (`/project:work` step 7a on `[complex]`/batched cycles, or `/project:adversary`). The `reviewer` audits the whole repo periodically in a fresh context (`/project:review`, never inside `/project:work`). All three raise findings only — no edits, commits, pushes or resets. No author reviews its own work, and no reviewer fixes what it finds. <!-- conductor-only -->

13. **Progressive disclosure.** Don't preload domain knowledge; skills load when their `description` matches the task. A needed procedure with no skill is a gap to name — a worker in its report, the conductor by adding the skill — never text stuffed into an agent prompt.

14. **Skills are how-to, not what-is.** A skill body is a procedure: read these pages, do these steps, update these pages. Never explain what the model already knows.

15. **One agent owns the TDD loop.** The `developer` writes the failing test, confirms Red itself and implements — no tester/implementer split. The only upstream split is the read-only `planner`, whose plan reaches the developer as text in its instructions, never as a path: worktrees share no scratch. (Conductor: pass the saved plan as `instructions_file`, which is read in your checkout and inlined, or paste it into `instructions`.)

16. **Append, don't bury.** Something the maintainer should clean up later (orphan page, missing ADR, repeated concept) becomes a one-line entry in `docs/wiki/wiki-todos.md` now, not at the next health pass. If that file isn't yours to edit, put the line under `Follow-ups:` in your report.

17. **Use the existing workflow before improvising.** If a command or skill seems missing, name the gap — never work around it silently.

18. **Obsidian LLM-wiki standard — hard rules**, inside `docs/wiki/`:
    - **Wikilinks.** Internal links are `[[entities/auth]]`, `[[gotchas#login-flow]]`, `[[concepts/retry-pattern|alias]]`; embeds `![[summaries/x]]`; tags `#tag`. External URLs and non-wiki files use markdown links. A broken wikilink is a bug.
    - **Identity = filename.** No `id`/`name` field; other names go in `aliases`. Filenames never contain `* " \ / < > : | ? # ^ [ ]`.
    - **One page = one concept.** Check filenames and `aliases` before creating; update rather than duplicate.
    - **Flat frontmatter.** No nested objects; plural keys (`tags`, `aliases`, `cssclasses`); one quoted `"[[page]]"` per list element.
    - **Closed vocabularies** for `type`/`abstraction`/`status`; properties are lowercase `snake_case`.
    - **Provenance, never invent.** Every non-trivial claim traces to a `docs/raw/` file; an unfillable gap is an `open_questions` entry or a question to the human.

19. **Branch for code; living documentation commits directly.** <!-- conductor-only -->
    - **Code** (`feat/*`, `fix/*`, `refactor/*`, `perf/*`) is built on a branch cut from `develop` and merged by PR. The conductor commits each Behavior case as it lands; `/project:work` adds the log entry and opens the PR.
    - **Living documentation and operations** (`docs/wiki/`, `docs/raw/`, `.agents/` config) commit directly to `develop` — or ride the active `feat/*`/`fix/*`/`chore/*` branch mid-cycle.
    - **Always push after committing** — an unpushed commit is lost when the container recycles. Retry network failures with backoff. No remote → skip the push and say so.
    - **The log entry belongs to the mutation, not the command.** Anything that changes tracked files — a command, a chat instruction, a one-off fix — appends a `## [YYYY-MM-DD HH:MM] <kind>` entry to `docs/wiki/log.md` in the same commit (`chore` when no kind fits). The wiki cites the log as evidence, so it may not have holes.

20. **Every finding gets a written, committed disposition.** <!-- conductor-only -->
    - **Diff findings** (`adversary`) end as **Filed** (a real todo line), **Fixed** (name what changed) or **Rejected** (a one-sentence reason). Silence is not a disposition and "unlikely" is not a reason; rejecting on an unwritten invariant means writing the invariant down.
    - **Filed is the default; fixing needs a human.** Findings become todos at their severity's priority and are never fixed in the cycle that raised them, however small. A `critical`/`major` goes to the human via `human-checkpoint` (fix now or queue); declined or unreachable → filed at P0/P1, said prominently. "Fix all the findings" from the human is the approval, at that scope.
    - **The record is the commit.** Fixes name their finding; each round closes with a `docs(<slug>): adversary round N` commit listing every disposition, so `git log --grep="adversary round"` reads the reasons back.
    - **Brief findings** (`plan-adversary`, `/project:work` step 4a) invert the default: **Applied** (the brief changes — the default), **Escalated** (the spec is wrong → `human-checkpoint` → `/project:interview`) or **Rejected**. Never Filed: the cycle they are about starts now. No commit exists yet, so their dispositions go in the cycle's `work` log entry.
    - Protocol: `finding-disposition` skill.

21. **A dirty tree you did not dirty belongs to someone else.** Agents run concurrently on one checkout, so "clean working tree" means "clean **and mine**". Never `stash`, `reset --hard`, `checkout --` or `clean` over changes you can't account for — stop and ask the human, naming the paths. Before any tree-wide destructive git operation, run `git status --porcelain` and account for every line.

22. **A filed backlog needs a consumer.** Filing is the default, so `minor` findings accumulate by design (`nit`s are tallied, never filed). `FINDINGS_MAX` caps the open `[adversary]` backlog (`docs/wiki/todos.md § Filed-findings backlog`), and every `/project:wiki` health pass re-triages it — re-grading, merging duplicates, closing what later work fixed. A finding that sits unread through five cycles had the wrong severity. <!-- conductor-only -->

23. **Dependencies point inward.** Every source file belongs to the layer `docs/wiki/architecture.md § Layers` assigns it, and an inner layer never imports an outer one — it reaches the outside through a port it owns. The architecture check is part of green. Changing a layer, an allowed dependency or the check's rules is a human decision recorded as an ADR, never a side effect of making a test pass.

## Adding rules

A new failure pattern that is a discipline issue rather than a domain detail is appended here as the next number — never renumber, other files cite these numbers. Project-specific failures go in `docs/wiki/gotchas.md`.
