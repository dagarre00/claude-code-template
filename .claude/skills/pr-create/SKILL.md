---
name: pr-create
description: Conductor-only. How to draft and open a pull request, log it, and return to develop — run by /project:work once every Behavior case on the entity is [x], by /project:adversary once a release review's fix/* branch holds its fixes, or when the human asks for a PR.
user-invocable: false
---

# PR Creation

`/project:work` runs this automatically once every Behavior case on the target page is `[x]`, and `/project:adversary` runs it once a release review's `fix/*` branch holds its approved fixes. Merging is always the human's call.

## Preconditions

A `feat/*` or `fix/*` branch, a clean working tree, every commit pushed (`git push -u origin <branch>`), and all Pre-PR checks below passing.

## Pre-PR checks

Fix any failure before opening the PR:

- The test command and architecture check from `docs/wiki/commands.md` pass on `HEAD`.
- **Wiki ships with code:** every source-changing commit in `git log develop..HEAD` also updates `docs/wiki/entities/<slug>.md` (or `docs/wiki/concepts/<slug>.md` for `[infra]`) per rule 1, or carries a `Wiki-Update: none (<reason>)` footer.
- **Log ships with change:** the branch's `work` entries in `docs/wiki/log.md` cover its cycles (or its `adversary` entry covers a release-review `fix/*` round), and timestamps are monotonic.
- **No broken wikilinks** in changed wiki pages: every `[[target]]` resolves under `docs/wiki/` and every `#anchor` matches a real heading.
- **Rule file changed** (listed under `Enforced by` in `architecture.md § Layers`) → an ADR ships on the same branch (rule 23).

## Steps

1. **Gather:** `docs/wiki/git-conventions.md` (its PR template overrides the skeleton below), the ticked Behavior cases on `entities/<slug>.md` (or `concepts/<slug>.md`), this branch's entries in `docs/wiki/log.md`, and `git log develop..HEAD --oneline`.
2. **Draft the body** (observable behavior, not TDD trace):

   ```markdown
   ## Summary

   <1–3 bullets: what shipped, in observable terms>

   ## Behavior cases closed

   [[entities/<slug>]] — B1, B2

   ## Related TODOs

   - Closed: <the todo(s) this branch shipped>
   - Follow-ups queued: <from todos.md or wiki-todos.md>

   ## Test plan

   - [ ] `<test command from docs/wiki/commands.md>`
   - [ ] Manual: <any non-automated check>

   ## Notes

   <ADRs filed this cycle (linked), non-obvious decisions, wiki-todos appended>
   ```

   Link the entity/concept **page** and list case IDs as plain text (`[[entities/<slug>#B1]]` is a broken wikilink because cases are list items, not headings).
3. **Open PR:** Show a brief preview, then run `gh pr create --base develop --title "<title>" --body-file <path>` using a temp file outside the repo (or `--body "$(cat <<'EOF' ... EOF)"`) so the working tree stays clean. Title uses conventional commit format matching the lead commit (`feat(<scope>): <one-liner>`). If `gh` is unavailable or unauthenticated, print the body for the human to open manually.
4. **Tell the human:** `"Feature <slug> is complete. PR #N targets develop — please review and merge when ready."`
5. **Log and commit the PR entry:**

   ```markdown
   ## [YYYY-MM-DD HH:MM] pr — <slug>

   - Branch: <feat|fix>/<slug>
   - PR: <url>
   ```

   ```bash
   git add docs/wiki/log.md
   git commit -m "docs(<slug>): log PR #N"
   git push
   ```

6. **Return to `develop`** once `git status --porcelain` is empty: `git checkout develop`.

## What you do NOT do

- **No merging or force-pushing** (ask before any rebase/squash).
- **No bypassing `git-conventions.md`.**
