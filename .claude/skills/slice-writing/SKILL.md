---
name: slice-writing
description: How to cut a feature into slices — the smallest increments that can each be demonstrated by running one command. Use when creating an entity page, shaping work during /project:interview, or when a slice turns out to be too big to demonstrate. Trigger on "slices", "slice", "what should I build first", "entity behavior", "too big", "split this", "smallest version", "MVP boundary".
type: skill
---

# Writing Slices

Slices on an entity page are the prototype's spec. Each one is a promise you can keep in a single run. The rigorous track writes Behavior cases that become failing tests; here you write slices that become demonstrations — same discipline about being observable, far less ceremony about being exhaustive.

## Read first

- `docs/wiki/requirements.md` — slices must serve a stated user story; a slice nobody asked for is scope creep.
- Existing entity pages in the same area — match phrasing and granularity.
- `docs/wiki/architecture.md § Prototype constraints` — a slice that can only be shown on a big machine is the wrong slice.

## Shape of a slice

Each slice is **one thing you can show working, with one command**.

```
- [ ] S<N>: <observable outcome> — demo: `<command>`
```

Good:

- `- [ ] S1: The server starts and answers /health with ok — demo: \`make run\` then \`curl -s localhost:8000/health\``
- `- [ ] S2: Posting a CSV stores its rows — demo: \`curl -F file=@sample.csv localhost:8000/upload\` then a row count query`
- `- [ ] S3: The rows page lists what was stored — demo: open \`localhost:8000/rows\` and read the table`

Bad:

- `- [ ] S1: Build the upload feature.` (no observable outcome, no command)
- `- [ ] S2: Uploads work reliably at scale.` (can't be shown on one box in one run)
- `- [ ] S3: Parse, validate, store, and display the CSV.` (four slices — and nothing to show until all four land)

## Rules

1. **Name the demo command in the slice.** If you can't, you don't have a slice yet. This is the whole discipline.
2. **One run, one outcome.** "And" in the outcome means split.
3. **Vertical, not horizontal.** "The whole upload path, hardcoded and ugly" beats "a complete, general parser with nothing calling it". A prototype slice must reach the surface where a human can see it.
4. **Sequence by demonstrability.** S1 is whatever makes the thing start. Each later slice should be demonstrable *given* the earlier ones, without waiting on a later one.
5. **Happy path first, and often only.** Error handling is its own slice, written only when the human says the failure mode matters. Everything you skip goes in `## Shortcuts`.
6. **No implementation language.** "Calls `parse_csv()`" is how, not what. Say what the operator observes.
7. **Ugly is allowed; unshowable is not.** Slices are allowed to assume hardcoded input, a single user, and no persistence between runs — as long as each is declared.

## Slice states

The `builder` flips these; this notation is the single source of truth (`build-loop` and `wiki-update` refer back here).

- `[ ]` — planned, not built.
- `[~]` — being built, or built but **not yet demonstrated** (including "couldn't run it — blocker recorded").
- `[x]` — demonstrated: a command was run, real output was observed, and both are recorded under `## Demonstrations`.

A slice never goes `[x]` on the strength of reading the code (behavioral rules 2–3). It never moves backwards either — if the behavior changes, append a new slice and strike the old one with a one-line pointer.

## Numbering

`S1`, `S2`, … unique within the entity page. Never renumber; append at the end. The number is referenced by commits, demonstrations, and the graduation export.

## How many slices to write at once

Three to six. A prototype's spec is meant to be rewritten as you learn — writing twenty slices up front bakes in guesses you haven't tested yet. When the last one is `[x]`, write the next few from what you now know.

## After writing slices

- Update the entity's `updated:` frontmatter.
- Add a todo in `docs/wiki/todos.md` for the first unbuilt slice (or the group of them).
- If a slice implies a capability the requirements don't mention, update `docs/wiki/requirements.md` — don't let the spec drift below the code.

## Anti-patterns

- **Slices without a demo command.** The one rule that matters.
- **Horizontal slices.** A layer with nothing calling it can't be demonstrated, so it can't be finished.
- **Exhaustive error cases.** This is a prototype; enumerate failures only when the human says a failure mode is the point.
- **Renumbering.** Keep numbers stable; insertions go at the end.
- **Slices as tasks.** "Refactor the store module" is a todo, not a slice — slices are things an operator can watch happen.
