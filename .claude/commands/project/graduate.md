---
name: graduate
description: Export the prototype as a single self-contained handoff markdown file, ready to feed to /project:init in a repo running the full TDD workflow. Compiles requirements, slices as draft behavior cases, assumed stack, the shortcut ledger, gotchas, and what was never demonstrated.
argument-hint: [emphasis or output path — e.g. "focus on the sync logic" | "docs/graduation/handoff.md"]
type: command
---

# /project:graduate

**Argument:** `$ARGUMENTS`

The argument either **names the output path** (anything ending in `.md`) or **steers the emphasis** (`focus on the sync logic`, `the UI is throwaway, don't carry it`). Emphasis changes what gets detail, never what gets omitted — the shortcut ledger and the not-demonstrated list are always complete. Empty → `docs/graduation/<project>-handoff.md`, everything included.

The prototype has done its job: you now know the idea works, roughly how, and where the bodies are buried. This command compiles all of that into **one file** you carry to a repo running the rigorous workflow. It does not convert this repo — the two tracks stay separate, and this repo remains a working prototype you can keep poking at.

## Preconditions

- At least one entity page with `[x]` slices. (Nothing demonstrated → nothing to hand off; say so and stop.)
- Working tree clean.

## Steps

1. **Branch** — `docs/graduate-<date>`, before the first write (behavioral rule 19).

2. **Run `/project:demo` first, and use its result.** A handoff whose "demonstrated" list is months stale is worse than none: a claim that no longer reproduces must be reclassified before it is exported, not after the receiving repo trusts it. Anything now `broken` or `drifted` moves to the not-demonstrated list with what you actually observed.

3. **Compile the handoff** per the `graduation-export` skill — it owns the document template and the two translations:
   - **slices → draft Behavior cases**, split into the error and edge cases a test suite will need, each marked *demonstrated* or *inferred*;
   - **shortcuts → a debt table**, each with what making it real would take.

   Fill every heading. Where the prototype has nothing, write `unknown` — never invent, never leave a heading dangling.

4. **Flatten it.** Replace `[[wikilinks]]` with in-document section references; the destination repo has none of these pages. Read the file as a stranger with no access to the code — anything that only parses with the source open gets rewritten.

5. **Write, commit, push:**

   ```bash
   git add docs/graduation/
   git commit -m "docs(graduate): export prototype handoff"
   git push -u origin docs/graduate-<date>
   ```

   Append a `## [YYYY-MM-DD HH:MM] graduate` entry to `docs/wiki/log.md` in the same commit — entities exported, slices carried, shortcuts listed, and how many claims step 2 downgraded.

6. **Hand it over.** Tell the human, precisely:
   - where the file is,
   - the exact next move: clone the full-workflow template into a **new** repo, drop this file in, and run `/project:init <path-to-handoff>` — it reads the file as covered source material and interviews only the gaps,
   - the honest headline: how many behaviors were actually demonstrated versus inferred, and how many shortcuts are in the ledger. That number is what the next repo's first sprint is made of.
   - that this repo keeps working as a prototype; nothing here was converted or deleted.

## Failure modes

- **Nothing demonstrated.** Stop and say so — run `/project:work` or `/project:demo` first.
- **Slices claimed `[x]` that step 2 can't reproduce.** Not a blocker: downgrade them, and say plainly in the report how many you downgraded. That discrepancy is exactly what the receiving repo needs to know.
- **The wiki and the code disagree.** The code wins for "what exists", the wiki wins for "what was intended" — carry both, flagged as a conflict in the open-questions section.

## What you do NOT do

- **No converting this repo.** No test suite, no `develop` branch, no rewriting `.claude/` here.
- **No polishing the story.** An inferred behavior never gets written as a demonstrated one, and the shortcut ledger is never trimmed for looking bad (behavioral rule 12).
- **No exporting a pile of files.** One self-contained document, or the handoff has failed.
