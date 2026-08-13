---
name: build-loop
description: Scope → build → run → record → commit procedure for this prototype. Use before writing any code for a slice, and whenever a slice needs to be demonstrated. Trigger on "build loop", "next slice", "make it run", "demonstrate", "smoke check", "does it work", "show it working", "prove it runs".
type: skill
---

# Build Loop — Scope, Build, Run, Record

This replaces the TDD loop. There is no test suite; the evidence is the run. One slice → one run → one commit.

## Read first

- `docs/wiki/entities/<slug>.md` — `## Slices` (the contract), `## Shortcuts` (what's already faked under you).
- `docs/wiki/commands.md § Run` — the command that starts this thing.
- `docs/wiki/gotchas.md` — short, all live.
- `docs/wiki/architecture.md § Stack` + `§ Prototype constraints` — before any new file or dependency.

## Steps

1. **Scope the slice in one sentence, naming the demo command.**
   `S3: uploading a CSV stores its rows — demo: \`curl -F file=@sample.csv localhost:8000/upload && sqlite3 data.db "select count(*) from rows"\``
   If you cannot name the command that will show it working, stop and split the slice (`slice-writing`).

2. **Mark it `[~]`** on the entity page before you start. If the session dies mid-slice, `[~]` is what tells the next agent where you were.

3. **Build the smallest thing that makes that command produce the right output.** Hardcode everything that is not the point of this slice — credentials, sample data, layout, error paths. Note each fake as you make it; you will write them into `## Shortcuts` in step 5. Don't generalize, don't add config knobs, don't handle the second case yet — that's another slice.

4. **Run it. Actually run it.**
   - Start the thing with the `## Run` command, exercise the path, capture the output.
   - Read the output yourself. Compare it to what the slice claimed.
   - **It failed?** Fix and re-run. A partial success is a failure. If it fails twice on the same mechanism, stop — two-strike rule (behavioral rule 5).
   - **You couldn't run it** (needs a credential, a device, a network you don't have)? Say so, leave the slice `[~]`, record the blocker on the entity page, and tell the human. Never write down output you did not see (behavioral rule 3).

5. **Record the evidence in the wiki, same change as the code:**
   - Tick the slice `[~]` → `[x]`.
   - Append to `## Demonstrations` — a `### S<N> — <date>` heading, then a fenced block holding the exact commands and their real output:

     ~~~markdown
     ### S3 — 2026-08-13

     ```
     $ curl -F file=@sample.csv localhost:8000/upload
     {"stored": 42}
     $ sqlite3 data.db "select count(*) from rows"
     42
     ```
     ~~~

     Trim long output to the lines that carry the proof; never paraphrase it into prose.
   - Append one line per fake to `## Shortcuts`: what is faked, and what making it real would take.
   - Update `## Implementation` if new files appeared.

6. **Commit and push.** One commit: code + entity-page tick + demonstration + shortcut lines.

   ```bash
   git add <paths> docs/wiki/entities/<slug>.md
   git commit -m "feat(<slug>): S3 — store uploaded CSV rows"
   git push -u origin "$(git branch --show-current)"
   ```

7. **Next slice.** Re-read `## Slices` and repeat. Before finishing a work session, run the `## Run` command once more to confirm the prototype still starts.

## When the demo command doesn't exist yet

The first slice of a new prototype has no `## Run` command to lean on — building it *is* the slice. Keep it that shape: slice S1 is "the thing starts and says hello", its demo is the start command, and its commit records that command in `docs/wiki/commands.md § Run`. Everything after it has a working front door to hang off.

## Anti-patterns

- **Building three slices, then running once.** You lose the mapping from failure to cause, and the commits can't be reverted independently.
- **"It should work now."** Not a demonstration. Run it.
- **Pasting invented output.** The one unrecoverable failure in this template.
- **Fixing the slice text to match what you built.** If the build diverged from the slice, either finish the slice or rewrite it deliberately and say so — don't quietly retarget.
- **Undeclared hardcoding.** Hardcode freely, declare all of it (behavioral rule 12).
- **Starting a test suite.** Wrong template. If you want tests, tell the human it's time for `/project:graduate`.
