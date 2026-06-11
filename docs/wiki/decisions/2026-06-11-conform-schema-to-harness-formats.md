---
name: 2026-06-11-conform-schema-to-harness-formats
description: Restructure skills to the directory/SKILL.md layout Claude Code actually discovers, and fix hook timeouts to the seconds unit the harness actually reads.
type: wiki-decision
updated: 2026-06-11
status: approved
---

# Conform the schema to the harness's real formats

## Context

Two pieces of the schema were written against an imagined harness contract, not the real one, and both failed **silently**:

1. **Skills were flat files** (`.claude/skills/tdd-loop.md`, meta skills under `.claude/skills/meta/`). Claude Code only discovers skills laid out as `.claude/skills/<name>/SKILL.md` — first-level directories with a `SKILL.md` entrypoint. Flat files and grouping subfolders are ignored without any error. Net effect: **none of the 15 skills ever auto-loaded.** The whole progressive-disclosure premise (agents load procedures on demand via skill `description` matching) was inert; agents only ever saw skill *names* mentioned in prose and improvised the procedures.
2. **Hook `timeout` values were written as milliseconds** (`10000`, `30000`) but the harness reads the field as **seconds** (default 600). The intended 10s/30s guards were actually ~2.8h/8.3h — i.e. no guard at all. The `timeout 25` wrapper inside `auto-format.sh` was the only real backstop.

## Decision

- Move every skill to `.claude/skills/<name>/SKILL.md`. Flatten the `meta/` grouping — `update-agent`, `update-command`, `update-hook`, `update-skill` become first-level skill directories like any other (nested grouping folders are not discovered).
- Set hook timeouts in seconds: `10` for the check hooks, `30` for `auto-format` (matching its internal `timeout 25` wrapper).
- Encode both contracts where future agents will trip over them: the `update-skill` skill now states the directory layout requirement; the `update-hook` skill now states the seconds unit; [[gotchas]] carries the skill-discovery trap; [[entities/hooks]] notes the timeout unit.

## Consequences

- All 15 skills now appear in the harness's skill list and auto-load on `description` match — verified live in the session that made this change.
- The "Don't pre-organize folders until there are 8+ skills" guidance in `update-skill` is gone: layout is dictated by the harness, not taste.
- Wedged hooks are now actually killed at 10s/30s instead of hanging the session.
- Any fork of this template that added flat skill files must migrate them the same way.

## Alternatives considered

- **Keep `meta/` as a grouping folder with SKILL.md inside.** Rejected: only first-level directories under `.claude/skills/` are discovered; the meta skills would have stayed invisible.
- **Leave timeouts at 10000/30000.** Rejected: values were valid JSON but meant hours, contradicting the comments and intent everywhere they were referenced.
