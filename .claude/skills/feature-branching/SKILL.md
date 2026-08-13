---
name: feature-branching
description: Branching procedure for this prototype — when to branch, when to merge back to main, mid-task pause, finishing checklist. Commit-message format lives in docs/wiki/git-conventions.md. Trigger on "start branch", "proto/", "new branch", "merge back", "finish feature", "wrap up".
type: skill
---

# Branching

Always branch before the first tracked write. Never commit directly to `main`. There is no `develop` branch in this template and no PR ceremony — commit-message format lives in [`docs/wiki/git-conventions.md`](../../../docs/wiki/git-conventions.md).

## Starting work

1. Confirm clean tree:

   ```bash
   git status --porcelain
   ```

   If dirty: stop and run `human-checkpoint`. See **Mid-task pause** below.

2. Sync main. `fetch` + `merge --ff-only` fails safely if main has diverged:

   ```bash
   git fetch origin main
   git checkout main && git merge --ff-only origin/main
   ```

   No remote (`git remote` prints nothing)? Skip the fetch and work locally; every push step below is skipped and noted in the report until a remote exists.

3. Branch as `proto/<slug>` — one branch per entity, carrying however many slices that entity needs:

   ```bash
   git checkout -b proto/<slug>
   ```

**The `<slug>` equals the entity-page slug.** Branch name, entity page, and commit scope all key off it. Pick it once, keep it stable.

## Which command branches, and when

Every command that writes tracked files branches **before its first write** (behavioral rule 19) — not before its commit. A command whose output is written turn-by-turn (an interview transcript) has already landed on the wrong branch by the time you check at commit time.

| Command                | Branch                             | Created before          |
| ---------------------- | ---------------------------------- | ----------------------- |
| `/project:work`        | `proto/<slug>`                     | the first code file     |
| `/project:interview`   | `docs/interview-<slug>`            | the transcript file     |
| `/project:graduate`    | `docs/graduate-<date>`             | the handoff file        |
| `/project:wiki-ingest` | `docs/ingest-<slug>`               | the summary page        |
| `/project:agent-scout` | `chore/agent-scout-<date>`         | the first skill file    |
| `/project:wiki-lint`   | `chore/wiki-lint-<date>`           | the maintainer dispatch |
| `/project:demo`        | `chore/demo-<date>`, only if it files todos | the todo lines |

In every case the rule is the same: **branch only if you're on `main`.** Already on a `proto/*` branch whose work this belongs to → stay there.

## Merging back to main

A prototype branch merges when its slices are demonstrated and **the human has seen it run** — that confirmation is the only gate this template has, so don't skip it:

1. Show the human the demonstrations (or run `/project:demo`) and ask whether it does what they wanted.
2. On confirmation:

   ```bash
   git checkout main
   git merge --no-ff proto/<slug> -m "merge: <slug> — <what now works>"
   git push -u origin main
   git branch -d proto/<slug>
   git push origin --delete proto/<slug>   # if it was pushed
   ```

   `--no-ff` keeps each prototype's slices visible as a group in history.

3. If they want changes instead, stay on the branch and keep slicing.

**Pull requests are optional here.** If the human wants one (they're hosting on GitHub and want the diff view), open it against `main` with a plain body: what now works, which slices, which shortcuts. No template, no review gate, and merging is still their call.

## Mid-task pause

When interrupted mid-slice (not at a demonstrated boundary), pick the lightest option:

1. **Preferred — checkpoint tag.** Commit the in-progress state with a `wip:` prefix, tag it, reset when resuming:

   ```bash
   git add <coherent-paths>                 # stage explicitly by path — never `git add -p` (interactive mode hangs with no human at the prompt)
   git commit -m "wip: <what's in flight>"
   git tag checkpoint-$(date -u +%Y%m%dT%H%M%SZ)
   git push                                  # an unpushed wip dies with the container
   ```

   On resume, `git reset HEAD~1` (soft) to un-commit the wip, then continue.

2. **Fallback — stash.** Only for a genuinely tiny change you'll resume in the same session. See `git-recovery`. Never leave a stash across sessions.

## Sync with main (long-running branches)

```bash
git fetch origin main
git rebase origin/main
git push --force-with-lease origin <branch>   # safe: fails if remote has commits you don't have
```

Conflicts → `git-recovery` skill. `--force-with-lease` is the only acceptable force-push; never bare `--force`.

## Commit cadence

- One commit per demonstrated slice — code, entity-page tick, demonstration, shortcut lines, together.
- Push after every commit. An unpushed commit dies with the container.
- Don't commit a slice you haven't run.

## Finishing the entity

1. Re-run the `## Run` command — the prototype still starts.
2. Entity page current: slices ticked, demonstrations recorded, shortcuts declared.
3. Todo removed from `docs/wiki/todos.md` (shipped work lives in git history).
4. Push, then show the human and offer the merge (above).

## Anti-patterns

- **Committing to `main` directly.** Branch first.
- **`git commit -a`.** Stage explicitly.
- **Long-lived prototype branches.** If a branch has more than a handful of slices on it, you're building too much before showing it.
- **Merging without the human seeing it run.** The demonstration is this template's entire review process.
