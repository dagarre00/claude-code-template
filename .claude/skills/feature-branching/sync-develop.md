# Guarded develop sync — canonical block

`/project:interview`, `/project:review` and `/project:wiki` run this first. **On a `feat/*`/`fix/*` branch?** Stay there — living wiki edits ride the active branch (rule 19) — and skip it.

```bash
if [ "$(git branch --show-current)" = "main" ]; then
  git checkout develop || { echo "could not switch to develop — stop and run human-checkpoint"; exit 1; }
fi
branch="$(git branch --show-current)"
[ -z "$branch" ] && { echo "detached HEAD — stop and run human-checkpoint"; exit 1; }
if [ "$branch" = "develop" ] && git remote get-url origin >/dev/null 2>&1; then
  git fetch origin develop || { echo "fetch failed — stop and run human-checkpoint"; exit 1; }
  git merge --ff-only origin/develop || { echo "develop diverged — stop and run human-checkpoint"; exit 1; }
fi
```

Every failure goes to `human-checkpoint`, never past it:

- **A checkout failure** — most likely a fresh clone whose only branch is `main` (the release branch; never work from it), or a conflicting uncommitted file.
- **`merge --ff-only` fails** — `develop` diverged from origin. Committing on a stale `develop` and failing the push is the lost-commit case rule 19 prevents.

No remote is fine: the fetch and merge are skipped and the block works off local `develop`.
