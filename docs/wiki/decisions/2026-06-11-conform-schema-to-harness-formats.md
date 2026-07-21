---
name: 2026-06-11-conform-schema-to-harness-formats
description: Restructure skills to the directory/SKILL.md layout Claude Code actually discovers.
type: wiki-decision
updated: 2026-06-11
status: approved
---

# Conform the schema to the harness's real formats

## Context

A piece of the schema was written against an imagined harness contract, not the real one, and failed **silently**:

**Skills were flat files** (`.claude/skills/tdd-loop.md`, meta skills under `.claude/skills/meta/`). Claude Code only discovers skills laid out as `.claude/skills/<name>/SKILL.md` — first-level directories with a `SKILL.md` entrypoint. Flat files and grouping subfolders are ignored without any error. Net effect: **none of the 15 skills ever auto-loaded.** The whole progressive-disclosure premise (agents load procedures on demand via skill `description` matching) was inert; agents only ever saw skill *names* mentioned in prose and improvised the procedures.

## Decision

- Move every skill to `.claude/skills/<name>/SKILL.md`. Flatten the `meta/` grouping — the meta skills become first-level skill directories like any other (nested grouping folders are not discovered).
- Encode the contract where future agents will trip over it: the `update-skill` skill now states the directory layout requirement; [[gotchas]] carries the skill-discovery trap.

## Consequences

- All 15 skills now appear in the harness's skill list and auto-load on `description` match — verified live in the session that made this change.
- The "Don't pre-organize folders until there are 8+ skills" guidance in `update-skill` is gone: layout is dictated by the harness, not taste.
- Any fork of this template that added flat skill files must migrate them the same way.

## Alternatives considered

- **Keep `meta/` as a grouping folder with SKILL.md inside.** Rejected: only first-level directories under `.claude/skills/` are discovered; the meta skills would have stayed invisible.
