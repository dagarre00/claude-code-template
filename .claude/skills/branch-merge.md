---
name: branch-merge
description: How to integrate a finished branch in this project — merge a feature branch into develop (human-approved, --no-ff), cut a release from develop into main, or dual-merge a hotfix. Trigger on "merge the branch", "merge into develop", "integrate the feature", "finish the cycle", "merge to main", "release", "back-merge", "merge feature branch".
type: skill
---

# Branch Merge

The agent owns the merge. The human **approves** it; they do not run git. This skill is the procedure for the three merges in the [git-conventions](../../docs/wiki/git-conventions.md) branch model: feature → `develop`, release `develop` → `main`, and the hotfix dual-merge. Branch model and policy live in `git-conventions.md` — this skill won't repeat the rationale.

## The merge gate (always)

Every merge into a protected branch (`develop` or `main`) is **proposed, then executed only after explicit human go-ahead in the current conversation**. Prior-session approval does not carry over. Present the ask with `human-checkpoint`:

```
**Ready to merge feat/<slug> → develop.**
- Cycle: <todo(s) shipped>, Behavior cases <B1, B2> ticked.
- Full suite: green (<command>, run on the branch).
- Develop is current (fetched, fast-forward clean).
**Merge now?** (yes / hold / change approach)
```

If the human says hold, stop — leave the branch pushed and unmerged. Do not keep editing.

## Feature → develop

Run only after the cycle is green, committed, and pushed, and the human approved the merge.

1. **Make develop current.** A non-fast-forward here means develop diverged — stop, do not force:

   ```bash
   git fetch origin develop
   git checkout develop && git merge --ff-only origin/develop
   ```

2. **Merge `--no-ff`.** One merge node per feature; keep git's default `Merge branch '<branch>' into develop` message (merge commits are exempt from the conventional-commit subject format):

   ```bash
   git merge --no-ff feat/<slug>
   ```

   On `CONFLICT (content)`, follow the [conflict-resolution skill](./conflict-resolution.md). If the resolution is ambiguous, `git merge --abort` and use `human-checkpoint` — never commit a guessed merge into develop.

3. **Verify green on develop.** Run the full test command from `docs/wiki/commands.md`. The merge can surface integration breakage that neither branch showed alone. If develop is red, fix forward on a new branch or `git reset --hard origin/develop` to undo the merge — do not push a red develop.

4. **Push develop.**

   ```bash
   git push origin develop
   ```

5. **Delete the feature branch** (local + remote). `-d` is safe — it refuses an unmerged branch:

   ```bash
   git branch -d feat/<slug>
   git push origin --delete feat/<slug>
   ```

6. **Log it.** Append a one-line merge entry to `docs/wiki/log.md` if `/project:work` hasn't already covered it in the cycle entry.

## Release develop to main

Driven by `/project:release` (`develop → main`). Same gate, higher stakes — this moves production.

1. **Both base branches current:**

   ```bash
   git fetch origin main develop
   git checkout main && git merge --ff-only origin/main
   ```

2. **Pick the version.** Propose `vMAJOR.MINOR.PATCH` from conventional commits since the last tag (`feat` → minor, `fix`/`chore` → patch, breaking footer → major); the human confirms or overrides.

3. **Merge `--no-ff`, tag, push with the tag:**

   ```bash
   git merge --no-ff develop -m "release: v<X.Y.Z>"
   git tag -a v<X.Y.Z> -m "Release v<X.Y.Z>"
   git push origin main --follow-tags
   ```

4. **No back-merge needed** when the release was a clean `develop → main` — they now share history. Back-merge is only for hotfixes (below).

## Hotfix dual-merge

A `hotfix/<slug>` is cut from `main` (see `git-conventions.md` → Hotfixes). After the fix is green and pushed, it lands in **both** branches:

1. **Into main** (human-approved), tag a patch release:

   ```bash
   git checkout main && git merge --ff-only origin/main
   git merge --no-ff hotfix/<slug>
   git tag -a v<X.Y.Z+1> -m "Hotfix v<X.Y.Z+1>"
   git push origin main --follow-tags
   ```

2. **Back-merge into develop** so the fix survives the next release:

   ```bash
   git checkout develop && git merge --ff-only origin/develop
   git merge --no-ff main
   git push origin develop
   ```

3. **Delete the hotfix branch** (local + remote), as in the feature flow.

## Anti-patterns

- **Merging without the gate.** Never merge into `develop` or `main` without explicit approval in the current conversation.
- **Fast-forward or squash into develop.** Always `--no-ff` — the feature boundary is the point.
- **Pushing a red protected branch.** Re-run the suite on `develop`/`main` after the merge; never push if it's red.
- **Force-pushing `develop` or `main`.** Forbidden. `--force-with-lease` is for feature branches only.
- **Leaving a merged branch around.** Delete local and remote immediately after a successful merge.
