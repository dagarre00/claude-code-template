---
name: spec-writing
description: How to write entity Behavior cases that produce good tests. Use when adding a new entity page, refining behavior during /interview, or splitting a vague case into testable ones. Trigger on "behavior cases", "spec", "entity behavior", "acceptance criteria", "what does this entity do".
type: skill
---

# Writing Behavior Cases

Behavior cases on an entity page are the spec. The `tester` agent translates them directly into failing tests. If your case is vague, your test is vague, your code is vague. Sharp cases → sharp tests → narrow code.

## Read first

- `docs/wiki/requirements.md` — what the project is meant to do; cases must support requirements.
- `docs/wiki/architecture.md` — testing strategy decides granularity (unit vs integration).
- Existing entity pages for the same domain — match phrasing style.

## Shape of a Behavior case

Each case is **one observable behavior**. Not "the function does X and Y and Z" — three cases.

Template:

```
- [ ] B<N>: When <condition>, <subject> <observable outcome>.
```

Examples (good):

- `- [ ] B1: When a user submits a login form with valid credentials, the server responds 200 and sets the session cookie.`
- `- [ ] B2: When a user submits a login form with an unknown email, the server responds 401 and does not set a session cookie.`
- `- [ ] B3: When a login attempt comes from an IP with 5 failures in the last 60 seconds, the server responds 429.`

Examples (bad):

- `- [ ] B1: Logins work correctly.`  (untestable — what does "correctly" mean?)
- `- [ ] B2: The login function validates inputs, hashes the password, looks up the user, and returns a session.`  (four cases stuffed into one)
- `- [ ] B3: The login flow is fast.`  (no observable threshold)

## Rules

1. **One observable behavior per case.** If you say "and", split.
2. **Phrased as When/Then.** Forces you to name the trigger and the outcome.
3. **No implementation language.** "Calls `validate_email()`" is wrong — that's how, not what.
4. **No "should" without a measurable check.** "Should be fast" → "completes in <200ms for ≤1KB input".
5. **One layer.** A case for the HTTP boundary is different from a case for the function it calls. Don't mix.
6. **State machines explicit.** If the behavior depends on prior state, say so: "When the user is already logged in and submits a login form, …".
7. **Errors are first-class.** Every input space has error cases. List them as their own cases, not as "(also handles errors)".

## Numbering

`B1`, `B2`, … unique within the entity page. Don't renumber when inserting — append new cases at the end (B7 stays B7 even if you delete B3). The number is referenced by test names, commits, and logs.

## Splitting a case

Smell tests:
- The word "and" in the outcome.
- Multiple input conditions joined with "or".
- A case where the test would need two assertion groups.

If any of these is true, split.

## Tying cases to tests

In the entity page's `## Tests` section, map cases to test names explicitly:

```
## Tests
- B1 → `test_login_succeeds_with_valid_credentials`
- B2 → `test_login_fails_with_unknown_email`
- B3 → `test_login_rate_limits_after_5_failures`
```

The `tester` agent uses this mapping to know what to write.

## After writing cases

- Update the entity's `updated:` frontmatter to today.
- If you reshaped behavior, append a one-liner to `docs/wiki/log.md` noting the change.
- If a case implies a missing requirement, update `docs/wiki/requirements.md`.

## Anti-patterns

- **Cases that describe implementation.** Behavior is what an external caller observes.
- **Cases without a failing assertion.** If you can't write the assertion, you don't have a case.
- **Renumbering.** Keep numbers stable; insertions go at the end.
- **Test names that don't match cases.** Means the spec and the tests have drifted.
