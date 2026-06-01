---
name: gotchas
description: Project-specific failure modes future agents must avoid. Use the gotcha-recording skill to append.
type: wiki-spec
updated: 2026-05-11
status: draft
---

# Gotchas

> Project-specific traps. Generic discipline issues live in `.claude/rules/behavioral.md`. Use the `gotcha-recording` skill to append entries — keep the When/Symptom/Cause/Fix format.

## Critical
*(Severe — data corruption, security, silent breakage. Read first.)*

*(None yet.)*

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
