---
aliases: [Branching conventions, Commit conventions]
type: reference
domains: [software, git]
status: stable
sources: []
contradicts: []
open_questions: []
created: 2026-05-11
updated: 2026-08-30
---

# Git Conventions

> [!abstract] Essence
> The naming and format **vocabulary** this project commits by. *When* to branch and which command branches at all is procedure, and lives in the [feature-branching skill](../../.agents/skills/feature-branching/SKILL.md) — this page does not restate it.

`develop` is the primary integration branch; `main` is the release branch. Code
branches from `develop` and merges via PR; living documentation commits directly.
The per-command table for that split is in the
[feature-branching skill](../../.agents/skills/feature-branching/SKILL.md), and the
rule behind it is `.agents/rules.md` #19.

## Branch naming

`<type>/<short-slug>`, where `<type>` ∈:

- `feat` — new capability
- `fix` — bug fix
- `chore` — tooling, deps, CI, non-functional housekeeping
- `docs` — documentation only
- `refactor` — code restructuring with no behavior change
- `test` — test-only additions
- `perf` — performance work

Slug: kebab-case, ≤ 4 words, matches the entity slug when applicable.

Examples: `feat/auth-login`, `fix/race-on-double-submit`, `chore/upgrade-pytest`.

## Commit format

Conventional commits, present tense:

```
<type>(<scope>): <one-line summary>

<optional body — what and why, not how>

<optional footer — refs to wiki pages, breaking changes>
```

- `type` matches the branch type vocabulary.
- `scope` is the entity slug or affected area.
- Subject ≤ 72 characters, no trailing period.
- Body wraps at 72.

## Cadence

- **One commit per Behavior case** — its test, its minimal implementation, and its entity-page tick, committed and pushed before the next case starts. The `developer` owns this; `/project:work` does not bundle a cycle's cases into one commit, and a commit spanning several cases is a defect (it breaks `git bisect`, makes a single case unrevertable, and inflates the adversarial-review diff past the point where it converges).
- Refactor commits are separate from feat commits.
- Adversary findings: filed by default; approved fixes are their own `fix(<slug>): … — adversary F<N>` commits, and each round closes with a `docs(<slug>): adversary round N` commit whose body lists every disposition — the record rule 20 requires, read back with `git log --grep="adversary round"`. Full protocol: `adversarial-review` skill.
- Don't commit half-green code.
- **Always push after committing** (`git push -u origin <branch>`). An unpushed commit is lost when the execution container recycles — see `.agents/rules.md` #19. Read-only commands (those that don't mutate tracked files) are the only exception.
- **No remote yet?** `git remote get-url origin` failing means every push step is skipped and noted in the report — this is the one no-remote rule; commands reference it instead of restating it.

## PRs

- Open from `<type>/<slug>` to `develop`.
- Opened automatically by `/project:work` (via the `pr-create` skill) once all Behavior cases for the cycle are `[x]`.
- Title mirrors the lead commit.
- Description references the entity page and the Behavior cases covered.
- **Merge commit on merge** (`gh pr merge --merge --delete-branch`), not squash. The Red→Green→Refactor commit sequence is the evidence that the loop was actually run — squashing erases it, and this schema already forbids squashing locally for the same reason ([feature-branching](../../.agents/skills/feature-branching/SKILL.md), Anti-patterns). Squash only a branch with no TDD trace to preserve: a typo fix, a revert, a branch whose history is all `wip:` noise.
- Delete the branch on merge, local and remote.
- Merging is always the human's call.

## Force-push policy

- Routine branch sync is **merge-based** (`git merge origin/develop`) — never a rebase of pushed history, because sessions run concurrently on shared branches.
- `--force-with-lease` is the only acceptable force-push, and only after explicit human approval via `human-checkpoint`. Bare `--force` is never used.
- Never force-push `develop` or `main`.

## Merge conflicts

Follow the [git-recovery skill](../../.agents/skills/git-recovery/SKILL.md) (Resolve merge / rebase / cherry-pick conflicts) when `git merge` or `git rebase` produces `CONFLICT (content)` markers. Key steps: resolve markers, grep for leftovers, run full tests, then `git add + git commit` (merge) or `git add + git rebase --continue` (rebase).

## Branch cleanup (after merge)

```bash
git checkout develop
git fetch origin develop && git merge --ff-only origin/develop
git branch -d feat/<slug>              # -d is safe: errors if unmerged
git push origin --delete feat/<slug>
```

## Advanced git operations

Stash, cherry-pick, bisect, blame, reflog recovery, and other edge-case operations are covered by the [git-recovery skill](../../.agents/skills/git-recovery/SKILL.md).

## Tags

- `checkpoint-<UTC-timestamp>` — tag HEAD with plain git (`git tag checkpoint-$(date -u +%Y%m%dT%H%M%SZ)`) before risky operations, so you can `git reset --hard` back if needed.
- Other tags reserved for releases (format defined later).
