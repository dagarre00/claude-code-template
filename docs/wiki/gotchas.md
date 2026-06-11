---
name: gotchas
description: Project-specific failure modes future agents must avoid. Use the gotcha-recording skill to append.
type: wiki-spec
updated: 2026-06-11
status: draft
---

# Gotchas

> Project-specific traps. Generic discipline issues live in `.claude/rules/behavioral.md`. Use the `gotcha-recording` skill to append entries — keep the When/Symptom/Cause/Fix format.

## Critical
*(Severe — data corruption, security, silent breakage. Read first.)*

### Skills are only discovered as `.claude/skills/<name>/SKILL.md`
**When:** Adding or moving a skill (via `update-skill` or by hand).
**Symptom:** The skill never auto-loads and never appears in the harness's skill list. No error, no warning — agents just improvise the procedure the skill was supposed to provide.
**Cause:** Claude Code discovers skills only as first-level directories under `.claude/skills/` containing a `SKILL.md` entrypoint. Flat files (`.claude/skills/<name>.md`) and grouping subfolders (`.claude/skills/meta/<name>/SKILL.md`) are silently ignored. This template shipped all 15 skills as flat files until 2026-06-11 — none of them ever loaded.
**Fix:** One directory per skill: `.claude/skills/<name>/SKILL.md`. After adding one, confirm the skill shows up in the session's available-skills list before relying on it.
**Related:** [[decisions/2026-06-11-conform-schema-to-harness-formats]]

## Runtime
*(Things that go wrong while the code runs.)*

*(None yet.)*

## Testing
*(Test framework, fixtures, isolation, flake.)*

*(None yet.)*

## Tooling
*(Build, lint, formatter, IDE, env quirks.)*

### Hooks degrade silently when Python is absent
**When:** Python is not on PATH when a PreToolUse or PostToolUse hook fires.
**Symptom (input parsing):** `test-first-check` parses stdin JSON to extract `file_path`. Without Python it falls back to grep+sed, which handles simple flat JSON but may misparse deeply nested or escaped payloads — the hook exits 0 but may not warn when it should.
**Symptom (output / additionalContext):** `test-first-check` and `wiki-drift-check` emit `hookSpecificOutput.additionalContext` via Python for robust JSON escaping. Without Python the hooks fall back to `echo "$msg" >&2` — the reminder appears on stderr for any human watching the transcript, but is **not** injected into the model's context. The agent will not see the nudge; only a human reviewing the transcript will.
**Cause:** `jq` is not guaranteed on all dev machines (especially Windows). Python is more common and handles both robust JSON input parsing and safe output encoding; the fallbacks are best-effort.
**Fix:** Install Python 3.x and ensure it's on PATH. The hooks self-detect and prefer python3 → python → fallback.
**Related:** [[architecture]], [[entities/hooks]]
