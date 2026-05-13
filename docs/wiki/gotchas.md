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

### Hooks use python for JSON parsing with a grep fallback
**When:** Python is not on PATH when a PreToolUse or PostToolUse hook fires.
**Symptom:** The `test-first-check` and `auto-format` hooks parse stdin JSON to extract `file_path`. If Python is absent, they fall back to grep+sed extraction. The fallback handles simple flat JSON; deeply nested or escaped payloads may parse incorrectly.
**Cause:** `jq` is not guaranteed on all dev machines (especially Windows). Python is more common and used for robust parsing; the grep fallback is a best-effort backup.
**Fix:** Install Python 3.x and ensure it's on PATH. The hooks self-detect and prefer Python when available.
**Related:** [[architecture]]
