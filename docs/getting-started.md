# Getting Started

A worked walkthrough of the prototyping loop: `/project:init` → `/project:interview` → `/project:work` → `/project:demo` → `/project:graduate`. Read [`HUMAN.md`](../HUMAN.md) first if you haven't — it's the short version of what you're signing up for.

Throughout, the running example is a small thing you'd actually build on a box in a cupboard: **a service that ingests CSV exports and lets you query them from a browser**.

---

## 0. One-time setup

```bash
git clone <this-template> csv-box
cd csv-box
rm -rf .git      # the template's history isn't yours; /project:init re-inits git
claude
```

Optional but recommended: open `docs/wiki/` as an Obsidian vault in a second window. Everything the agent learns lands there, and the graph view shows how it connects.

---

## 1. `/project:init` — get something that starts

```
/project:init
```

or, if you already wrote some notes:

```
/project:init read my ideas in notes.md
```

What happens:

1. **Git.** Initializes on `main` if this isn't a repo yet, keeps the shipped `.gitignore`, makes the first commit. There is no `develop` branch in this template.
2. **Reads the ground.** Existing manifests, what runtimes are installed, anything the argument pointed at.
3. **Interviews you — about the product only.** Six questions, one at a time, each with a recommended answer you can just accept: what is this, who operates it, what must it do, what must it *not* do, what's the thinnest runnable version, and what would make you throw it away. It will not ask you about languages, frameworks, or databases.
4. **Picks the stack silently.** Under the `stack-assumption` skill and the hardware envelope: one process, a file-backed store, few dependencies, no orchestration, nothing that needs a beefy machine. It writes the choice into `architecture.md § Stack`.
5. **Scaffolds the wiki** with real content from your answers — requirements, architecture, the first entity page with three to six slices.
6. **Bootstraps a front door** — the manifest, the source layout, and an entry point that actually starts. Then it *runs it* and pastes the output.
7. **Rewrites `CLAUDE.md`** for your project and commits everything.

What you get back is a report that begins with what it assumed:

> Assumed: Python 3.11 + FastAPI, SQLite at `data/csv-box.db`, config in `.env`, started with `make run`. All single-process, no server to install, deletable by removing one file. Overrule any of it and I'll change it.
>
> Verified: `make run` → `INFO: Uvicorn running on http://127.0.0.1:8000`, `curl localhost:8000/health` → `{"status":"ok"}`.

**Your move:** skim the assumptions. If one is wrong ("actually it has to be a CLI, not a web app"), say so now — it's cheap here and expensive in three slices' time.

---

## 2. `/project:interview` — find the holes

```
/project:interview the ingest logic
```

This is where prototypes are won or lost. The feature list is the easy half; the interview spends its time on the half that sinks things:

- What's the input *really* — how big, how messy, how often?
- What happens on the empty file? The duplicate upload? The malformed row halfway down?
- What if it's interrupted? Run twice by accident?
- What has to survive a restart?
- How will you know it worked?

One question at a time, each with the agent's recommendation so you can react instead of composing. Every question is written to `docs/raw/interviews/<date>-ingest-logic.md` **before** it's asked, and your answer the moment you give it — so if the session dies, the transcript is intact.

Each gap it finds becomes one of two things, never nothing:

- a **slice** on the entity page (you care, it gets built), or
- a **declared shortcut** (you don't care yet — recorded as "not handled" so nobody mistakes it for handled).

It stops when it can cut three to six demonstrable slices — not when it has asked everything. The prototype answers the rest by running.

Afterwards the wiki is updated, todos are filed, and the whole thing is committed to a `docs/interview-<slug>` branch.

---

## 3. `/project:work` — build a slice, run it, prove it

```
/project:work
```

The core loop. `/project:work` takes the top todo, opens `proto/<slug>`, checks the slices actually name a demo command, and dispatches the `builder` for **one to three slices**.

For each slice the builder:

1. **Scopes it** — restates it as one sentence naming the command that will demonstrate it. Can't name the command? The slice is wrong; it gets split.
2. **Marks it `[~]`** so an interrupted session leaves a trail.
3. **Builds the smallest thing** that makes that command produce the right output. It hardcodes anything that isn't the point of this slice.
4. **Runs it.** Actually runs it. Reads the output. If it fails, it fixes and re-runs; twice on the same mechanism and it stops and asks you.
5. **Records the evidence** — ticks the slice `[x]`, pastes the exact command and real output into `## Demonstrations`, and writes every fake into `## Shortcuts`.
6. **Commits and pushes** — code, tick, demonstration, shortcuts, together, one commit per slice.

Then `/project:work` **re-runs the demonstrations itself** to check them, confirms the prototype still starts, verifies the shortcut ledger matches what the diff actually hardcodes, logs the cycle, and shows you the output.

Finally it asks the question that is this template's entire review process: *does this do what you wanted?*

- **Yes** → it merges `proto/<slug>` into `main` with `--no-ff` and pushes.
- **Not quite** → it stays on the branch and takes your correction as the next slice.

An entity page mid-flight looks like this:

~~~markdown
## Slices

- [x] S1: The server starts and answers /health — demo: `make run`, `curl localhost:8000/health`
- [x] S2: Posting a CSV stores its rows — demo: `curl -F file=@sample.csv localhost:8000/upload`
- [~] S3: Rows page lists what was stored — demo: open localhost:8000/rows
- [ ] S4: Malformed rows are skipped and counted — demo: `curl -F file=@broken.csv …`

## Demonstrations

### S2 — 2026-08-13

```
$ curl -F file=@sample.csv localhost:8000/upload
{"stored": 42}
$ sqlite3 data/csv-box.db "select count(*) from rows"
42
```

## Shortcuts

- CSV delimiter hardcoded to `,` — real version sniffs it.
- No auth; any caller is the operator — real version needs a token at the entry point.
- Whole file read into memory — fine at 42 rows, not at 4M.
~~~

That's the prototype in one screen: what's planned, what's proven, what's fake.

---

## 4. `/project:demo` — does the whole thing still work?

```
/project:demo
```

Read-only. It runs the `## Run` command, then replays every recorded demonstration and compares real output to recorded output, classifying each slice **works / drifted / broken / unrunnable**. You get a table, most-broken first, with the real error text for anything that isn't `works`.

It fixes nothing — that's the point, its report isn't biased by having just edited the code. Broken slices become P0 todos; drifted ones P1.

Run it after a few cycles, before showing anyone, and always before graduating.

---

## 5. `/project:graduate` — hand it to the real workflow

```
/project:graduate
```

When the prototype has answered its question and you want tests, review, and a spec you can defend:

1. It runs `/project:demo` first — a handoff whose "demonstrated" list is stale is worse than none, so anything that no longer reproduces gets downgraded before export.
2. It compiles **one self-contained file**, `docs/graduation/<project>-handoff.md`, containing: vision, users, stories, out-of-scope, the stack (with convenience choices flagged as re-decidable), what's actually known about performance, per-entity **draft Behavior cases** translated from slices and split into the error cases a test suite will need, each marked *demonstrated* or *inferred* — plus the full shortcut ledger as a debt table, the gotchas, the open questions, and an honest list of everything that was never run.
3. Wikilinks are flattened, because the destination repo has none of these pages.

Then: clone the **full-workflow** template into a new repo, drop the file in, and run

```
/project:init docs/idea/csv-box-handoff.md
```

It reads the handoff as covered material and only interviews you about the gaps — then you're in the TDD track, with a spec built from things that actually ran.

This repo is untouched and still works. The two tracks stay separate on purpose.

---

## Scenario: adding a feature to an existing prototype

1. `/project:interview the export feature` — grill the logic, cut slices, file todos.
2. `/project:work` — build the first slice, run it, show you.
3. Repeat `/project:work` until the entity's slices are `[x]`.
4. Confirm the demo; it merges to `main`.

## Scenario: something that used to work is broken

1. `/project:demo` — find out what actually broke and get the real error.
2. It files the broken slices as P0 todos.
3. `/project:work` — it opens `fix/<slug>`, repairs, **re-runs the original demonstration**, and updates the record.

## Scenario: the agent got stuck

Two failed attempts on the same mechanism and it stops (behavioral rule 5). It tags the state, shows you both attempts, and offers options — usually including *a cruder version, declared as a shortcut*, which in a prototype is very often the right answer. If you'd rather reset:

```bash
git reset --hard checkpoint-<stamp>
```

Then `/project:interview` to reshape the slice before trying again.

## Scenario: you want it to use something specific

Just say so — "use Postgres, I already run one" or "this needs to be a CLI". A stated fact binds the agent: it records it as a given in `architecture.md` and stops choosing for itself on that point. The agent only picks when you haven't.

## Scenario: it wants to reach outside the envelope

The feature genuinely needs a GPU, a cluster, or a paid API in the hot path. It stops and tells you what breaks, what the cheapest approximation inside the envelope would be, and lets you choose. It never quietly adds the dependency.

## Scenario: ingesting a document

```
/project:wiki-ingest docs/raw/vendor-api.pdf
/project:wiki-ingest search for CSV sniffing heuristics
```

The first ingests a file into a summary page; the second dispatches the `researcher`, which writes to `docs/raw/research/` and then ingests that. Both cross-link into the wiki.

## Scenario: checking where you are

```bash
git log --oneline -10          # one commit per demonstrated slice
git status
```

plus `docs/wiki/todos.md` (what's next), `docs/wiki/log.md` (what happened), and any entity page's `## Slices` (what's proven).

---

## Command → when to use

| Command                | Use it when                                                            |
| ---------------------- | ---------------------------------------------------------------------- |
| `/project:init`        | Starting a prototype, or recovering a broken wiki layout               |
| `/project:interview`   | Before building anything non-obvious; when you can't name the slices   |
| `/project:work`        | The default action. Builds the next slice                              |
| `/project:demo`        | After a few cycles; before showing anyone; before graduating           |
| `/project:graduate`    | The idea is proven and you want rigor                                  |
| `/project:agent-scout` | The stack has settled and the builder keeps improvising the same thing |
| `/project:wiki-ingest` | You have a document or a topic to research                             |
| `/project:wiki-lint`   | `wiki-todos.md` is piling up, or the wiki feels stale                  |

## Where to look when something's wrong

| Symptom                                        | Look at                                                        |
| ---------------------------------------------- | -------------------------------------------------------------- |
| "It says it works but it doesn't"              | The entity page's `## Demonstrations`. No output = not done. Run `/project:demo` |
| Agent asked you about a framework              | Behavioral rule 6 violation — tell it to decide and record it   |
| Agent added a cloud service                    | Behavioral rule 20 — it owed you a checkpoint first             |
| The prototype does something undocumented      | `## Shortcuts` is incomplete; ask it to reconcile the ledger    |
| You've lost track of what's real               | `/project:demo`, then read the shortcut ledgers                 |
| Backlog is huge, you keep wanting tests        | That's the graduation signal — `/project:graduate`              |
| Wiki links broken, pages duplicated            | `/project:wiki-lint`                                            |
