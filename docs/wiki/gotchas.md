---
aliases: [Failure modes, Traps]
type: reference
domains: [software]
status: stable
sources: []
contradicts: []
open_questions: []
created: 2026-04-15
updated: 2026-07-21
---

# Gotchas

> [!abstract] Essence
> Project-specific traps future agents must avoid. Generic discipline issues live in `.claude/rules/behavioral.md`. Use the `gotcha-recording` skill to append entries — keep the When/Symptom/Cause/Fix format.

## Critical
*(Severe — data corruption, security, silent breakage. Read first.)*

### Skills are only discovered as `.claude/skills/<name>/SKILL.md`
**When:** Adding or moving a skill (via `update-toolkit` or by hand).
**Symptom:** The skill never auto-loads and never appears in the harness's skill list. No error, no warning — agents just improvise the procedure the skill was supposed to provide.
**Cause:** Claude Code discovers skills only as first-level directories under `.claude/skills/` containing a `SKILL.md` entrypoint. Flat files (`.claude/skills/<name>.md`) and grouping subfolders (`.claude/skills/meta/<name>/SKILL.md`) are silently ignored — no error is raised.
**Fix:** One directory per skill: `.claude/skills/<name>/SKILL.md`. After adding one, confirm the skill shows up in the session's available-skills list before relying on it.

## Runtime
*(Things that go wrong while the code runs.)*

*(None yet.)*

## Testing
*(Test framework, fixtures, isolation, flake.)*

*(None yet.)*

## Tooling
*(Build, lint, formatter, IDE, env quirks.)*

*(None yet.)*
