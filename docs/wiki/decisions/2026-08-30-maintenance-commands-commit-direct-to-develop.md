---
aliases: [Option A integration model, Direct-to-develop wiki commits]
type: decision
domains: [software, git]
status: accepted
sources: []
supersedes: []
superseded_by: []
contradicts: []
open_questions: []
created: 2026-08-30
updated: 2026-08-30
---

# Maintenance Commands Commit Directly to Develop

> [!abstract] Essence
> Living documentation and toolkit maintenance (`/project:wiki-lint`, `/project:review`, `/project:wiki-ingest`, `/project:interview`, `/project:agent-scout`, `/project:handoff`) commits directly to `develop`, while application code stays strictly PR-gated through `feat/*`/`fix/*` branches.

## Status

Accepted as of 2026-08-30.

## Context

`/project:review` previously ran the `reviewer` in a throwaway git worktree, and every maintenance command opened its own branch and PR. Three forces pushed against that: wiki-only branches produced PR fatigue (a one-line log edit became a branch, a PR, and a merge), the worktree forced a full dependency re-install per audit plus teardown friction, and behavioral rule 19's push discipline punishes unpushed local commits in recycled containers — maintenance work on short-lived branches kept getting stranded mid-PR. The countervailing force is isolation: the worktree pinned HEAD and contained the reviewer's test-suite side effects.

## Decision

We will commit and push living documentation and operations (`docs/wiki/`, `docs/raw/`, `.claude/` config) directly to `develop` from the six maintenance commands when standing on `develop` (or keep the edits on the active `feat/*`/`fix/*` branch mid-cycle), and we will reserve branch-and-PR strictly for application code. Direct-to-develop commits are protected by guard rails instead of isolation: maintenance commands refuse to run from `main`, and a non-fast-forward `develop` stops the command with `human-checkpoint` rather than proceeding on stale state.

## Consequences

- **Positive:** no branch/PR proliferation for routine knowledge-base updates; the living spec updates in the same commit as the change that drove it; no dependency re-install per review.
- **Negative:** concurrent maintenance sessions can race on `develop` — mitigated by the ff-only sync plus the divergence stop; the reviewer's suite now runs in the main checkout, so the reviewer must restore any suite-written files before writing the report (`reviewer.md` entry checklist, behavioral rule 21).
- **Follow-ups:** none open — the guard rails named here were added in the same adversary round that filed this ADR.

## Alternatives considered

- **Option B — keep the review worktree:** rejected — the isolation was real, but it cost a dependency re-install per audit and worktree teardown friction; review frequency did not justify it.
- **Option C — throwaway chore branches with PRs for wiki edits:** rejected — preserves review at the price of PR fatigue on one-line log edits; the branch-per-edit stream is what the direct-commit model replaces.

## References

- Relates to: [[git-conventions]], [feature-branching](../../.claude/skills/feature-branching/SKILL.md), `.claude/rules/behavioral.md` rule 19.
