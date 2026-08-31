---
aliases: [Branching conventions, Commit conventions]
type: reference
domains: [software, git]
status: stable
sources: []
contradicts: []
open_questions: []
created: 2026-05-11
updated: 2026-08-05
---

# Git Conventions

> [!abstract] Essence
> Branching and commit conventions for this project. Mirrors the [feature-branching skill](../../.claude/skills/feature-branching/SKILL.md) — updated when the team adopts a new flow; mirror changes into the skill.

## Integration and branching model

`develop` is the primary integration branch; `main` is the release branch.
- **Code modifications (`feat/*`, `fix/*`, `refactor/*`, `perf/*`)** must always be built on a dedicated branch cut from `develop` and merged via PR. No direct code commits on `develop`.
- **Living documentation & operations (`docs/wiki/`, `docs/raw/`, `.claude/` config)**: maintenance commands (`/project:wiki-lint`, `/project:review`, `/project:wiki-ingest`, `/project:interview`, `/project:agent-scout`) commit and push directly to `develop` when standing on `develop` (or stay on the active feature branch if mid-feature). This keeps the living knowledge base fast and responsive without PR fatigue for documentation.

The branching rules and command tables are defined in the [feature-branching skill](../../.claude/skills/feature-branching/SKILL.md).

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
- Adversary findings: most are **filed as todos, not fixed**, so a review round usually produces a single `docs(<slug>): adversary round N` commit whose body carries every finding's disposition and which stages the new `todos.md` lines. A `fix(<slug>): … — adversary F1` commit appears only for a `critical`/`major` the human approved fixing immediately. That round-commit body is the record behavioral rule 20 requires — `git log --grep="adversary round"` reads it back.
- Don't commit half-green code.
- **Always push after committing** (`git push -u origin <branch>`). An unpushed commit is lost when the execution container recycles — see `.claude/rules/behavioral.md` #19. Read-only commands (those that don't mutate tracked files) are the only exception.

## PRs

- Open from `<type>/<slug>` to `develop`.
- Opened automatically by `/project:work` (via the `pr-create` skill) once all Behavior cases for the cycle are `[x]`.
- Title mirrors the lead commit.
- Description references the entity page and the Behavior cases covered.
- **Merge commit on merge** (`gh pr merge --merge --delete-branch`), not squash. The Red→Green→Refactor commit sequence is the evidence that the loop was actually run — squashing erases it, and this schema already forbids squashing locally for the same reason ([feature-branching](../../.claude/skills/feature-branching/SKILL.md), Anti-patterns). Squash only a branch with no TDD trace to preserve: a typo fix, a revert, a branch whose history is all `wip:` noise.
- Delete the branch on merge, local and remote.
- Merging is always the human's call.

## Force-push policy

- `--force-with-lease` is the only acceptable force-push (used after a rebase onto develop). It fails safely if the remote branch has been updated since your last fetch.
- Bare `--force` is never used.
- Never force-push `develop` or `main`.

## Merge conflicts

Follow the [git-recovery skill](../../.claude/skills/git-recovery/SKILL.md) (Resolve merge / rebase / cherry-pick conflicts) when `git merge` or `git rebase` produces `CONFLICT (content)` markers. Key steps: resolve markers, grep for leftovers, run full tests, then `git add + git commit` (merge) or `git add + git rebase --continue` (rebase).

## Branch cleanup (after merge)

```bash
git checkout develop
git pull --ff-only
git branch -d feat/<slug>              # -d is safe: errors if unmerged
git push origin --delete feat/<slug>
```

## Advanced git operations

Stash, cherry-pick, bisect, blame, reflog recovery, and other edge-case operations are covered by the [git-recovery skill](../../.claude/skills/git-recovery/SKILL.md).

## Tags

- `checkpoint-<UTC-timestamp>` — tag HEAD with plain git (`git tag checkpoint-$(date -u +%Y%m%dT%H%M%SZ)`) before risky operations, so you can `git reset --hard` back if needed.
- Other tags reserved for releases (format defined later).
