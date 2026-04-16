---
name: pr-create
description: Create a pull request with a structured description. Use when the user says "create PR", "open PR", "pull request", "submit for review", or after completing a feature branch. Generates title, description, pushes, and creates the PR.
type: skill
allowed-tools: Bash(git *), Bash(gh *)
---

# Create Pull Request

## Workflow:
1. Verify you're on a feature/fix branch (not main)
2. Run `git log main..HEAD --oneline` to see all commits in this branch
3. Run `git diff main --stat` to see all files changed
4. Generate the PR title from the branch name and primary commit type
5. Generate the PR description using the template below
6. Push the branch: `git push -u origin HEAD`
7. Create the PR using `gh pr create` (requires GitHub CLI)
8. If `gh` is not available, output the title and description for manual creation

## PR Description Template:
```markdown
## What
<!-- One-sentence summary of the change -->

## Why
<!-- Link to task ID, plan file, or requirement -->

## How
<!-- Brief explanation of the approach taken -->

## Changes
<!-- Auto-generated from git diff --stat -->

## Testing
<!-- How to verify this works — commands to run, expected output -->

## Checklist
- [ ] Tests pass
- [ ] No new warnings
- [ ] Docs updated if needed
- [ ] Self-reviewed against architecture.md conventions
```

## Rules:
- Always self-review with `git diff main` before creating the PR
- Link to the relevant `docs/wiki/entities/<slug>.md` and any `docs/wiki/decisions/*` pages
- Never create a PR with failing tests
- If the diff is large (>500 lines), note which files are most important to review
