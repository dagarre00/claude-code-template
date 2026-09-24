---
name: gotcha-recording
description: How to capture a project-specific failure mode in docs/wiki/gotchas.md so the next agent avoids it. Use right after being burned by something non-obvious that others will hit. Trigger on "gotcha", "burned by", "footgun", "got bitten", "edge case", "surprising behavior".
type: skill
---

# Recording a Gotcha

A gotcha is a project-specific trap that would burn the next agent. Generic discipline issues belong in `.agents/rules.md`; project traps go in `docs/wiki/gotchas.md`.

## When

Record it when, this session, you spent real time on a problem with a surprising cause, a passing test masked broken behavior, a tool or library quirk specific to this setup bit you, a config file or env var had non-obvious effects, or two wiki pages contradicted each other in practice.

Not for general language or framework facts, one-off typos, or anything the existing docs already say.

## Procedure

1. Append an entry under the most relevant section of `docs/wiki/gotchas.md` — under `## Critical` if it is severe (silent data corruption, a security risk):

   ```markdown
   ### <Short, scannable title>

   **When:** <the exact situation that surfaces it>
   **Symptom:** <what you saw>
   **Cause:** <what was actually happening>
   **Fix:** <what to do>
   **Related:** [[entities/<slug>]], [[concepts/<pattern>]]
   ```

   One paragraph per field at most — more is a concept page, not a gotcha. Impersonal voice ("Session fixtures leak state", not "I found…"). Link the entity that surfaces it. No known fix → `Fix: TBD` plus a wiki-todo. If the gotcha shows a wiki page is wrong, fix that page and add a `Why:` line here.
2. A gotcha that implies a missing skill or command → a line for `docs/wiki/wiki-todos.md`.
3. **Size check.** Count the entries (`**When:**` lines). At 20 or more, add the wiki-todo `- [ ] YYYY-MM-DD agent: gotchas.md has N entries — compact it during the next wiki health pass`. A long gotchas file is one nobody reads.
4. **Ship it with the change that discovered it**, never on its own: leave `gotchas.md` edited beside that case's test, code and entity page, and list it with them in your report.

Wiki-todo lines go in the file if it is yours to edit, otherwise under `Follow-ups:` in your report.
