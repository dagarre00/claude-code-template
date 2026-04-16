---
name: commit
description: Smart commit workflow. Use when the user says "commit", "save my work", "checkpoint my changes", or after completing a logical unit of work. Stages, validates, and commits with a proper conventional commit message.
type: skill
---

# Smart Commit

## Workflow:
1. Run `git status` to see what changed
2. Run `git diff --stat` for a summary of changes
3. Determine the appropriate conventional commit type from the changes:
   - New files/features → `feat`
   - Bug fixes → `fix`
   - Tests → `test`
   - Documentation → `docs`
   - Refactoring without behavior change → `refactor`
   - Dependencies/tooling → `chore`
4. Identify the scope from the primary directory or module affected
5. Write a concise description (imperative mood, no period, <72 chars)
6. Stage the relevant files (`git add` — prefer selective staging over `git add .`)
7. Run tests if a test command exists in `docs/wiki/commands.md`
8. Commit with the generated message

## Rules:
- Never commit if tests fail
- Never stage unrelated changes in the same commit
- Never commit secrets, `.env` files, or credentials
- If changes span multiple logical units, make multiple commits
- Show the proposed commit message to the user before committing

## Example output:
```
Changes detected:
  M src/auth/jwt-service.ts
  M src/auth/jwt-service.test.ts
  A src/auth/refresh-token.ts

Proposed commit: feat(auth): add JWT refresh token rotation

Proceed? (y/n)
```
