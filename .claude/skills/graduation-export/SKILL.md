---
name: graduation-export
description: How to compile the prototype's wiki into a single self-contained handoff markdown file that /project:init in a full-workflow (TDD) repo can read as its source material. Use when the prototype has proven the idea and the work should restart with rigor. Trigger on "graduate", "handoff", "export the wiki", "move to the real workflow", "hand this to the full template", "promote the prototype".
type: skill
---

# Graduation Export

Produces **one file**: `docs/graduation/<project>-handoff.md`. That file is the entire deliverable — the receiving repo gets nothing else, so anything not in it is lost. It is written to be read by `/project:init` in the rigorous template, whose interview walks a fixed topic list; this document answers that list in order so init can mark each topic *covered* instead of re-asking the human.

## Read first — the sources you compile

- `docs/wiki/requirements.md` — vision, users, stories, out of scope, open questions.
- `docs/wiki/architecture.md` — stack, layout, data, prototype constraints.
- `docs/wiki/entities/*.md` — every page: `## Slices`, `## Demonstrations`, `## Shortcuts`, `## Boundaries`.
- `docs/wiki/decisions/*.md` — ADRs worth carrying.
- `docs/wiki/gotchas.md` — every entry travels; these were paid for.
- `docs/wiki/log.md` — for dates and what was actually attempted.
- `git log --oneline` — the real build order, which often disagrees with the wiki's tidy version.

## The two translations that matter

1. **Slices → draft Behavior cases.** A slice is "one thing I showed working"; a Behavior case is "one thing a test asserts". Convert each `[x]` slice into one or more `- [ ] B<N>: When <condition>, <subject> <observable outcome>.` lines, and *split as you go* — the happy-path slice `S2: posting a CSV stores its rows` becomes B-cases for the valid CSV, the malformed CSV, and the empty file. Mark which came from a demonstration and which you inferred; the receiving repo must know that only the first kind was ever observed.
2. **Shortcuts → todos with a priority.** Every `## Shortcuts` line becomes a work item in the handoff's backlog, tagged with what it would take to make real. This is the load-bearing section: it is the prototype's honest account of its own debt, and skipping it hands the next repo a codebase that looks finished and isn't.

## Document template

~~~markdown
---
name: <project>-handoff
description: Prototype handoff — feed to /project:init in a full-workflow repo.
type: raw-transcript
source_repo: <git remote or path>
source_commit: <sha>
updated: YYYY-MM-DD
status: final
---

# <Project> — Prototype Handoff

> Compiled by `/project:graduate` from a rapid-prototyping repo. **No automated test
> ever ran against this code.** Everything below marked *demonstrated* was observed
> running once, by hand, on a single modest machine; everything marked *inferred* was
> not. Treat this as source material for the interview, not as a verified spec.

## How to use this file

Run `/project:init <path-to-this-file>` in the full-workflow repo. Topics 1–10 below map
to that command's interview checklist; the entity sections seed `docs/wiki/entities/`;
the shortcut ledger seeds `docs/wiki/todos.md`.

## 1. Vision
## 2. Users
## 3. User stories
<in `As a <user>, I want <capability>, so that <benefit>` form, with the acceptance
check that the prototype actually demonstrated, where one exists>
## 4. Out of scope
## 5. Stack as prototyped
<what was used, and — flagged clearly — which choices were made for prototype
convenience and should be re-decided under real requirements>
## 6. Testing
<"none — no suite exists" plus what the natural first test targets are>
## 7. Data
## 8. External services
## 9. Deployment as prototyped
## 10. Non-functional — what is actually known
<only numbers observed while running it: startup time, request latency on the box,
dataset size handled. Say "unknown" everywhere else; do not extrapolate.>

## Entities

### <entity-slug>
**Essence:** <one or two sentences>
**Draft Behavior cases:**
- [ ] B1: When …, … . *(from S2, demonstrated YYYY-MM-DD)*
- [ ] B2: When …, … . *(inferred — never exercised)*
**Implementation as prototyped:** <files, entry points>
**Known boundaries:** <what it can't do>

## Shortcut ledger — the debt this prototype is carrying

| # | What is faked | Where | To make it real |
|---|---|---|---|
| 1 | … | `src/…` | … |

## Gotchas carried forward
<verbatim from gotchas.md — these were paid for once already>

## Decisions worth keeping
<ADR summaries; one or two lines each, with the ones that were convenience-only marked>

## Open questions
<from requirements.md, plus every product question the prototype raised and never answered>

## What was demonstrated, and what was not
<a flat list: each entity's slices with `[x] demonstrated <date>` or `[~] never ran — <blocker>`.
The receiving repo should trust nothing on the second list.>
~~~

## Steps

1. **Branch** (`docs/graduate-<date>`) before writing anything — the file is a tracked write (behavioral rule 19).
2. **Compile the sources** into the template above. Fill every heading; where the prototype has nothing, write `unknown` or `not addressed` — never invent, never leave a heading dangling.
3. **Audit the honesty markers.** Walk every entity page: each slice is either `[x]` with a real demonstration underneath it or it is *not* demonstrated, whatever the wiki claims. Anything you cannot corroborate goes on the "not demonstrated" list.
4. **Sanity-check the file standalone.** Read it as if you had never seen the repo. If a section only makes sense with the code open, rewrite it — the receiving repo will not have the code.
5. **Flatten the links.** Wikilinks won't resolve in the destination repo: replace `[[entities/foo]]` with the section name inside this document. Keep external URLs.
6. **Write to `docs/graduation/<project>-handoff.md`**, commit, push, and tell the human the exact next command to run in the other repo.

## Anti-patterns

- **Exporting the wiki verbatim.** A pile of pages with broken links is not a handoff. One self-contained file, or nothing.
- **Laundering the prototype's status.** Never let an inferred behavior read like a demonstrated one, and never quietly drop the shortcut ledger because it makes the work look unfinished. It *is* unfinished — that's what graduation is for.
- **Carrying prototype convenience forward as a requirement.** "Uses SQLite" was an envelope decision, not a product decision. Flag it as re-decidable.
- **Omitting the gotchas.** They're the cheapest thing in the export and the most expensive to rediscover.
