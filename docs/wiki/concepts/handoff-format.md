---
name: handoff-format
description: Schema for the tester→implementer handoff JSON at .claude/handoff/<slug>.json.
type: wiki-concept
updated: 2026-05-16
status: approved
---

# Handoff Format

> The JSON contract the `tester` agent writes and the `implementer` agent reads. Enforces the Red-before-Green discipline that defines TDD in this project.

## Why it exists

The template's central rule is "no code without a failing test." Trusting agents to honor that across context windows is fragile. The handoff makes the contract physical: a JSON file the [[glossary#tester|tester]] writes after confirming Red, and the [[glossary#implementer|implementer]] reads before touching any production file.

The `test-first-check` hook (`.claude/hooks/test-first-check.sh`) reads `red_confirmed` from this file on every Write/Edit. If the file is missing or `red_confirmed` is not `true`, code edits on `feat/*` and `fix/*` branches are blocked.

See also: [[glossary#handoff-red_confirmed]], behavioral rule 15.

## Path

`.claude/handoff/<slug>.json`

Where `<slug>` is the branch slug — i.e. the branch name with the `feat/` or `fix/` prefix stripped. Example:

- Branch `feat/auth-login` → handoff at `.claude/handoff/auth-login.json`
- Branch `fix/token-refresh` → handoff at `.claude/handoff/token-refresh.json`

One handoff per branch. Multiple concurrent branches each have their own handoff.

## Schema

```json
{
  "slug": "auth-login",
  "branch": "feat/auth-login",
  "red_confirmed": true,
  "test_command": "pytest -q tests/test_auth_login.py",
  "failing_count": 3,
  "failing_tests": [
    "tests/test_auth_login.py::test_rejects_unknown_user",
    "tests/test_auth_login.py::test_rejects_wrong_password",
    "tests/test_auth_login.py::test_issues_token_on_success"
  ],
  "behavior_cases": [
    "auth-login#rejects-unknown-user",
    "auth-login#rejects-wrong-password",
    "auth-login#issues-token-on-success"
  ],
  "attempt": 1,
  "timestamp": "2026-05-16T20:51:00Z",
  "notes": ""
}
```

### Fields

| Field            | Type             | Purpose                                                                                                                    |
| ---------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `slug`           | string           | Entity slug; matches the branch slug and the entity page filename under `docs/wiki/entities/`.                             |
| `branch`         | string           | Full current `feat/*` or `fix/*` branch name.                                                                              |
| `red_confirmed`  | boolean          | Must be `true` for the implementer to start. The `test-first-check` hook keys off this exact field.                        |
| `test_command`   | string           | Exact command, copied verbatim from [[commands#test]]. The implementer reruns this to drive the Green loop.                |
| `failing_count`  | integer          | Number of currently failing tests. Sanity check against `failing_tests.length`.                                            |
| `failing_tests`  | array of strings | Test identifiers in the runner's native format (e.g. `path::test_name` for pytest, `file > describe > it` for jest).       |
| `behavior_cases` | array of strings | Case IDs from the entity page, in the form `<slug>#<case-anchor>`. Lets the implementer trace tests back to the spec.      |
| `attempt`        | integer          | 1 on the first Red. Incremented on each retry. The implementer applies the [[glossary#two-strike-rule]] at `attempt >= 2`. |
| `timestamp`      | string           | ISO-8601 UTC timestamp of when this handoff was written.                                                                   |
| `notes`          | string, optional | Free-form context. Required when `red_confirmed: false` to explain why (e.g. "tests passed unexpectedly — spec wrong").    |

## Lifecycle

1. **Tester creates and commits.** After writing the failing tests and running the suite, the tester writes the handoff with `red_confirmed: true` (or `false` with a `notes` explanation if Red didn't materialize), then commits it alongside the test files in a `test(<slug>): red phase` commit. Committing is mandatory — it is what lets the session resume after a rate limit or container recycle.
2. **Implementer reads.** First action: read `.claude/handoff/<slug>.json`. If missing or `red_confirmed !== true`, refuse to start and surface the issue.
3. **`/project:work` owns increments on retry.** When an implementation attempt fails and the loop restarts, `/project:work` increments `attempt` before re-dispatching the tester. The implementer checks `attempt` on read and triggers the two-strike pivot at `>= 2`.
4. **Implementer deletes on completion.** The implementer removes `.claude/handoff/<slug>.json` as part of its final commit. This keeps `main` clean after the branch merges — the file only ever lives on the `feat/*` or `fix/*` branch.

## Hook contract

`.claude/hooks/test-first-check.sh` runs as a `PreToolUse` hook on `Write` and `Edit`. It:

1. Exits 0 (allow) if the current branch is not `feat/*` or `fix/*`.
2. Exits 0 if the target file is a test, docs, config, or anything under `.claude/` / `.github/`.
3. Derives `slug` from the branch name and looks for `.claude/handoff/<slug>.json`.
4. Exits 0 if the handoff exists and parses with `red_confirmed === true`.
5. Otherwise exits 2 with a message instructing the assistant to dispatch the tester.

## Two-strike rule

See [[glossary#two-strike-rule]]. The handoff's `attempt` field is the canonical counter. On the second failed attempt:

- The implementer stops.
- Calls the `human-checkpoint` skill to surface the failure pattern.
- Recommends `/project:rollback` and a re-spec of the affected Behavior cases.

## Related

- [[glossary#handoff-red_confirmed]]
- [[glossary#two-strike-rule]]
- [[commands]]
- [[architecture]]
- `.claude/hooks/test-first-check.sh`
- `.claude/agents/tester.md`
- `.claude/agents/implementer.md`
