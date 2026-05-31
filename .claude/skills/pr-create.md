---
name: pr-create
description: How to draft a pull request body for this project. Loads when finishing a feature branch and the human asks to open a PR. Trigger on "open PR", "create pull request", "PR template", "PR body", "draft PR".
type: skill
---

# PR Creation

Use this when wrapping up a short-lived branch and the human has asked for a PR **instead of** the default local `branch-merge` into `develop` (e.g. a shared remote that requires review). A PR targets **`develop`**; a release PR targets **`main`**. PR creation is **human-driven** — do not run `gh pr create` (or the equivalent MCP tool) without an explicit go-ahead in the current conversation.

## Read first

- `docs/wiki/git-conventions.md` — the branch model, PR targets (`develop` for features, `main` for releases), and labeling conventions.
- `docs/wiki/todos.md` — the open queue; the todo(s) this branch closed were removed from it (see the branch's commits / `git log develop..HEAD` for what shipped).
- `docs/wiki/log.md` — the `## [stamp] work — <slug>` entries for this cycle.
- The entity page `docs/wiki/entities/<slug>.md` — the Behavior cases that were ticked.
- `git log develop..HEAD --oneline` — the commits on this branch.

## Drafting the PR body

Compose the body from the artefacts above. Default skeleton (override with whatever `git-conventions.md` specifies):

```markdown
## Summary

<1–3 bullets: what shipped, in observable terms — pull from the entity page Goal / Behavior>

## Behavior cases closed

- [[entities/<slug>#B1]]
- [[entities/<slug>#B2]]

## Related TODOs

- Closed: <todo(s) this branch shipped — from the work log entries / commits>
- Follow-ups queued: <list from todos.md or wiki-todos.md>

## Test plan

- [ ] `<test command from docs/wiki/commands.md>`
- [ ] Manual: <if any non-automated check applies>

## Notes

<any ADR filed this cycle (link), any non-obvious decision, any wiki-todos appended>
```

## Steps

1. **Confirm preconditions.** On a short-lived branch (`feat/*`, `fix/*`, `chore/*`, `docs/*`, …) with a clean tree and all commits pushed (`git push -u origin <branch>`). The PR base is `develop` (`main` only for a release PR).
2. **Gather the inputs.** Read the files above.
3. **Draft the body** following the skeleton.
4. **Show the drafted body to the human.** Do not open the PR yet.
5. **Wait for human confirmation.** If they edit the draft, integrate the edits.
6. **Open the PR** only after explicit go-ahead. Use the GitHub MCP `mcp__github__create_pull_request` (or `gh pr create` if available) with **base `develop`** (or `main` for a release PR), the confirmed body, and the title in conventional-commit form (matching the lead commit on the branch).
7. **Log it.** Append to `docs/wiki/log.md`:

   ```markdown
   ## [YYYY-MM-DD HH:MM] pr — <slug>

   - Branch: feat/<slug>
   - PR: <url>
   ```

## What you do NOT do

- **No auto-open.** PR creation needs explicit human go-ahead in this conversation. A prior session's approval does not carry over.
- **No force-push.** If you need to rebase or squash, ask first.
- **No merging.** Merging is the human's call (and may need passing CI, reviewer approval, etc.).
- **No editing the PR template** to fit the changes — fit the changes to the template, or update `docs/wiki/git-conventions.md` first (via a separate cycle) if the template is genuinely wrong.

## Anti-patterns

- **Dumping `git log` into the body.** The reader wants observable behavior, not the TDD trace.
- **Omitting the Behavior-case references.** The wiki-link to each case is the reviewer's anchor for "what does this PR claim to do".
- **PR title in past tense or marketing voice.** Conventional commits: `feat(<scope>): <imperative one-liner>`.
