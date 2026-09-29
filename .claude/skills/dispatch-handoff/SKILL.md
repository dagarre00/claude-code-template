---
name: dispatch-handoff
description: Conductor-only. How to hand one role's dispatch to the human as a file they run in another harness — a fresh Claude Code session, Antigravity (agy) or any other — and take the result back through the same checks as a native dispatch. Covers the file's path and template, the reading list that stands in for preloaded skills, the limits no other harness enforces, the launch lines and the return path.
when_to_use: Trigger on "handoff file", "hand off the dispatch", "dispatch manually", "run it in another harness", "run it in agy", "Antigravity", "another Claude Code session", "handoff report".
user-invocable: false
---

# Dispatch Handoff

The human launches the role in another harness instead of you launching it with the Agent tool. Only the launch changes: the brief is the one `subagent-dispatch` would give, the checkout is this one, and the result passes the same checks before anything is accepted. Runs when a dispatch's mode is handoff (`subagent-dispatch` § Dispatch mode) — never in a fast-mode run.

## Read first

- `.claude/agents/<role>.md` — its frontmatter's `model`, `effort`, `tools` and `skills:` fill the file. A role whose `tools` has no `Edit` or `Write` is read-only.
- [`handoff-template.md`](handoff-template.md) — the file you write.

## Steps

1. **Baseline, as for any dispatch** — a clean tree, then `git rev-parse HEAD` and `git status --porcelain` (`subagent-dispatch` § Brief). The role runs in this checkout: from here until you have decided on its result, nothing else writes to it.
2. **Name the pair.** `<slug>` is the cycle's entity slug, else the command's name (`review`, `wiki`). The handoff is `.handoff/<slug>-<role>-handoff.md`, its report `.handoff/<slug>-<role>-report.md` — both gitignored scratch. Delete a report already at that path first: an old one must never pass for the new one.
3. **Write the handoff file** from the template, every `<…>` filled and the line that does not match the role's access dropped:
   - **The brief** is exactly the four lines a native dispatch would carry. Rule 10 holds on paper too: nothing from this conversation, no reasoning, no expected answer; files by path, never pasted.
   - **The reading list** stands in for what Claude Code preloads into a subagent: the rules, `subagent-contract`, the role file, then each other skill in its `skills:` list, in order. `claude --agent <role>` applies a role's prompt, tools and model but not its skills, so the list is needed there too.
   - **The limits** restate the role's `tools` line and its access. No other harness enforces them; your baseline comparison is what does.
   - **The model line** is the role's `model` and `effort`. Antigravity's `--effort` stops at `high`.
4. **Hand it over.** In chat: the file's path, its launch lines, and that you are waiting for "done" — with the harness and model they used — or for the agent's final message, pasted. Then stop. No edits, no other write dispatch, nothing on the checkout until they are back.
5. **Take it back.** Read the report file, or the pasted message. Neither, or a report that stops mid-task, is a partial result: ask the human to tell the same session to continue, once; partial again → `human-checkpoint`. Then continue at `subagent-dispatch` § Wait, then check what it touched, step 2 — the baseline comparison, the report against what the command defines as done, and for a developer § Prove and commit.
6. **Send back** — the notes and the deciding output tail go to the human, to paste into the same session. A new session gets a fresh handoff file whose brief adds "these files are the previous attempt".
7. **Record the harness** when the role was a reviewer — `finding-disposition` § Record the yield.
8. **Clean up.** Delete the pair once the result is accepted or discarded. A developer's report left in `.handoff/` is author material within reach of the next reviewer.

## Anti-patterns

- **Writing your reasoning into the file** — it is a brief, and rule 10 applies to it.
- **Accepting on the report.** The other harness enforced none of the role's limits; the baseline comparison is the only proof it kept to them.
- **A reviewer launched in a session that has seen the work** — this conversation, or the developer's. Its independence is the product.
- **Reusing a report file** from an earlier round.
- **Working the checkout while you wait.**
