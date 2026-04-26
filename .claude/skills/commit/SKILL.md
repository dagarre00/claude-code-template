---
name: commit
description: Smart commit workflow. Use when the user says "commit", "save my work", "checkpoint my changes", or after completing a logical unit of work. Stages, validates, and commits with a proper conventional commit message.
type: skill
---

# Smart Commit

## Workflow

1. Run `git status` to see what changed.
2. Run `git diff --stat` for a summary.
3. **TDD discipline check** — before staging anything:
   - Run `git diff --cached --name-only` and `git diff --name-only` together.
   - If the diff adds new functions/classes/exports under `src/|app/|lib/|pkg/|cmd/|internal/|server/|client/|web/|api/|packages/|apps/` AND no test file is added or modified in the same diff: **stop**. Either add the missing test or split the commit so the test addition lands first. Exception: pure refactors (`refactor:` type) that don't change behavior are allowed without new tests.
4. Determine the conventional commit type from the diff:
   - New behavior + new tests → `feat`
   - Bug fix + regression test → `fix`
   - Tests only → `test`
   - Documentation only → `docs`
   - Refactor without behavior change → `refactor`
   - Dependencies / tooling → `chore`
5. Identify the scope from the primary directory or module affected.
6. Write a concise description (imperative mood, no period, <72 chars).
7. Stage the relevant files (`git add` — prefer selective staging over `git add .`).
8. Invoke `superpowers:verification-before-completion` — run the full test suite, read the output, confirm 0 failures. Do not commit if tests fail.
9. Commit with the generated message.

## Rules

- Never commit if tests fail.
- Never commit new behavior without a corresponding test added or modified in the same diff (refactor commits are the only exception).
- Never stage unrelated changes in the same commit.
- Never commit secrets, `.env` files, or credentials.
- Show the proposed commit message to the user before committing.

## Example output

```
Changes detected:
  M src/auth/jwt-service.ts
  M src/auth/jwt-service.test.ts
  A src/auth/refresh-token.ts
  A src/auth/refresh-token.test.ts

TDD check: ✓ every code file has a matching test edit in this diff.

Proposed commit: feat(auth): add JWT refresh token rotation

Proceed? (y/n)
```
