---
name: release
description: Cut a release by merging develop into main with an annotated version tag. Human-approved. Runs the full suite on the release candidate first, then merges --no-ff, tags vX.Y.Z, and pushes main with the tag.
type: command
---

# /project:release

You promote the integrated work on `develop` to `main` as a tagged release. `main` only ever advances through this command (or a hotfix). The merge is **LLM-driven, human-approved** — you propose the version and the merge, the human confirms, you execute. See [git-conventions.md](../../../docs/wiki/git-conventions.md) → Releases and the [branch-merge skill](../../skills/branch-merge.md#release-develop-to-main).

## Preconditions

- On `develop` (or `main`), working tree clean.
- `develop` is ahead of `main` (there is something to release).
- The full test suite is green on `develop`.

If any fails: stop and run `human-checkpoint`. Never release a red or dirty `develop`.

## Steps

1. **Sync both base branches.**

   ```bash
   git fetch origin main develop
   git checkout develop && git merge --ff-only origin/develop
   git checkout main && git merge --ff-only origin/main
   ```

   If either `merge --ff-only` fails, the branch diverged — stop and use `human-checkpoint`. Never force or rebase `main`/`develop`.

2. **Confirm there's a delta.** `git log --oneline main..develop`. If empty, stop — nothing to release.

3. **Run the full suite on the release candidate.** Check out `develop`, run the command from `docs/wiki/commands.md`, and read the output yourself. Red → stop; releases ship only from green.

4. **Propose the version.** Derive a `vMAJOR.MINOR.PATCH` bump from the conventional commits in `main..develop`:
   - any breaking-change footer → **major**
   - any `feat` → **minor**
   - otherwise (`fix`/`chore`/`docs`/`refactor`/`perf`) → **patch**

   Show the human the commit summary and the proposed version, and **wait for approval** (the release gate). They may override the number.

5. **Merge, tag, and push** (follow the [branch-merge skill](../../skills/branch-merge.md#release-develop-to-main)):

   ```bash
   git checkout main
   git merge --no-ff develop -m "release: v<X.Y.Z>"
   git tag -a v<X.Y.Z> -m "Release v<X.Y.Z>"
   git push origin main --follow-tags
   ```

6. **Return to develop.** Leave the working branch on `develop` so the next `/project:work` starts clean:

   ```bash
   git checkout develop
   ```

7. **Log it.** Append to `docs/wiki/log.md`:

   ```markdown
   ## [YYYY-MM-DD HH:MM] release — v<X.Y.Z>

   - Merged: develop → main
   - Commits: <N> since v<previous>
   - Tag: v<X.Y.Z>
   ```

8. **Commit and push the log entry** on `develop`. This append-only `log.md` bookkeeping record is the one allowed direct commit to a protected branch (same exception the `session-end` hook relies on — see `git-conventions.md` → Direct-commit exception); it survives a container recycle:

   ```bash
   git add docs/wiki/log.md
   git commit -m "docs(log): release v<X.Y.Z>"
   git push origin develop
   ```

9. **Report to the human.** Version shipped, commit count, tag, and a one-line changelog from the `feat`/`fix` subjects. Suggest deploying if a pipeline is wired (`.github/workflows/ci.yml`).

## Failure modes

- **`develop` diverged from `main` non-fast-forward.** Stop and `human-checkpoint` — a release must not paper over divergence.
- **Suite red on `develop`.** Stop. Fix forward via `/project:work` before releasing.
- **Merge conflict `develop → main`.** Rare (main is a strict ancestor of develop in the normal flow). If it happens, a hotfix landed on `main` that wasn't back-merged — follow the [branch-merge hotfix dual-merge](../../skills/branch-merge.md#hotfix-dual-merge) to reconcile, then retry.
- **Push rejected.** Someone advanced `main` remotely. Re-fetch, re-sync (step 1), and retry; never force-push `main`.

## What you do NOT do

- **No release without approval.** The version and the merge both need explicit human go-ahead in this conversation.
- **No force-push to `main`.** Ever.
- **No code changes.** This command integrates and tags; it does not edit `src/` or the wiki beyond the log entry.
- **No squash or fast-forward.** Releases are `--no-ff` merge commits, like every protected-branch merge.
