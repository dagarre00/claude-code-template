# How this repository works

`docs/wiki/` is the application spec. `.claude/` holds roles (`agents/`), procedures (`skills/`), commands (`commands/project/`), and rules (`rules/`).

## Delegating work

The main session is the **conductor**: it runs `/project:*` commands, dispatches roles via `subagent-dispatch` (`Agent` tool with `subagent_type: <role>` or `dispatch-handoff`), verifies changes, and owns every branch, commit, push and PR.

- **Fresh context:** subagents see only their brief, role file, rules and preloaded skills — never dispatch via `fork` or `general-purpose` (rule 10). Subagents are leaves (no `Agent` tool) and share this checkout one writer at a time from a clean tree.
- **Dispatch mode:** **native is the default** and changes only when the human asks (a leading `handoff`/`fast`, or naming one role); default runs every role natively without asking; checkpoints still stop for the human. Leading `handoff` writes every dispatch to `.handoff/`; leading `fast` runs natively and answers checkpoints by recorded default (`human-checkpoint` § Fast mode). Naming one role (`hand off the adversary`) hands off that dispatch alone.
- Dispatched subagents obey the preloaded `subagent-contract` skill.

## Commands

Each accepts free-text context (and leading `fast` or `handoff` in dispatching commands) that scopes the run without bypassing preconditions, Red, or checkpoints:

- `/project:init` — check wiring and role models, interview, scaffold `docs/wiki/`, bootstrap runnable test/architecture checks and CI, fill `CLAUDE.md`.
- `/project:interview` — one-question-at-a-time Q&A with recommendations; streams transcript to `docs/raw/interviews/`, then updates `docs/wiki/`.
- `/project:work` — top todo (or batch) → `feat/<slug>` → `planner` (if `[complex]`/batched) → `plan-adversary` → `developer` (one Behavior case per dispatch, proven focused Green + architecture + Red; full suite and push once the loop closes) → `adversary` (if `[complex]`/batched) → PR to `develop`.
- `/project:adversary` — read-only diff review (`adversary`, optional `triage`) with committed dispositions.
- `/project:review` — periodic whole-repo audit (`reviewer`) every ~5 todos or before release; never inside `/project:work`.
- `/project:wiki` — with an argument, ingest a source (`researcher` if web, then `wiki-maintainer`); empty, run the wiki health pass (`wiki-maintainer`).
- `/project:sync-template` — pull generic `.claude/` updates from a template checkout into an adopting project.

## Roles

| Role | Model · effort | Mode & Write Scope | Purpose |
| --- | --- | --- | --- |
| `planner` | opus · high | `dontAsk` · `.handoff/<slug>-plan.md` | Stepwise test-driven plan for `[complex]` or batched todos. |
| `plan-adversary` | sonnet · high | `dontAsk` · read-only | Attacks the brief before any test exists. |
| `developer` | sonnet · medium | `acceptEdits` · case code, tests, entity/gotchas/decisions | Implements one Behavior case Red → Green → refactor → wiki. |
| `adversary` | opus · high | `dontAsk` · read-only | Hunts defects in a diff with zero author context. |
| `triage` | sonnet · high | `dontAsk` · read-only | Technical second opinion on findings; never decides. |
| `reviewer` | opus · high | `dontAsk` · read-only | Periodic whole-repo audit against `docs/wiki/`. |
| `wiki-maintainer` | sonnet · medium | `dontAsk` · `docs/wiki/` | Source ingest and periodic wiki health pass. |
| `researcher` | sonnet · medium | `dontAsk` · `docs/raw/research/` | Web research into one cited raw document. |

## Skills

Each lives at `.claude/skills/<name>/SKILL.md`.
- **Conductor:** `subagent-dispatch`, `dispatch-handoff`, `finding-disposition`, `feature-branching`, `pr-create`, `git-recovery`, `human-checkpoint`, `spec-writing`, `update-toolkit`.
- **Preloaded:** `subagent-contract` (all), `plan-writing` (`planner`), `plan-review` (`plan-adversary`), `tdd-loop`, `simplicity-ladder`, `clean-architecture` (`developer`), `adversarial-review` (`adversary`), `wiki-update` (`wiki-maintainer`).
- **On-demand (`developer` via `Skill`, or conductor):** `gotcha-recording`, `decision-recording`, `design-system-check` (preloaded into `developer` on UI projects).

## Wiki map

- `docs/raw/` — append-only immutable sources (`interviews/`, `research/`).
- `docs/wiki/requirements.md`, `architecture.md`, `commands.md`, `git-conventions.md` (`+ design-system.md` on UI projects) — core specs.
- `docs/wiki/entities/` (feature Behavior specs), `concepts/` (shared patterns and `[infra]` Behavior specs), `decisions/` (ADRs), `summaries/` (source digests), `reviews/` (audit reports).
- `docs/wiki/todos.md`, `gotchas.md`, `log.md`, `wiki-todos.md` — work queue, traps, timeline, maintainer inbox.
