---
name: spec-writing
description: Conductor-only. How to write entity Behavior cases that produce good tests — When/Then shape, granularity, state transitions, and test mapping. Use when adding an entity page, refining behavior during /project:interview, or splitting a vague case.
user-invocable: false
---

# Writing Behavior Cases

Behavior cases on an entity page (or `[infra]` concept page) are the executable spec; each becomes a failing test.

## Read first

- `docs/wiki/requirements.md` — cases must serve a requirement.
- `docs/wiki/architecture.md` — testing strategy sets granularity (unit vs integration).
- Existing entity pages in the same domain to match phrasing.

## Shape

```markdown
- [ ] B<N>: When <condition>, <subject> <observable outcome>.
```

Good:
- `- [ ] B1: When a user submits valid credentials, the server responds 200 and sets the session cookie.`
- `- [ ] B2: When a user submits an unknown email, the server responds 401 and sets no session cookie.`
- `- [ ] B3: When an IP has 5 failed logins in the last 60 seconds, the next attempt gets 429.`

Bad: `Logins work correctly.` (untestable) · `Validates inputs, hashes password, looks up user, and returns session.` (four cases) · `Login is fast.` (unmeasurable).

## Rules

1. **One observable behavior per case.** Split any "and"/"or" outcome needing multiple assertion groups.
2. **When/Then** trigger and outcome.
3. **No implementation details** ("calls `validate_email()`" is how, not what an external caller observes).
4. **Measurable** ("completes in <200ms for ≤1KB input", not "fast").
5. **Single layer** (HTTP boundary vs domain function).
6. **Explicit state** ("When the user is already logged in and submits the form, …").
7. **Errors are separate cases**, never "(also handles errors)".
8. **Falsifiable:** Every case must imply a specific failing assertion.

## States and numbering

- `[ ]` defined, no test · `[~]` test written and confirmed failing · `[x]` passing (updated in the same commit).
- Cases never move backwards: when behavior changes, strike through the `[x]` case with a pointer to a newly appended `B<N>` (never reuse or renumber IDs).

## Tie cases to tests

```markdown
## Tests
- B1 → `test_login_succeeds_with_valid_credentials`
- B2 → `test_login_fails_with_unknown_email`
```

## After writing cases

Bump the page's `updated:` date, and update `docs/wiki/requirements.md` if a case reveals a missing requirement.
