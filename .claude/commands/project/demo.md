---
name: demo
description: Run the prototype end to end as it currently stands and report what actually works, slice by slice, against what the wiki claims. Read-only — it never fixes what it finds.
argument-hint: [scope — e.g. "the upload path" | "entities/ingest" | "just check it starts"]
type: command
---

# /project:demo

**Argument:** `$ARGUMENTS`

The argument **narrows what you run**: an entity slug, a path through the app, or a single slice. Empty → every `[x]` slice in the wiki, in dependency order.

This is the prototype's health check and the answer to "does the thing still work?". It is **read-only**: it runs, observes, and reports. It fixes nothing, commits nothing, and ticks nothing.

## Preconditions

- `docs/wiki/commands.md § Run` is not `<TBD>`.
- Working tree may be dirty — you're reporting on what's on disk right now, which is the point.

## Steps

1. **Collect the claims.** Read every `docs/wiki/entities/*.md` in scope: each `[x]` slice and its recorded demonstration command. That list is what you're auditing.

2. **Start it.** Run the `## Run` command. Record what happened — including startup time and anything it printed that looks wrong.

3. **Run each demonstration in order.** For each `[x]` slice, execute the exact command recorded under `## Demonstrations` and compare the real output to the recorded output. Classify:
   - **works** — matches, allowing for timestamps, IDs, and ordering.
   - **drifted** — runs but produces different output than recorded.
   - **broken** — errors, hangs, or produces nothing.
   - **unrunnable** — needs something you don't have (credential, device, network). Not a failure of the code; say what's missing.

4. **Note the `[~]` slices.** Anything built but never demonstrated is reported as such, with its recorded blocker. Do not try to finish it.

5. **Report** — a table, most broken first:

   | Slice | Claim | Result | Observed |
   | --- | --- | --- | --- |
   | ingest S2 | stores CSV rows | works | `{"stored": 42}` |
   | ingest S3 | lists stored rows | drifted | empty table, 200 OK |

   Then, in prose: what's actually usable end to end right now, and what isn't. Paste the real output for anything that isn't `works` — the error text is the finding.

6. **File, don't fix.** Every `drifted` or `broken` slice becomes a todo line in `docs/wiki/todos.md` at P0 (broken) or P1 (drifted). If filing todos is all this command changed, commit them on a `chore/demo-<date>` branch and push (behavioral rule 19); otherwise nothing to commit. Then tell the human which `/project:work` invocation would fix the top one.

## What you do NOT do

- **No fixing.** Not even a one-liner. This command's value is that its report is unbiased by having just edited the thing.
- **No ticking slices.** Only the `builder` moves a slice to `[x]`, and only from a run it performed itself.
- **No inventing output.** Same rule as everywhere: paste what you saw (behavioral rule 3).
