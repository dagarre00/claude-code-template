---
name: spec-writing
description: How to write entity Behavior cases that produce good tests. Use when adding an entity page, refining behavior during /project:interview, or splitting a vague case into testable ones. Trigger on "behavior cases", "spec", "entity behavior", "acceptance criteria", "what does this entity do".
type: skill
---

# Writing Behavior Cases

Behavior cases on an entity page are the spec, and each one becomes a failing test. A vague case makes a vague test and vague code.

## Read first

- `docs/wiki/requirements.md` — the cases must serve a requirement.
- `docs/wiki/architecture.md` — the testing strategy sets the granularity (unit vs integration).
- Existing entity pages in the same domain — match their phrasing.

## Shape

```
- [ ] B<N>: When <condition>, <subject> <observable outcome>.
```

Good:

- `- [ ] B1: When a user submits valid credentials, the server responds 200 and sets the session cookie.`
- `- [ ] B2: When a user submits an unknown email, the server responds 401 and sets no session cookie.`
- `- [ ] B3: When an IP has 5 failed logins in the last 60 seconds, the next attempt gets 429.`

Bad: `Logins work correctly.` (untestable) · `The login function validates inputs, hashes the password, looks up the user and returns a session.` (four cases) · `The login flow is fast.` (no threshold).

## Rules

1. **One observable behavior per case.** An "and" or an "or" in the outcome, or a test needing two assertion groups → split it.
2. **When/Then.** Name the trigger and the outcome.
3. **No implementation language.** "Calls `validate_email()`" is how, not what — a case is what an external caller observes.
4. **Measurable.** "Should be fast" → "completes in <200ms for ≤1KB input".
5. **One layer.** A case at the HTTP boundary is not the case for the function behind it.
6. **Explicit state.** "When the user is already logged in and submits the form, …".
7. **Errors are cases of their own**, never "(also handles errors)".
8. **Every case has a failing assertion.** If you can't write it, you don't have a case.

## States and numbering

`[ ]` defined, no test · `[~]` test written and confirmed failing · `[x]` passing, with the wiki updated in the same commit. Each transition happens once, and a case never moves backwards: changed behavior gets a new case (the next free `B<N>`), and the old one is struck through with a one-line pointer to its replacement — never edit a shipped `[x]` case in place.

Numbers are unique per page and never reused or renumbered: append new cases at the end (B7 stays B7 even after B3 is struck). Test names, commits and logs cite them.

## Tie cases to tests

```
## Tests
- B1 → `test_login_succeeds_with_valid_credentials`
- B2 → `test_login_fails_with_unknown_email`
```

A test name that no longer matches its case means the spec and the tests have drifted.

## After writing cases

Bump the entity's `updated:`, and update `docs/wiki/requirements.md` if a case exposes a missing requirement. The command that invoked you logs the change.
