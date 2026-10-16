---
aliases: [Shell commands, Test command]
type: reference
domains: [software]
status: stub
sources: []
contradicts: []
open_questions: []
created: 2026-04-15
updated: 2026-10-16
---

# Commands

> [!abstract] Essence
> The exact shell commands that work in this repo — install, run, test, lint, build. Keep entries copy-pasteable.

## Install

`<TBD>`

## Run (dev)

`<TBD>`

## Test

> Required for `/project:work` — `/project:work` precondition checks fail if this is `<TBD>`. Keep it one plain command line: it is allowlisted verbatim in `.claude/settings.json`, which is what lets every role run it (`/project:init` step 5a).

`<TBD>`

## Test (focused)

> Runs only the named test files; `<paths>` stands for them. `/project:work` proves each Behavior case with it (Green and Red) and runs the full [[commands#Test]] once when the case loop closes (`subagent-dispatch § Close the case loop`). Leave `<TBD>` while the full suite takes a few seconds: every focused run is then the full suite. Its words before `<paths>` are allowlisted like the test command.

`<TBD>`

## Architecture

> The command that fails when an import breaks [[architecture#Layers]]. Must be one plain command line — it is allowlisted verbatim in `.claude/settings.json`, which is what lets every role run it. Prove it fires before trusting it (`/project:init` step 5b).

`<TBD>`

## Lint

`<TBD>`

## Format

`<TBD>`

## Build

`<TBD>`

## Notes

_(Anything non-obvious about running these — env vars, prerequisites, OS differences.)_
