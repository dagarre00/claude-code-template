---
aliases: [Branching conventions, Commit conventions]
type: reference
domains: [software, git]
status: stable
sources: []
contradicts: []
open_questions: []
created: 2026-05-11
updated: 2026-09-23
---

# Git Conventions

> [!abstract] Essence
> The naming and format vocabulary this project commits by. *When* to branch, and which command branches, is procedure: the [feature-branching skill](../../.agents/skills/feature-branching/SKILL.md).

`develop` is the integration branch and `main` the release branch. Code branches from `develop` and merges by PR; living documentation commits directly (`.agents/rules.md` #19).

## Branch naming

`<type>/<short-slug>`, `<type>` ∈ `feat` (new capability), `fix`, `chore` (tooling, deps, CI), `docs`, `refactor` (no behavior change), `test`, `perf`. The slug is kebab-case, at most four words, and equals the entity slug when there is one: `feat/auth-login`, `fix/race-on-double-submit`, `chore/upgrade-pytest`.

## Commit format

Conventional commits, present tense:

```
<type>(<scope>): <one-line summary>

<optional body — what and why, not how>

<optional footer — wiki refs, breaking changes, a Wiki-Update: none (<reason>) waiver>
```

`type` from the branch vocabulary; `scope` the entity slug or area; subject ≤ 72 characters with no trailing period; body wrapped at 72.

## Cadence

- **One commit per Behavior case** — its test, minimal implementation and entity-page tick, committed and pushed before the next case starts. The developer runs no git; the **conductor** commits each case. A commit spanning several cases is a defect: it breaks `git bisect`, makes a case unrevertable, and bloats the review diff past converging.
- Refactor commits are separate from feature commits. No half-green commits.
- Adversary findings are filed by default; an approved fix is its own `fix(<slug>): … — adversary F<N>` commit, and each round closes with `docs(<slug>): adversary round N` listing every disposition (`git log --grep="adversary round"`; protocol: the `finding-disposition` skill).
- **Push after every commit** (`git push -u origin <branch>`) — an unpushed commit is lost when the container recycles. No remote (`git remote get-url origin` fails) → every push is skipped and noted in the report.

## PRs

- From `<type>/<slug>` to `develop`, opened by `/project:work` (`pr-create` skill) once every Behavior case is `[x]`. Title mirrors the lead commit; the body cites the entity page and its cases.
- **Merge commit, not squash** (`gh pr merge --merge --delete-branch`): the Red → Green → Refactor sequence is the evidence the loop ran. Squash only a branch with no TDD trace — a typo fix, a revert, all-`wip:` history.
- Delete the branch on merge, locally and remotely. Merging is always the human's call.

## Force-push policy

Routine sync is `git merge origin/develop`, never a rebase of pushed history — sessions share branches. `--force-with-lease` only with explicit human approval; bare `--force` never; `develop` and `main` never.

## Tags

- `checkpoint-<UTC-timestamp>` — `git tag checkpoint-$(date -u +%Y%m%dT%H%M%SZ)` before a risky operation, so `git reset --hard` can return to it.
- Release tags: format to be defined.

Conflicts, stash, cherry-pick, bisect and recovery: the [git-recovery skill](../../.agents/skills/git-recovery/SKILL.md).
