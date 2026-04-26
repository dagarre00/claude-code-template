---
name: git-conventions
description: Git workflow conventions for this project. Use this skill whenever creating branches, writing commit messages, preparing PRs, or doing any git operation. Trigger on "commit", "branch", "merge", "PR", "pull request", "push", "git".
type: skill
---

# Git Conventions

The full git workflow lives in **[`docs/wiki/architecture.md`](../../../docs/wiki/architecture.md)** under `## Git Workflow`. Read that section first.

## Quick reference (defaults)

- **Branches**: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`. Never on `main`/`master`.
- **Reviewer branch**: `review/YYYY-MM-DD` (only the reviewer agent uses this).
- **Conventional commits**: `feat | fix | chore | docs | test | refactor | perf | ci`.
- **Format**: `<type>(<scope>): <description>` — imperative, no period, <72 chars.
- **One logical change per commit.**

## TDD interaction

- The `feat/*` and `fix/*` branches are **TDD-enforced** by the `test-first-check.sh` hook: code edits under `src/|app/|lib/|...` are blocked unless a matching test file exists.
- A `feat` commit should include both the test addition and the implementation, OR be preceded by a `test:` commit on the same branch. Pure-implementation commits with no test changes are not acceptable.

## Forbidden

- Force-push to shared branches.
- Commit directly to `main`/`master`.
- Rewrite history on pushed branches.
- Commit secrets, keys, or credentials.

For commit message generation and pre-commit checks, use the `commit` skill. For PR creation, use the `pr-create` skill.
