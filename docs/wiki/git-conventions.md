---
aliases: [Branching conventions, Commit conventions]
type: reference
domains: [software, git]
status: stable
sources: []
contradicts: []
open_questions: []
created: 2026-05-11
updated: 2026-08-13
---

# Git Conventions

> [!abstract] Essence
> Branching and commit conventions for this prototype. Mirrors the [feature-branching skill](../../.claude/skills/feature-branching/SKILL.md) — mirror changes into the skill when this page changes.

## Default branch

`main` — the trunk. No direct commits. There is **no `develop` branch** in this template: a prototype has one line of history, and the ceremony of an integration branch buys nothing when the review gate is a human watching the thing run.

"No direct commits" binds **every** command that writes tracked files — wiki edits, interview transcripts and `.claude/` config are as tracked as code. Each such command opens its own branch before its first write; the per-command branch names are tabulated in the [feature-branching skill](../../.claude/skills/feature-branching/SKILL.md).

## Branch naming

`<type>/<short-slug>`, where `<type>` ∈:

- `proto` — a prototype entity and its slices (the common case)
- `fix` — repairing something that was demonstrated and then broke
- `chore` — tooling, deps, housekeeping
- `docs` — wiki, interviews, handoff exports

Slug: kebab-case, ≤ 4 words, matches the entity slug when applicable.

Examples: `proto/csv-ingest`, `fix/upload-500s-on-empty-file`, `docs/interview-sync-logic`.

## Commit format

Conventional commits, present tense:

```
<type>(<scope>): <one-line summary>

<optional body — what and why, not how>
```

- `type` matches the branch type vocabulary (plus `feat` for a slice landing on a `proto/*` branch).
- `scope` is the entity slug.
- Subject ≤ 72 characters, no trailing period.
- Name the slice when one lands: `feat(csv-ingest): S2 — store uploaded rows`.

## Cadence

- **One commit per demonstrated slice** — code, entity-page tick, the recorded demonstration, and any `## Shortcuts` lines, together. The `builder` owns this; `/project:work` does not bundle a cycle's slices into one commit.
- **Never commit a slice you haven't run.** A commit is the claim that the demonstration under it is real (behavioral rules 2–3).
- Work in flight at a session boundary → `wip:` commit, tagged and pushed (see the skill's Mid-task pause).
- **Always push after committing** (`git push -u origin <branch>`). An unpushed commit is lost when the execution container recycles — behavioral rule 19.

## Merging

A `proto/*` branch merges to `main` when its slices are demonstrated **and the human has confirmed the demo does what they wanted**. That confirmation is the only review gate this template has.

```bash
git checkout main
git merge --no-ff proto/<slug> -m "merge: <slug> — <what now works>"
git push -u origin main
```

`--no-ff` keeps each prototype's slices legible as a group.

## Pull requests

Optional. Open one against `main` if the human wants the diff view; body is plain prose — what now works, which slices, which shortcuts. No template, no review gate, no auto-creation. Merging is always the human's call.

## Force-push policy

- `--force-with-lease` only, and only after a rebase onto `main`. Bare `--force` is never used.
- Never force-push `main`.

## Merge conflicts

Follow the [git-recovery skill](../../.claude/skills/git-recovery/SKILL.md). Key steps: resolve markers, grep for leftovers, **re-run the demo commands for any slice the conflict touched**, then commit.

## Branch cleanup (after merge)

```bash
git checkout main
git pull --ff-only
git branch -d proto/<slug>              # -d is safe: errors if unmerged
git push origin --delete proto/<slug>
```

## Tags

- `checkpoint-<UTC-timestamp>` — tag HEAD with plain git (`git tag checkpoint-$(date -u +%Y%m%dT%H%M%SZ)`) before a risky change or a two-strike reset.
- Other tags reserved for milestones worth returning to ("the version that demoed well on the 12th").
