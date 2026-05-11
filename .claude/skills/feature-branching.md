---
name: feature-branching
description: Branch and commit conventions for this project. Use whenever starting work on a todo, batching todos, or finishing a feature. Trigger on "branch", "feat/", "fix/", "merge", "PR", "pull request", "conventional commit".
type: skill
---

# Branching and Commits

Always branch before code. Never commit to `main`.

## Read first

- `docs/wiki/git-conventions.md` — the canonical conventions for this project (branch prefixes, commit format, PR template).
- `docs/wiki/todos.md` — what you're branching for.

## Starting work

1. Confirm clean tree:
   ```bash
   git status --porcelain
   ```
   If dirty: stop and run `human-checkpoint` — don't try to be clever with stashing.

2. Sync main:
   ```bash
   git checkout main && git pull --ff-only
   ```

3. Branch name: `<type>/<short-slug>` where `<type>` ∈ `feat`, `fix`, `chore`, `docs`, `refactor`, `test`.
   - `feat/auth-login`
   - `fix/race-on-double-submit`
   - `chore/upgrade-pytest`
   - `feat/profile` (when batching multiple todos under one feature)

   ```bash
   git checkout -b feat/<slug>
   ```

4. The `test-first-check` hook activates on `feat/*` and `fix/*` branches.

## Batching todos

Two todos can share a branch when:
- They touch the same entity page.
- The second todo depends on the first.
- Splitting them produces a meaningless intermediate commit.

If you're unsure, **don't batch** — separate branches are easier to revert.

## Commit messages

Conventional commits, present tense:

```
<type>(<scope>): <one-line summary>

<optional body — what changed and why, not how>

<optional footer — refs to wiki pages, breaking changes>
```

Types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `style`.

Scope is the entity slug or affected area: `feat(auth-login): …`.

## Commit cadence

- One commit per green TDD cycle (test + impl + entity-page update).
- Refactor commits are separate from feat commits.
- Don't commit half-green code. If you stop work mid-cycle, `/checkpoint` and leave the working tree.

## Finishing the feature

1. Final test run — full suite, not just the touched tests.
2. Entity page reflects current state; Behavior cases ticked.
3. TODO moved from `docs/wiki/todos.md` to `docs/wiki/completed.md`.
4. Push: `git push -u origin <branch>`.
5. Open a PR using the project's PR template (`pr-create` skill if it exists).
6. After merge: delete the branch locally and on remote.

## Anti-patterns

- **Committing to main.** Forbidden. If you find yourself on main with changes, branch first, then commit.
- **`--no-verify` to skip hooks.** Hooks exist for a reason. If a hook blocks you, fix the underlying issue.
- **`git commit -a`.** Stage explicitly so you don't accidentally commit unrelated files.
- **Squashing locally to hide multiple Red-Green cycles.** The history is the trace of the TDD loop — preserve it.
