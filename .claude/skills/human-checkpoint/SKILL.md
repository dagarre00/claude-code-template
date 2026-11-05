---
name: human-checkpoint
description: Conductor-only. When and how to pause for the human — structured ask, options, and recommendation — and how fast mode resolves checkpoints via recorded defaults or stopping the run.
user-invocable: false
---

# Human Checkpoint

Stop and ask **before** acting whenever the wiki and rules do not settle a decision.

## Always stop

| Situation | Action |
| --- | --- |
| Two failed attempts on the same mechanism | Tag `checkpoint-<stamp>`, present both attempts, ask direction. |
| A test seems to encode the wrong behavior | Spec change belongs to the human; never weaken the test. |
| A design fork the wiki doesn't pre-decide | Present options, tradeoffs, and recommendation. |
| Uncommitted changes from another session | Ask whether to commit, stash, or discard — list the paths. |
| Unclear branch state (off `develop`, prior PR merged?) | Show `git status` and `git log --oneline -10`. |
| Deleting files, force-pushing, dropping tables, or calling external services | Confirm scope and authorization. |
| Missing skill or wiki page | Ask before improvising; offer to create via `update-toolkit`. |
| Ambiguous test output | Show output and ask how to interpret. |
| `critical`/`major` adversary finding (rule 20) | Gate immediate fix vs filing at P0/P1. |

## Don't stop for a foregone conclusion

- **No genuine fork:** If only one option is sensible and easily reversible (a branch, commit, or tick), state in one line what you are doing and proceed.
- **Already answered by rules:** Never ask permission to follow `.claude/rules/behavioral.md`.

The table above always requires a checkpoint.

## How to ask

```
**Why I'm stopping:** <one line>

**Context:**
- <fact — cite the entity, todo, or requirement>
- <fact>

**Options:**
1. <Option A> — <one-line tradeoff>
2. <Option B> — <one-line tradeoff>

**My recommendation:** <which, and why in one line>

**What I need from you:** <pick an option, or give another direction>
```

Use `AskUserQuestion` when 2–4 short options fit; otherwise output the block as text and wait without making background edits.

## After the answer

Echo the chosen path in one line, record any implied rule (`behavioral.md`), trap (`gotchas.md`), or pattern (`wiki-todos.md`), and resume.

## Fast mode

When a command argument starts with `fast` (`subagent-dispatch § Dispatch mode`), never block on the human. All behavioral rules (Red-first, read-only checks, rule 21, two-strike tag) stay in force.

**Take the default** for reversible forks:

| Checkpoint | Default |
| --- | --- |
| `critical`/`major` adversary finding | Filed at P0/P1 (rule 20 unreachable path). |
| `plan-adversary` `blocker` you disagree with | Applied. |
| Unspecified design fork or subagent question with a recommendation | Follow the recommendation (file an ADR if `decision-recording` applies). |
| Non-obvious batch | Do not batch — run the single todo. |
| Saturated P0 queue | Run what the argument asked; lead the report with the P0 count. |

**End the run** everywhere else (two-strike pivot after tagging `checkpoint-<stamp>`, foreign changes in tree, unclear branch state, failed `--ff-only` or rejected push, destructive action, wrong spec/test, missing skill/page, ambiguous/pre-existing test failure, unconfirmable Red, second partial result, unparseable argument). Leave committed work pushed (cases included, `subagent-dispatch § Close the case loop`) and uncommitted files untouched (rule 21), and open the report with the checkpoint block.

**Record every default taken** under `Fast mode:` in the log entry, in any round commit, and at the top of the report.
