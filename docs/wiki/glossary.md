---
name: glossary
description: Project vocabulary. Defines domain terms so the agent and humans don't drift on what words mean.
type: wiki-spec
updated: 2026-05-16
status: draft
---

# Glossary

> Terms specific to this project. The first time a new domain word lands in any wiki page, add it here. Link to entries with `[[glossary#term]]`. Keep definitions short — one or two sentences. Promote a term to its own `[[concepts/<slug>]]` page when it accumulates more than a paragraph of nuance.

## Format

```
### term
**Definition:** what it means.
**Context:** where this term shows up (which entities, which docs).
**Aliases:** other names this might go by (especially during interviews).
```

## Terms

### Behavior case

**Definition:** A single testable assertion on an entity page, written before any test. The `[ ]` / `[~]` / `[x]` prefix tracks status (pending / in-progress / done).
**Context:** Lives on every `docs/wiki/entities/<slug>.md` under `## Behavior`. Drives test generation.
**Aliases:** behavior, spec case, acceptance case.

### entity (page)

**Definition:** A file under `docs/wiki/entities/` documenting one feature, module, or component. Owns the `## Behavior` cases that produce tests.
**Context:** Created by `/interview` or `/work`. See [[architecture]] for how entities relate to code modules.
**Aliases:** entity page, feature page.

### handoff (red_confirmed)

**Definition:** The JSON file at `.claude/handoff/<slug>.json` the tester writes after confirming Red. The implementer refuses to start without it.
**Context:** Enforced by the `test-first-check` hook. Schema lives at [[concepts/handoff-format]].
**Aliases:** red handoff, tester handoff.

### implementer

**Definition:** The agent that writes production code to make failing tests pass. Reads the handoff first; loads task-specific skills on demand.
**Context:** Defined at `.claude/agents/implementer.md`. Invoked by `/work` after the tester confirms Red.
**Aliases:** implementer agent, Green-phase agent.

### tester

**Definition:** The agent that translates Behavior cases into failing tests and writes the [[glossary#handoff-red_confirmed|handoff]].
**Context:** Defined at `.claude/agents/tester.md`. Invoked by `/work` during the Red phase.
**Aliases:** tester agent, Red-phase agent.

### planner

**Definition:** The Opus-model agent that decomposes complex or batched todos into a stepwise implementation plan before TDD begins. Writes a transient markdown plan to `.claude/handoff/<slug>-plan.md` that the tester and implementer follow.
**Context:** Defined at `.claude/agents/planner.md`. Dispatched by `/work` when a todo is tagged `[complex]` or 2+ todos are batched. Also invokable directly via `/plan` for estimation. The lone Opus agent in the template. Procedural details live in the [[glossary#plan-writing|plan-writing]] skill.
**Aliases:** planner agent, plan author.

### plan-writing

**Definition:** The skill that defines the markdown plan template (Goal / Behavior cases / Approach / Steps / Files / Risks / Out of scope / Test command) the planner produces.
**Context:** Lives at `.claude/skills/plan-writing.md`. Loaded by the planner agent; also triggers when a human asks for "a plan", "decomposition", or "implementation strategy".
**Aliases:** plan skill, plan template.

### reviewer

**Definition:** The periodic auditor. Runs in a fresh git worktree with no implementer context to keep the audit unbiased.
**Context:** Defined at `.claude/agents/reviewer.md`. Triggered by `/review` roughly every 5 todos — never inside `/work`.
**Aliases:** reviewer agent, audit agent.

### wiki-maintainer

**Definition:** The agent that processes [[wiki-todos]], fixes orphans, files ADRs, and cross-links concepts. **Manual only** — never auto-invoked.
**Context:** Triggered by `/wiki-lint` or an explicit human request. Owns large or cross-page wiki edits.
**Aliases:** wiki agent, maintainer.

### progressive disclosure

**Definition:** The template's central pattern — one general-purpose implementer loads task-specific skills on demand rather than maintaining domain-specialized agents.
**Context:** See `CLAUDE.md` operating principles. Skills auto-load when their `description` matches the task.
**Aliases:** lazy context loading, on-demand skills.

### two-strike rule

**Definition:** Two failed attempts on the same mechanism → stop, `/rollback`, re-spec. Tracked via the `attempt` field in the handoff JSON.
**Context:** See [[concepts/handoff-format]]. Enforced socially by the implementer when `attempt >= 2`.
**Aliases:** two-strike pivot.

### wiki-todos.md

**Definition:** A queue of deferred wiki-cleanup tasks — orphans, missing cross-links, repeated concepts. Agents append; `wiki-maintainer` drains on `/wiki-lint`.
**Context:** Lives at `docs/wiki/wiki-todos.md`. Behavioral rule 16 mandates append-on-discovery.
**Aliases:** maintainer queue, wiki cleanup queue.

### ADR (Architecture Decision Record)

**Definition:** A page in `docs/wiki/decisions/` capturing a non-obvious design call: context, decision, consequences.
**Context:** Filed via the `decision-recording` skill. Linked from affected entity and concept pages.
**Aliases:** decision record, design decision.

### raw source

**Definition:** A file under `docs/raw/` (interview transcripts, articles, PDFs). Immutable — agents read but never edit; only append new files.
**Context:** Behavioral rule 11. Summarized into `docs/wiki/summaries/` by `/wiki-ingest`.
**Aliases:** raw doc, source drop.

### checkpoint

**Definition:** A git tag `checkpoint-<timestamp>` made before a risky operation, used as a `/rollback` target.
**Context:** Created by `/checkpoint`; listed and reverted to by `/rollback`.
**Aliases:** rollback tag, safety tag.

## Related

- [[requirements]]
- [[architecture]]
- [[concepts/handoff-format]]
