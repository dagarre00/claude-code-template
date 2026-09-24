---
name: human-checkpoint
description: Conductor-only. When and how to pause for the human — a clear ask, the options, and a recommendation. Use for a decision the wiki doesn't answer, a two-strike pivot, or risky or irreversible state. Trigger on "ask the human", "stop and ask", "human checkpoint", "need decision", "risky operation".
type: skill
---

# Human Checkpoint

Stop and ask when the wiki doesn't answer — never guess, never silently improvise. Stop **before** acting: "I did X — is that OK?" is not a checkpoint.

## Always stop

| Situation | Action |
| --- | --- |
| Two failed attempts on the same mechanism | Tag `checkpoint-<stamp>`; present both attempts; ask for direction. |
| A test seems to encode the wrong behavior | The spec change is the human's; never change the test. |
| A design fork the wiki doesn't pre-decide | Both options, their tradeoffs, your recommendation. |
| Uncommitted changes from another session | Ask whether to commit, stash or discard — name the paths. |
| Unclear branch state (off `develop`, prior PR merged?) | Show `git status` and `git log --oneline -10`. |
| About to delete files, force-push, drop tables or call a third party | Confirm scope and authorization. |
| A skill or wiki page you need doesn't exist | Ask before improvising; offer to create it via `update-toolkit`. |
| Ambiguous test output | Show it; ask how to read it. |
| A `critical`/`major` adversary finding (rule 20) | Fix now or queue — deliberately an interruption. |

## Don't stop for a foregone conclusion

On projects using this template, 72–100% of checkpoints were answered with the agent's own recommended option, unchanged. A checkpoint the human always answers the same way costs the attention of a real one and decides nothing. Before asking:

- **Is there a genuine fork?** If you would argue against every option but your recommendation, say in one line what you are doing and why, and do it. A branch, a commit or a tick is cheap to undo; the human can redirect.
- **Do the rules already answer it?** "Should I write the test first?" asks permission to skip a rule — the answer is in `.agents/rules.md`.

The table above stays a checkpoint regardless: those are the irreversible or genuinely forked cases.

## How to ask

```
**Why I'm stopping:** <one line>

**Context:**
- <fact — cite the entity, todo or requirement behind the ask>
- <fact>

**Options:**
1. <Option A> — <one-line tradeoff>
2. <Option B> — <one-line tradeoff>

**My recommendation:** <which, and why in one line>

**What I need from you:** <pick an option, or give another direction>
```

Three bullets of context, then the question — never a wall of text, never "what should I do?" without options. Use `AskUserQuestion` for 2–4 options that each fit in a line or two; otherwise post it as text. Then wait: no background edits, no "trying something in the meantime", no burying the ask under more analysis.

## After the answer

Echo the chosen path in one line. If it implies a new rule, add it to `.agents/rules.md` (a discipline issue) or `docs/wiki/gotchas.md` (a project trap); if it implies a new pattern, queue it in `docs/wiki/wiki-todos.md`. Then resume.
