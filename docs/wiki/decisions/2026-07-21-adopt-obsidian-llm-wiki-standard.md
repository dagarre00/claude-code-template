---
aliases: [Obsidian LLM-wiki standard adoption, LLM-wiki compiler standard]
type: decision
domains: [knowledge, software]
status: accepted
sources:
  - docs/raw/llm-wiki-obsidian-standard.md
supersedes: []
superseded_by: []
contradicts: []
open_questions: []
created: 2026-07-21
updated: 2026-07-21
---

# Adopt the Obsidian LLM-wiki standard for docs/wiki

> [!abstract] Essence
> The wiki methodology is replaced by the Obsidian-tuned LLM-wiki compiler standard: identity-by-filename with `aliases` dedup, flat frontmatter with closed facet vocabularies, a fixed link ontology whose expected links make gaps computable, disclosure-spine page bodies with per-claim provenance, and a maintenance contract of placement → merge/split → reconciliation → batched human questions.

## Status

Accepted as of 2026-07-21.

## Context

The human supplied a compiler/librarian standard for LLM-maintained Obsidian wikis (`docs/raw/llm-wiki-obsidian-standard.md`) and asked that the wiki methodology be updated to it. The previous methodology used harness-style frontmatter (`name`/`description`/`type: wiki-*`) on wiki pages, an open status vocabulary, prose-only relations, and intuition-driven lint. The standard's guiding principle: **a structural field is only justified if it makes a gap or a conflict computable.**

## Decision

We adopt the standard for all `docs/wiki/` pages: filename = identity (no `name`/`id`; `aliases` for dedup, illegal filename characters excluded), flat frontmatter with plural special keys, wikilinks in properties quoted and solitary, closed facets (`type`/`abstraction`/`domains`/`status`), the fixed link ontology (`implements`, `specializes`, `contrasts_with`, `alternative_to`, `depends_on`, `contradicts`), disclosure-spine bodies (Essence → Model → Detail → Boundaries → Provenance), computable gap/contradiction detection in `/project:wiki-lint`, and the placement/merge/split/escalation maintenance contract. Adaptations for this repo:

- **English vocabulary.** The source document is Spanish; the repo is English. Facet values and relation names are translated 1:1 (`concepto`→`concept`, `implementa`→`implements`, `contrasta_con`→`contrasts_with`, …). Semantics unchanged.
- **Project roles extend `type`.** `entity`, `decision`, `summary` join `concept | procedure | reference | tutorial` — they carry this project's spec/ADR/ingest machinery.
- **Entity pages keep the Behavior/TDD machinery** (Behavior cases, `[ ]`/`[~]`/`[x]`, Tests mapping) mapped onto the disclosure spine: Essence → Behavior (the model) → Implementation/Tests (the detail) → Boundaries → Provenance.
- **Decisions keep their lifecycle status** (`proposed | accepted | superseded | deprecated`) as a per-type exception to `stub | developing | stable`, plus `supersedes`/`superseded_by` relations (they make a dangling supersession computable).
- **Operational ledgers** (`log.md`, `todos.md`, `wiki-todos.md`, `gotchas.md`, `commands.md`) are `type: reference` and keep their working body formats; frontmatter hard rules still apply.
- **`.claude/` schema files are out of scope** — they keep `name`/`description`/`type` because the Claude Code harness routes on them.

## Consequences

- **Positive:** dedup via `aliases`, gaps and contradictions become queries (Bases/Dataview) instead of intuition; provenance is enforced per claim; the graph stays connected by construction.
- **Negative:** every pre-existing wiki page is now out of standard until migrated; two frontmatter regimes coexist (`.claude/` vs `docs/wiki/`).
- **Follow-ups:** migration of legacy pages queued in [[wiki-todos]] for `/project:wiki-lint` (migration procedure: `wiki-update` skill / §9 of the raw source).

## Alternatives considered

- **Adopt verbatim in Spanish:** rejected — a bilingual vocabulary would split the closed facets and break query consistency in an English repo. Translation is 1:1 and recorded here.
- **Replace the entity Behavior machinery with the pure concept template:** rejected — Behavior cases are the TDD spec source (`spec-writing`, `tdd-loop`, `/project:work` depend on them); the standard's disclosure spine absorbs them without loss.
- **Keep the old frontmatter and only add the link ontology:** rejected — `name:` duplicates filename identity and open vocabularies make the gap rules uncomputable, defeating the standard's core principle.

## References

- Relates to: [[summaries/llm-wiki-obsidian-standard]], [[wiki-todos]]
- Procedure carrier: `.claude/skills/wiki-update/SKILL.md`; hard rules: `.claude/rules/behavioral.md` #18
