# Guarded develop sync — canonical block

The maintenance commands (`/project:interview`, `/project:review`, `/project:wiki-lint`, `/project:wiki-ingest`, `/project:agent-scout`, `/project:handoff`) run this before doing anything else. **Already on a `feat/*`/`fix/*` branch?** Stay there — living wiki edits ride the active branch (behavioral rule 19) — and skip this block.

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

Stop conditions — all go to `human-checkpoint`, never proceed past them:

- **Any checkout failure.** Most likely a fresh clone whose only branch is `main`, but a conflicting uncommitted file hits the same message. `main` is the release branch — never work from it.
- **`merge --ff-only` fails.** `develop` has diverged from origin in a non-fast-forward way. Committing on a stale `develop` and failing the push is the unpushed-commit loss behavioral rule 19 exists to prevent.
- No remote is fine: the fetch and merge are both skipped and the block works off local `develop`.
