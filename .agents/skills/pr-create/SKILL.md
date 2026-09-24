---
name: pr-create
description: Conductor-only. How to draft and open a pull request, log it, and return to develop — run by /project:work once every Behavior case on the entity is [x], or when the human asks for a PR. Trigger on "open PR", "create pull request", "PR template", "PR body", "draft PR", "feature complete", "all cases ticked".
type: skill
---

# PR Creation

`/project:work` runs this without waiting to be asked once every case is `[x]`. Merging is always the human's call.

## Preconditions

A `feat/*` or `fix/*` branch, a clean tree, every commit pushed (`git push -u origin <branch>`), and `verify.mjs --base origin/develop` passing.

## Steps

1. **Gather:** `docs/wiki/git-conventions.md` (its PR conventions override the skeleton below), the entity page's ticked cases, this branch's `work` entries in `docs/wiki/log.md`, and `git log develop..HEAD --oneline`.
2. **Draft the body** — observable behavior, not the TDD trace:

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

   Link the entity **page** and list case IDs as text — cases are list items, not headings, so `[[entities/<slug>#B1]]` would be a broken wikilink.
3. **Open it** after showing the human a short preview (no confirmation needed): `mcp__github__create_pull_request` against `develop`, or, without that tool, `gh pr create --base develop --title "<title>" --body-file <path>`. The title is a conventional commit in the imperative, matching the branch's lead commit (`feat(<scope>): <one-liner>`). If neither route works, hand the human the body and say the PR is theirs to open — no third route.
4. **Tell the human:** "Feature `<slug>` is complete. PR #N targets `develop` — please review and merge when ready."
5. **Log it and commit the entry on its own** — the cycle's commits predate the PR:

   ```markdown
   ## [YYYY-MM-DD HH:MM] pr — <slug>

   - Branch: feat/<slug>
   - PR: <url>
   ```

   ```bash
   git add docs/wiki/log.md
   git commit -m "docs(<slug>): log PR #N"
   git push
   ```

6. **Return to `develop`** once `git status --porcelain` is empty: `git checkout develop`.

## What you do NOT do

- **No merging, no force-push.** A needed rebase or squash is asked for first.
- **No bending the template.** Fit the PR to `git-conventions.md`, or change that page first in its own cycle.
