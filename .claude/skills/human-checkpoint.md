---
name: human-checkpoint
description: When and how to pause for the human — present a clear ask, options, and recommendation. Use whenever you need a decision the wiki doesn't answer, hit a two-strike pivot, or face risky/irreversible state. Trigger on "ask the human", "stop and ask", "human checkpoint", "need decision", "risky operation".
type: skill
---

# Human Checkpoint

Stop and ask when the wiki doesn't have an answer. Don't guess. Don't silently improvise.

## When to stop

| Situation                                                         | Action                                                                                              |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Two failed attempts on the same mechanism                         | Stop. Tag the state (`git tag checkpoint-<stamp>`). Present the two attempts and ask for direction. |
| Test seems to encode wrong behavior                               | Stop. Spec change must come from human; don't change the test.                                      |
| Design fork the wiki doesn't pre-decide                           | Stop. Present both options with tradeoffs and recommendation.                                       |
| Uncommitted changes from a prior session                          | Stop. Ask whether to commit, stash, or discard.                                                     |
| Branch state unclear (off develop, prior PR merged?)              | Stop. Run `git status` and `git log --oneline -10` and show output.                                 |
| About to delete files, force-push, drop tables, hit a third party | Stop. Confirm scope and authorization.                                                              |
| A skill or wiki page you need doesn't exist                       | Stop. Ask before improvising; offer to create it via `update-skill`.                                |
| Test command runs but produces ambiguous output                   | Stop. Show the output, ask what to interpret it as.                                                 |

## How to ask

Use this structure — clear, structured, no padding:

```
**Why I'm stopping:** <one line>

**Context:**
- <fact 1>
- <fact 2>

**Options:**
1. <Option A> — <one-line tradeoff>
2. <Option B> — <one-line tradeoff>

**My recommendation:** <which option and one-line why>

**What I need from you:** <pick one of the options OR give a different direction>
```

Use the `AskUserQuestion` tool when:

- The choice has 2–4 discrete options.
- Each option can be summarized in 1–2 lines.

Otherwise, post the structured ask in chat text and wait.

## What you do NOT do while waiting

- Don't keep editing files in the background.
- Don't proceed with a "I'll just try this in the meantime" branch.
- Don't bury the ask under further analysis. State it cleanly and stop.

## After the human answers

- Echo back the chosen path in one line so the human can confirm you understood.
- If the decision implies a new rule, file it: add to `.claude/rules/behavioral.md` (discipline issue) or `docs/wiki/gotchas.md` (project-specific failure).
- If the decision implies a new pattern, queue it: append to `docs/wiki/wiki-todos.md` (e.g. `Document <pattern> as a concept`).
- Then resume work.

## Anti-patterns

- **Asking after acting.** "I did X — is that OK?" is not a checkpoint. Stop before acting.
- **Open-ended questions.** "What should I do?" wastes the human's time. Present options and a recommendation.
- **Wall-of-text context dumps.** Three bullets, then the question.
- **Asking without the wiki-anchor.** Cite the entity / todo / requirement that prompted the ask, so the human can correct the spec if needed.
