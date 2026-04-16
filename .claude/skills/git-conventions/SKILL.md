---
name: git-conventions
description: Git workflow conventions for this project. Use this skill whenever creating branches, writing commit messages, preparing PRs, or doing any git operation. Trigger on "commit", "branch", "merge", "PR", "pull request", "push", "git".
type: skill
---

# Git Conventions

## Branch Naming
- Features: `feat/<task-id>-<short-desc>` (e.g., `feat/T-012-add-user-auth`)
- Fixes: `fix/<task-id>-<short-desc>` (e.g., `fix/T-045-null-pointer-login`)
- Chores: `chore/<short-desc>` (e.g., `chore/update-dependencies`)
- Never work directly on `main` or `master`

## Commit Messages
Use conventional commits. Format: `<type>(<scope>): <description>`

Types:
- `feat` — new feature
- `fix` — bug fix
- `chore` — maintenance, dependencies
- `docs` — documentation only
- `test` — adding/updating tests
- `refactor` — code change that neither fixes a bug nor adds a feature
- `perf` — performance improvement
- `ci` — CI/CD changes

Examples:
- `feat(auth): add JWT refresh token rotation`
- `fix(api): handle null response from payment gateway`
- `test(users): add integration tests for registration flow`

## Commit Discipline
- One logical change per commit
- Commit after each completed subtask, not at the end
- Never commit broken code — run tests first
- Never commit secrets, keys, or credentials

## Pull Request Guidelines
- Title matches the primary conventional commit type
- Description includes: what changed, why, how to test
- Link to the task ID or plan file
- Self-review before requesting human review

## Forbidden Operations
- Never `git push --force` to shared branches
- Never commit directly to main
- Never rewrite history on pushed branches
