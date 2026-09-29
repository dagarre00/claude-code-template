# How this repository works

The wiki (`docs/wiki/`) is the application spec, and the workflow is plain Claude Code configuration under `.claude/`: roles as subagents in `agents/`, procedures as skills in `skills/`, the `/project:*` entry points in `commands/project/`, and these rules, which load with `CLAUDE.md` in every session and every subagent.

## Working here

1. The behavioral rules override default inclinations.
2. Before implementation, read `docs/wiki/gotchas.md`, `docs/wiki/todos.md`, the matching entity Behavior cases, and the relevant requirements and architecture. Search `docs/wiki/` for related concepts and decisions before changing behavior.
3. Load only the skills the task needs; each skill's `description` says when it applies.

## Delegating work

The main session is the **conductor**: it runs the `/project:*` commands and owns branches, commits, pushes and pull requests. It dispatches a role with the Agent tool and `subagent_type: <role>`, or writes it a handoff file the human runs in another harness — the procedure is the `subagent-dispatch` skill. Each role's file pins its model, effort, tools, permission mode and preloaded skills, so the dispatch carries only the brief.

- A subagent sees none of the conversation: its brief, its role file, these rules and its preloaded skills are its whole context. That is what makes a reviewer independent — never dispatch a role as a fork or through `general-purpose`, both of which carry the conductor's context.
- Roles run in this checkout, one writer at a time, starting from a clean tree. The conductor verifies what each one changed before committing it.
- A subagent is a leaf: no role has the Agent tool.
- **Dispatch mode.** By default the conductor asks at each dispatch whether to run the role natively or write a handoff file for a fresh Claude Code session, Antigravity or any other harness (`dispatch-handoff`). A leading `fast` in a dispatching command's argument runs every role natively and never waits on the human: each checkpoint takes its recorded default or ends the run (`human-checkpoint` § Fast mode). A leading `handoff` writes every dispatch as a file.

Dispatched subagents: this map is the conductor's. Your terms are the `subagent-contract` skill preloaded into you.

## Commands

Each takes free-text context as its argument; it scopes the command and never bypasses a precondition, the Red phase or a human checkpoint. In `work`, `adversary`, `review` and `wiki`, a leading `fast` or `handoff` sets the dispatch mode instead — `fast` answers each checkpoint with its recorded default, and ends the run where there is none.

| Command | Purpose | Dispatches |
| --- | --- | --- |
| `/project:init` | Once at project start, or to repair a broken layout — check the wiring, review role models, interview for requirements, scaffold `docs/wiki/` with real answers, bootstrap a runnable test command, enforce the architecture, set up CI, fill in `CLAUDE.md`. | — |
| `/project:interview` | Grill-me Q&A that defines a feature, a plan or the requirements — one question at a time with a recommended answer; streams the transcript to `docs/raw/interviews/`, then updates the wiki. | — |
| `/project:work` | The development loop — top todo (or a batch), `feat/*` from `develop`, plan complex work, review the brief, one Behavior case at a time Red → Green → refactor → wiki, review the diff on complex cycles, PR to `develop` once the entity is done. | `planner`, `plan-adversary`, `developer`, `adversary`, `triage` |
| `/project:adversary` | A read-only second model over the current change; every finding disposed of in writing. Per change. | `adversary`, `triage` |
| `/project:review` | Periodic whole-repo audit against the wiki in a fresh context — about every 5 todos, before a release, or on suspected drift. Never inside `/project:work`. | `reviewer` |
| `/project:wiki` | With an argument, ingest one source (a path, or `search for <topic>`); without, the wiki health pass — queue, reconciliation, lint, filed-findings backlog. | `researcher`, `wiki-maintainer` |
| `/project:sync-template` | Pull workflow fixes from a template checkout into this project, leaving project-owned files alone. Never in the template itself. | — |

## Roles

| Role | Model · effort | Access | Purpose |
| --- | --- | --- | --- |
| `planner` | opus · xhigh | writes only its plan file | Decomposes a `[complex]` or batched todo into a stepwise plan in `.handoff/<slug>-plan.md`. |
| `plan-adversary` | sonnet · high | read-only | Attacks the brief — the plan, or the todo line — before any test exists. |
| `developer` | sonnet · medium | write | Runs one Behavior case Red → Green → refactor → wiki, following the plan when there is one. |
| `adversary` | opus · high | read-only | Hunts defects in a small diff with none of the author's context. |
| `triage` | sonnet · high | read-only | Second opinion on findings a reviewer already raised; recommends, never decides. |
| `reviewer` | opus · high | read-only | Periodic whole-repo audit in a fresh context. |
| `wiki-maintainer` | sonnet · medium | writes `docs/wiki/` | Ingests sources and runs the wiki health pass. Dispatched only by `/project:wiki`. |
| `researcher` | sonnet · medium | writes one `docs/raw/research/` file | Searches and fetches the web into a cited raw document. |

Read-only roles have no edit tools and run in `dontAsk` mode: any command not allowlisted in `.claude/settings.json` is denied rather than prompted. The planner and the wiki-maintainer can write only where those allow rules let them.

## Skills

Each is `.claude/skills/<name>/SKILL.md`. **Conductor:** `subagent-dispatch`, `dispatch-handoff`, `finding-disposition`, `feature-branching`, `pr-create`, `git-recovery`, `human-checkpoint`, `update-toolkit`. **Preloaded into roles:** `subagent-contract` (all), `plan-writing` and `spec-writing` (planner), `plan-review` (plan-adversary), `tdd-loop`, `clean-architecture`, `gotcha-recording` and `decision-recording` (developer), `adversarial-review` (adversary), `wiki-update` (wiki-maintainer). `design-system-check` joins the developer's list on projects with a UI surface.

## Wiki map

- `docs/raw/` — immutable sources; add new ones, never edit old ones.
- `docs/wiki/requirements.md` — what the application must do; `architecture.md` — stack, layout, layers, testing strategy.
- `docs/wiki/entities/` — feature specs and their Behavior cases; `concepts/`, `decisions/`, `summaries/`, `reviews/` — patterns, ADRs, source digests, dated audit reports.
- `docs/wiki/commands.md` — verified application commands.
- `docs/wiki/todos.md`, `gotchas.md`, `log.md`, `wiki-todos.md` — work queue, traps, history, deferred wiki maintenance.
