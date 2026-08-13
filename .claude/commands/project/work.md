---
name: work
description: Pick the top todo, open a proto/* branch from main, dispatch the builder to build the slice and actually run it, verify the demonstration yourself, log, and offer the merge. The core prototyping loop.
argument-hint: [todo, entity, or slice — e.g. "the upload page" | "S3" | "just get it starting"]
type: command
---

# /project:work

**Argument:** `$ARGUMENTS`

The argument **selects the work** and overrides the default "take the top todo" in step 1:

- **Names a todo, entity, or slice** (`the upload page`, `entities/ingest`, `S3`) → work that instead of the top item. Match it against `docs/wiki/todos.md` lines, entity slugs, and slice IDs; if nothing matches, say what you looked for and stop rather than picking something adjacent.
- **Adds a constraint** (`ugliest possible version`, `don't touch the schema`) → honour it and note the deviation in the report.

An argument never bypasses the preconditions or the demonstration. If it's empty, take the top todo.

You orchestrate one build cycle. You do **not** write code directly — you dispatch the `builder`, which commits and pushes each slice as it lands. You verify the demonstration is real, add the log entry, and offer the merge.

## Preconditions

**Starting fresh (on `main`):**

- Clean working tree.
- `docs/wiki/todos.md` has at least one item.
- `docs/wiki/commands.md § Run` is not `<TBD>`, **and the command actually starts the thing.** Run it once before dispatching. The exception is a brand-new prototype whose first slice *is* the run command — in that case there is nothing to check yet, and the builder records it when it lands.

If a precondition fails: stop and run `human-checkpoint`.

**If you are on a `proto/*` branch when invoked**, check for in-progress work (uncommitted changes, or slices at `[~]`). If yes, continue from step 4. If the branch is clean, demonstrated, and merged, `git checkout main` and proceed from step 1.

## Resuming an interrupted cycle

The `builder` commits and pushes after each demonstrated slice, so a container recycle loses at most the slice in flight. Re-run `/project:work`: `git fetch origin proto/<slug>` recovers what was pushed, and the `[ ]`/`[~]` slices on the entity page are the resume point.

## Steps

1. **Pick the work.** Read `docs/wiki/todos.md`, take the top item (or what the argument named). Skip `[wiki]` lines — those belong to `/project:wiki-lint`. Identify the matching `docs/wiki/entities/<slug>.md`. If it doesn't exist, **stop** and recommend `/project:interview` to shape the entity first.

2. **Branch.** Follow the `feature-branching` skill:

   ```bash
   git fetch origin main
   git checkout main && git merge --ff-only origin/main
   git checkout -b proto/<slug>
   ```

   If `merge --ff-only` fails, stop and use `human-checkpoint` — do not rebase or force main. No remote? Skip the fetch/merge, branch locally, and note every skipped push in the report.

3. **Verify the slices are demonstrable.** Read the entity page's `## Slices`. Each slice this cycle covers must name the command that will demonstrate it (`slice-writing`). If a slice names no command, or the section is empty, **fix that first** — either shape it yourself with `slice-writing` if the product intent is unambiguous, or stop and recommend `/project:interview` if it isn't. Never dispatch the builder at a slice nobody can demonstrate.

4. **Dispatch the `builder`** with this scope:
   - The entity slug and the branch name.
   - The slice IDs to cover this cycle (**one to three** — resist more; unshown work compounds).
   - The run command from `docs/wiki/commands.md`.
   - Any constraint from the argument.

   The builder runs the loop **once per slice**: scope → build → run → record the real output → tick → commit → push, then the next slice. It owns committing; you do not bundle its work afterwards.

5. **Verify the demonstrations yourself.** This is the step that makes the template trustworthy, so do it properly:
   - Re-run the demo command for each slice the builder marked `[x]`. You should see what the entity page's `## Demonstrations` says you'll see. **If the recorded output and the real output disagree, the slice is not done** — send it back, and treat a fabricated demonstration as a hard stop (behavioral rule 3), not a redo.
   - Run the `## Run` command once to confirm the prototype still starts.
   - `git log --oneline main..HEAD` — one commit per slice, not one lump.

6. **Check the wiki.** Slices ticked; `## Demonstrations` holds real commands and real output; `## Shortcuts` has a line for every fake the builder took (if the diff hardcodes something and the ledger doesn't mention it, that's a defect — send it back); `## Implementation` points at the files that exist; the todo is removed from `docs/wiki/todos.md`.

7. **Append to log and commit.** `docs/wiki/log.md` — the one commit this command makes itself:

   ```markdown
   ## [YYYY-MM-DD HH:MM] work — <slug>

   - TODO(s): <list>
   - Slices: S1, S2 — demonstrated
   - Not demonstrated: S3 — <blocker>   # omit if none
   - Shortcuts declared: <count>
   - Branch: proto/<slug>
   ```

   ```bash
   git add docs/wiki/log.md
   git commit -m "docs(<slug>): log cycle"
   git push -u origin proto/<slug>
   ```

   Confirm `git status --porcelain` prints nothing.

8. **Show the human, and offer the merge.** Paste the demonstration output — the actual thing working is the report. Then ask whether it does what they wanted:
   - **Yes** → merge to `main` per `feature-branching` ("Merging back to main") and return to `main`.
   - **Not quite** → stay on the branch, take their correction as the next slice.

   Never merge without that answer; it is the only review gate this template has.

9. **Report.** What now works (with output), what you assumed technically, what you faked, what's next. Suggest:
   - More slices on this entity → run `/project:work` again.
   - The shape of the thing is wrong → `/project:interview` to re-cut it.
   - Wanting tests, review, or a spec you can defend → `/project:graduate`.

## Failure modes

- **Builder can't run the thing.** Stop. The run command or the environment is wrong — `human-checkpoint`, don't paper over it with "the code looks right".
- **Builder reports success but the demo doesn't reproduce.** Hard stop (behavioral rule 3). Report it to the human explicitly, revert or re-open the slice, and re-dispatch only after establishing why the output didn't match.
- **Builder fails twice on the same mechanism.** Two-strike rule (behavioral rule 5). Tag the state, then `human-checkpoint` — and offer the cruder in-envelope version as one of the options.
- **The slice needs something outside the hardware envelope.** `human-checkpoint` per behavioral rule 20. Don't quietly add a cloud dependency.
- **Merge conflicts.** Follow `git-recovery`. If ambiguous, `human-checkpoint`.
- **Lost work after a container recycle.** Pushed commits survive. `git fetch origin proto/<slug> && git checkout proto/<slug>`. If it was never pushed, re-run from the last `[ ]` slice.

## What you do NOT do

- **No coding directly.** You dispatch the `builder`; you read files and run commands to verify.
- **No accepting an unverified claim.** You re-run the demo yourself (step 5). "The builder said it works" is not verification.
- **No tests.** This template has no suite. Wanting one is the signal to run `/project:graduate`.
- **No merging without the human's confirmation** (step 8).
