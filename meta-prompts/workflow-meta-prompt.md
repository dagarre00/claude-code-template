# Meta-prompt — spec-driven agentic development workflow

> You are scaffolding a development workflow in a new project. It must run on any coding-agent harness (Claude Code, Codex, Gemini CLI, Antigravity, …) and on several at once: the conductor runs in one harness while each role runs in whichever harness the human assigns it, and a run started in one harness can be resumed from another. No role belongs to a harness: every harness carries every role and command, and which one runs a role is decided per dispatch. Everything harness-specific comes from a side prompt per harness (§3.4); this document never depends on a harness's tools. It gives you the **intent, components and invariants** of the workflow, not its text. Write every file from scratch, in your own words, sized to this project's domain. If what you build differs from another project built from this prompt, that is expected.

---

## 0. How to use this prompt

**The files.** This prompt comes with one side prompt per harness (`workflow-harness-<harness>.md`, §3.4) and a bootstrap prompt (`workflow-bootstrap-harness.md`) that writes a missing side prompt. They're inputs to the scaffold, kept in a template repo and copied into the new project or read by path. Nothing in the scaffolded workflow depends on them afterwards.

**Who runs it.** Any harness that can read and write files and run shell commands can run this prompt, once per project; the result is the same whichever one you use. Prefer the one with the strongest model available, since this is a one-time authoring job, and with the other harnesses' CLIs installed on the same machine. The scaffolding session:

- writes adapters for **every** harness in use, including the ones it isn't running in, from their side prompts;
- probes its own harness directly; it probes another harness through that harness's headless mode when its CLI is installed and the human allows it, and otherwise hands the human that side prompt's probe list to run there;
- leaves the project's `init` command (§8) for the human to run afterwards, from any harness.

1. **Load the harness side prompts** (§3.4). Ask which harnesses the project will use; any of them may run the conductor or any role (§4.5). Find each one's side prompt next to this file, and ask the human for any that are missing. Compare each harness's installed version with the version its side prompt was verified on.
2. **Ask about the domain** (§13): what is being built, who uses it, what "a test" means here, how much risk a defect carries, which models the team can use and at what cost. Keep it under ~8 questions, one at a time, each with a recommended answer.
3. **Propose a manifest** before writing anything: every file you plan to create, one line each, marked *core* or *optional*, with the adapter files for each harness listed separately. Get approval.
4. **Build only the core** plus the optional modules the human approved. Each optional module below names the failure it prevents. If the project hasn't had that failure yet, don't build it.
5. **Respect the budgets** (§2.3). They're the main defense against over-engineering, and they apply to you as you scaffold.
6. **Validate**:
   - every command, role, skill and `wf` subcommand you reference exists, and no file contradicts another;
   - every generated adapter matches its render (`wf adapters --check`), and each side prompt's probes pass;
   - a worker started cold in each harness with nothing but the bootstrap line (§4.3) finds everything it needs;
   - one dry run of a work cycle on paper, with the conductor in one harness and at least one role in another, finds no missing step, and neither does the same cycle with the harnesses swapped.

---

## 1. Principles

1. **The wiki is the spec.** Behavior is defined in `docs/wiki/` before it's coded. If the spec is wrong, fix the spec first, then the code, in the same commit.
2. **Tests come first, one behavior at a time.** Every production change starts as a failing test for one named behavior case.
3. **The conductor orchestrates and specialists execute.** The conductor dispatches roles with fresh, narrowly scoped context, in its own harness or any other, then verifies and commits their work. Roles never see the chat history or the conductor's reasoning.
4. **Nobody reviews their own work.** Review roles are read-only and separate from authoring roles.
5. **The human decides what the spec doesn't.** When the wiki is silent, stop and ask with a question, options and a recommendation. Never improvise silently.
6. **Verify before asserting.** Nothing is "done" until a command was run and its output read. Failures are reported verbatim.
7. **Do the smallest thing that works, in the code and in the process.** Ceremony scales with risk. A one-line fix doesn't get a planner, two reviewers and an ADR.
8. **Rules are earned and pruned.** Every rule traces to a real failure. A rule or component that hasn't fired in a long while is a candidate for deletion.
9. **The harness is a deployment detail.** Every procedure is written once, in plain markdown, against a few abstract operations: dispatch, wait, verify, ask. What a particular harness can do lives only in its adapter files and its harness note (§3).
10. **The file system is the bus.** Every dispatch is a brief file in and a result file out, whatever carried it, and run state lives on disk. That is what lets harnesses mix, and what lets any of them pick up a run another one started.
11. **The conductor's tokens are the scarcest resource.** It's usually the most expensive model in the run, and it touches every step. It fills in blanks and reads verdicts; scripts and workers write everything else (§5).

---

## 2. Guardrails against over-engineering

### 2.1 In the code the workflow produces

- **Simplicity ladder at Green:** is it needed at all? Is it already in the repo? The standard library? A platform feature? An installed dependency? One line? Only then write the minimum code. Anything skipped is noted as `skipped: X — add when Y`.
- **No speculative abstraction:** no interface with one implementation, no factory with one product, no config nobody asked for. An abstraction needs a second real use.
- **Architecture starts at the simplest shape** that fits (often flat) and is promoted only when a real boundary violation hurts. Promoting it is an ADR.
- **Deliberate shortcuts are marked**, not gold-plated. A shortcut gets a comment naming its ceiling and the trigger to revisit it.
- **Review findings aren't a to-do list.** Only defects a senior engineer would block a PR on get fixed. Style opinions are dropped, not filed.

### 2.2 In the process

- **Tiered ceremony:** every todo is *simple* (developer only) or *complex* (adds planning and diff review). Default to simple; the human or the spec promotes it.
- **No ledger that duplicates git.** Commit messages and PR bodies are the history. Add a separate timeline only if the project needs one git can't give.
- **Reviewers have a floor and a cap.** They report ranked findings above a severity floor, at most N per round, with a concrete failure scenario for each. No scenario, no finding.
- **Round caps.** A review loop runs a bounded number of rounds, then stops. Leftovers are recorded, not chased.
- **Two-strike pivot.** Two failures on the same mechanism mean you stop, checkpoint, and ask the human. No third attempt at the same idea.

### 2.3 Budgets

| Artifact | Budget |
| --- | --- |
| Root instructions (`AGENTS.md`) | Project facts (name, vision, stack, test command, wiki pointer), the role-detection line (§4.3) and the rules. ≤ 50 lines. |
| Rules | ≤ 12, each one or two lines plus its *why*. |
| Pointer adapter | A one-line pointer plus the metadata the harness requires. ≤ 10 lines. Generated adapters have no budget of their own: they are the canonical file plus harness frontmatter. |
| Harness note | ≤ 40 lines. |
| Harness side prompt | ≤ 200 lines. Scaffold input; not copied into the project. |
| Protocol | ≤ 80 lines. |
| Each command | ≤ 80 lines. |
| Each role | ≤ 40 lines. |
| Each skill | ≤ 60 lines, written as steps (read, do, verify), never as an essay. |
| Brief | ≤ 12 lines. |
| Result header | ≤ 15 lines. |
| `wf` output on success | ≤ 5 lines. |
| Conductor message to the human | ≤ 2 lines per step; final report ≤ 12 lines. |
| Roles at start | ≤ 4 core. |
| Skills at start | Only the ones a core command or role actually loads. |

If a file wants to exceed its budget, the procedure is probably doing too much: split it or cut it.

---

## 3. Anatomy

### 3.1 One canonical tree

Everything the workflow means lives in plain markdown that every harness can read. Nothing in it names a harness's tools.

```
AGENTS.md                  facts, rules, role detection; always loaded, in every harness
workflow/
  protocol.md              brief and result formats, transports, worker contract (§4)
  runners.md               harnesses in use, spawn permissions, optional preferences and overrides (§4.5)
  commands/<name>.md       conductor procedures, harness-neutral
  roles/<role>.md          purpose, tier, access, capabilities, what to read, what it never does
  skills/<name>/SKILL.md   procedures, loaded when their trigger matches
  harnesses/<harness>.md   one note per harness in use (§3.3)
  bin/wf                   the helper CLI the conductor drives (§5.2)
docs/raw/  docs/wiki/      spec and memory (§6)
.handoff/                  gitignored; one directory per run (§4)
<harness adapters>         derived from the files above (§3.2)
```

Write `wf` in a runtime that every team machine and every harness's shell can run (the project's own language if it has one), and avoid shell-specific quoting, so one invocation works from any harness on any OS.

**Canonical frontmatter** uses neutral keys only, with every string value quoted:

| File | Keys |
| --- | --- |
| Role | `name`, `description`, `tier` (strong / efficient), `access` (write / read-only), `capabilities` (shell, web), `skills` (canonical skill names, in reading order) |
| Skill | `name` (equal to its folder), `description` (the trigger), `audience` (conductor / worker / any), `invocable` (whether the human can call it by name) |
| Command | `name`, `description`, `argument-hint` |

Skills use the Agent Skills layout (`<name>/SKILL.md` with `name` and `description`) because several harnesses load it as is. Bodies never name a harness or its tools: they speak of roles, `wf` and the abstract operations.

### 3.2 Adapters

Each harness gets adapters derived from the canonical tree, in the first of these forms it supports:

1. **Reference:** the harness loads the canonical file in place, through a manifest or a path in its own config. Nothing is copied.
2. **Generated:** `wf adapters --write` renders the harness's file from the canonical file: the harness's own frontmatter, mapped from the canonical keys, the harness's tier map and any override in `runners.md` (model, effort, tools, permission mode), then the canonical body verbatim under a "generated from `<path>`; edit that file" line.
3. **Pointer:** a hand-written one-liner ("Follow `<canonical path>` with: <arguments>"), for a harness that can do neither.

- **Every harness carries everything.** Each harness in use gets an adapter for every role, every skill and every command, so any harness can be the conductor and any harness can run any role. Nothing in the scaffold ties a role to a harness. The only limit is capability, checked per dispatch: a harness without web access can't run the researcher.
- **One source of truth.** A role or skill is defined once, in `workflow/`. Generated adapters are build output: never edited by hand, and `wf adapters --check` (also run in CI) fails when one differs from its render or is missing for a harness in use.
- **Each harness has its own renderer.** The mapping from canonical keys to a harness's format comes from that harness's side prompt (§3.4). Adding a harness means adding a renderer, never another copy of the workflow.
- **Model and effort** in a harness's adapter for a role come from the override for that role and harness in `runners.md`, if there is one, and otherwise from the role's tier in that harness's tier map. After editing `runners.md`, run `wf adapters --write`, and restart any harness that loads agents only at startup.
- **Role skills** are mapped to the harness's own skill reference where it has one. The harness note records which transports load a role's body and skills by themselves, and `wf brief` lists in Read-first only what the transport won't load, so no worker reads anything twice.

### 3.3 Harness notes

One `workflow/harnesses/<harness>.md` per harness in use, written at scaffold time from that harness's side prompt, with the verified version and date at the top. It holds only what the running workflow needs:

- the tier map: strong and efficient to this harness's model names;
- the `launch:` line for a headless worker, which `wf brief` fills in;
- which transports load a role's body and skills without being told;
- how to dispatch natively, wait in the background, and ask the human;
- known limits: no web access, effort caps, restrictions it can't enforce.

The conductor reads only its own harness's note. When a harness changes, update its side prompt, its note and its renderer, and nothing else.

### 3.4 Harness side prompts

This prompt says *what* the workflow is. **Side prompts** say *where* it goes and *in what format* for one harness each. They sit next to this file as `workflow-harness-<harness>.md` (for example `workflow-harness-claude-code.md` and `workflow-harness-antigravity.md`).

- **Find them.** List the side prompts beside this file before proposing the manifest, and load one for every harness that will run the conductor or a role.
- **Missing.** If a harness in use has no side prompt, ask the human to provide one, or to run `workflow-bootstrap-harness.md` in that harness, which writes one for it. Have them approve the result before scaffolding, and keep it beside this file so the next project can reuse it.
- **Stale.** A side prompt names the version it was verified on. If the installed version differs, run the side prompt's probes before relying on it, and fix whatever fails in the side prompt itself.
- **Precedence.** A side prompt never adds a role, rule, step or skill. If a harness seems to need one, the gap belongs in this prompt, for every harness.
- **Adding a harness later** never re-runs this prompt. Bring that harness's side prompt (or bootstrap one), then use the toolkit-update skill (§9) to:
  - add the harness's renderer to `wf adapters`;
  - write its harness note;
  - list it in `runners.md`;
  - run `wf adapters --write`;
  - run its probes.

Every side prompt covers:

1. **Verified on:** the version, the date, and how to check the installed version.
2. **Instructions:** how the harness loads `AGENTS.md`, and the adapter for facts and rules, if one is needed.
3. **Adapter map:** for roles, skills, commands, permissions and hooks, the target path, the form (reference / generated / pointer), and how canonical keys and `runners.md` map onto the harness's frontmatter.
4. **Native dispatch:** whether it has subagents, how to dispatch and continue one, what comes back into the conductor's context, and when new adapters take effect.
5. **Spawn:** the headless launch line, with its model, effort and access flags, and how to tell a finished run from a cut-off one.
6. **Waiting and asking:** background runs and notifications, interactive questions, and the headless fallback (`checkpoint.md`).
7. **Permissions and read-only:** allowlists, read-only or sandbox modes, and what the harness can't enforce.
8. **Tier map:** strong and efficient to model names, for native frontmatter and for the launch line.
9. **Token notes:** what lands in the conductor's context, and how to keep it small.
10. **Gotchas and probes:** known traps, and the commands that prove each mapping works. These are acceptance checks at scaffold time.
11. **Harness note:** what goes into `workflow/harnesses/<harness>.md`.

**Progressive disclosure.** Facts and rules are always in context, so they stay short. Everything procedural loads on demand.

---

## 4. Dispatch protocol

Every dispatch, native or not, is the same exchange through `.handoff/<run>/`, where `<run>` is `<date>-<slug>` for the cycle. `workflow/protocol.md` defines it.

### 4.1 Brief: `<seq>-<role>.brief.md`

`wf brief` renders it; the conductor never writes one by hand. The conductor supplies Task, Inputs and Scope, and the script fills in the rest from `runners.md`, the role file and git:

```
---
run: 2026-10-30-auth
seq: 03
role: developer
access: write                        # or read-only
runner: <harness> · <model> · <effort>
base: <HEAD sha>
result: .handoff/2026-10-30-auth/03-developer.result.md
---
Read first: workflow/protocol.md § Worker, workflow/roles/developer.md and the skills it lists
Task: Implement B3 of [[entities/auth]]
Inputs: branch feat/auth; plan .handoff/2026-10-30-auth/plan.md
Scope: src/auth/**, tests/auth/**, docs/wiki/entities/auth.md
```

Read-first drops whatever the transport already loaded (§3.2): a worker whose adapter carries the role body and its skills isn't told to read them again. Inputs are paths and identifiers, never pasted content. A send-back is a new brief whose Inputs name the previous result and the failing log (`03-prove.log`), not their text. No conductor reasoning, opinions or expected answers.

### 4.2 Result: `<seq>-<role>.result.md`

The worker writes it: a fixed header the conductor always reads, then a body it reads only when it must.

```
---
status: done | partial | blocked
changed: [every path created, edited or deleted]
tests: [the case's test paths]             # developer
checks: <one line: what was run and what it showed>
commit: <proposed commit message>          # write roles
findings: <count by severity>              # reviewers
followups: <n>
questions: <n>
---
<body: findings with failure scenarios, follow-ups, questions, notes>
```

`wf await` prints only the header. It also reads the harness's own record of the run (the side prompt says where), and reports `partial` when the run was cut off or a tool was denied, even if the worker exited cleanly and claimed `done`. The conductor opens the body when `status` isn't `done`, when a count is non-zero, or when verification fails.

### 4.3 Worker contract (`protocol.md § Worker`)

In every harness and transport, the worker's whole prompt is one line: *"You are a workflow worker. Read `<brief path>` and follow it."* `AGENTS.md` carries the matching role detection: an agent handed a brief is a worker, and an agent asked to run a workflow command is the conductor.

A worker:

- reads the brief's Read-first list and Inputs, and only what its task needs beyond them;
- edits only within Scope, or nothing at all if read-only;
- runs no git writes and dispatches no other role;
- never opens other files in `.handoff/` unless its Inputs name them;
- writes its result file, and where its harness hands a final message back to the conductor (native subagents), returns only the header;
- hands follow-ups and questions back instead of acting on them.

### 4.4 Transports

A transport carries the brief to a worker. The protocol and the verification are the same for all three.

| Transport | When | How |
| --- | --- | --- |
| **native** | The runner chosen for this dispatch (§4.5) is the conductor's own harness, and that harness has native subagents | Dispatch the role's adapter with the bootstrap line |
| **spawn** | The chosen runner is another harness (or another model in the same one) with a headless mode, and `runners.md` allows spawning it | `wf brief` prints the launch line; the conductor runs it in the background with output to `<seq>-<role>.log`, which it doesn't read, and blocks on `wf await` |
| **manual** | Anything else: a GUI-only harness, no permission to spawn, or the human wants to watch | The conductor gives the human the brief path and the launch line, and waits for "done" |

Spawning starts paid agents unattended, so `runners.md` lists the harnesses the human allowed to spawn, and anything else falls back to manual. A spawned read-only role runs in its harness's read-only or sandbox mode where one exists.

### 4.5 Runners: chosen per dispatch

No role belongs to a harness. The **conductor** is whichever harness the human starts a command in, on whatever model that session runs. Each **dispatch** picks its runner (harness, model, effort) in this order:

1. **The run's context:** what the human said for this run or this dispatch (`work developer on antigravity`, `hand the adversary to claude-code`, `wf brief <role> --runner <harness>[:<model>]`).
2. **A standing preference** for the role in `runners.md`, if the human set one.
3. **The conductor's own harness**, dispatched natively. This is the default, and the cheapest to coordinate.

`workflow/runners.md` holds only:

- the harnesses this project uses, and which of them the conductor may spawn;
- optional standing preferences (role → harness);
- optional model and effort overrides per role and harness, for when a tier map's default doesn't fit.

The model comes from the override if there is one, and otherwise from the role's tier in the chosen harness's tier map. Role files declare only a tier and the capabilities they need (shell, write, web), so changing a preference or overriding a runner touches no role and no procedure. `wf brief` refuses a runner that lacks a capability the role needs.

*Recommended:* run reviewers on a different model family from the author's when one is available. Different models catch different defects, and mixing harnesses makes that cheap.

### 4.6 Trust is checked by git, not by the harness

Not every harness enforces a role's tools or write scope, so acceptance never depends on the harness that ran the worker:

- **Read-only role:** `HEAD` and every tracked file are unchanged.
- **Write role:** `HEAD` is unchanged and every changed path is within Scope (`wf scope`, against the brief's `base`).
- **Developer:** the conductor proves Green, the architecture check and Red itself (`wf prove`), never on self-report.

One writer per checkout at a time: `wf brief` refuses a write brief while another write brief in this worktree is unresolved. Read-only roles may run in parallel, in any mix of harnesses. Parallel writers each get their own worktree and their own run.

### 4.7 Run state and portable conductors

`.handoff/<run>/state.md` is a journal, one line per step, appended by `wf state`: the command, todo, branch, current case, the dispatch in flight, the last completed step, any pending checkpoint. A conductor in any harness resumes a run from `wf state` and `git status`, after accounting for every path in the tree. So the conductor can change harness mid-run: stop in one, resume in another.

**Checkpoints are on disk too.** An interactive conductor asks in chat and appends the answer to the state. A headless conductor writes `<run>/checkpoint.md` (question, options, recommendation), marks the state `waiting-human` and exits; the human answers in that file and resumes from any harness. Fast mode answers from recorded defaults, or ends the run.

**Cleanup:** once a dispatch is accepted or discarded, `wf clean` deletes its brief, result and log, so a later reviewer can't read the author's context. The run directory goes when the cycle's PR is opened.

---

## 5. Conductor token economy

The conductor is usually the most expensive model in the run and touches every step, so what it writes, and what it pulls into context, is the workflow's dominant cost. It decides and verifies; it doesn't compose or transcribe.

### 5.1 Conductor rules (in `protocol.md § Conductor`)

1. **Fill blanks, don't write documents.** `wf` renders briefs, run state, commit and PR text, and workers propose the rest. The conductor passes arguments, and accepts or edits one line.
2. **Paths, not content.** Never paste code, diffs, logs, test output or wiki text into a brief, a send-back, a checkpoint or a message.
3. **Verdict first, details on demand.** Read headers and verdicts. Open a body or a log only for a failure or a non-zero count, and then only its tail.
4. **Workers write the words.** The developer writes the code, tests, wiki tick and commit message. Reviewers write findings with their scenarios, and triage, if present, drafts dispositions. The conductor writes one disposition line per finding.
5. **No narration.** At most two lines to the human per step, and a final report from a fixed template. Never restate a brief, a plan or a result.
6. **Read once.** Don't re-read what's already in context. Load a skill only at the step that needs it.
7. **Block, don't poll.** Waiting on a worker is one blocking `wf await`, a harness notification, or the human's "done", never a loop of reads.
8. **Spend reasoning where judgment lives.** Checkpoints, dispositions and send-back decisions need thought; rendering, proving and committing don't. Where the harness allows it, run the conductor at a modest effort and keep deep reasoning in the planner and reviewers.
9. **Fresh context per cycle.** Run state is on disk, so start each cycle in a new conversation instead of carrying the last cycle's transcript.

### 5.2 `wf`, the helper CLI

A small script. Each subcommand prints at most 5 lines on success and writes anything longer to a log in the run directory.

| Subcommand | Does | Prints |
| --- | --- | --- |
| `brief <role> --task --inputs --scope` | Renders the brief; checks the writer lock and the runner's capabilities | The brief path and the launch line |
| `await <seq>` | Blocks until the result exists, with a timeout | The result header |
| `scope <seq>` | Compares the tree with the brief's `base` and Scope | `ok`, or the paths that break it |
| `prove <seq>` | Focused Green, architecture check, Red with the implementation set aside and the tests kept, tree restored | One line per check; on failure, the log path and its last ~20 lines |
| `commit <seq>` | Stages the result's changed paths and commits with its proposed message | The sha |
| `state [step note]` | Appends to the run journal, or prints its last lines | The last lines |
| `pr` | Assembles the PR body from the cycle's commits and the entity page, and opens the PR | The PR URL |
| `clean <seq>` | Deletes a dispatch's files | Nothing |
| `adapters --write \| --check` | Renders every generated adapter from the canonical tree, `runners.md` and the harness notes, or checks they match and that every pointer stays a pointer | `ok`, or the files that differ |

Build only the subcommands the core commands call. Each one costs less to test once than to have the conductor reproduce it in tokens every cycle. Prove `scope` and `prove` like any infrastructure, by planting a failure and seeing it caught.

---

## 6. The wiki

### 6.1 Two layers

- **`docs/raw/`** holds sources, and they're **immutable**: you add files, you never edit them. Interview transcripts, research documents, specs the human drops in. Every non-trivial claim in the wiki should trace back to a raw source.
- **`docs/wiki/`** holds the **compiled knowledge**: what the project is, how it's built, and what each feature must do. LLMs write and maintain it, humans read it, and it's Obsidian-compatible so it can be browsed as a graph.

### 6.2 Page families

- **Core spec pages** (one each):
  - *requirements*: vision, users, stories, functional and non-functional requirements, out of scope, open questions.
  - *architecture*: stack, layout, module boundaries and their dependency rule, data, external services, security, testing strategy, conventions, deployment.
  - *commands*: the verified install, test, focused-test and architecture-check invocations. `wf` reads them from here.
  - *git conventions*.
- **Entities** (one per feature or unit of behavior). The heart of the wiki. Each holds:
  - an essence line;
  - a **Behavior** checklist of observable cases (`B1`, `B2`, …) in When/Then form, each with a state: not started, test written and failing, passing;
  - where it's implemented and which test covers which case;
  - edge cases and limitations;
  - provenance.
- **Concepts**: shared patterns, cross-cutting ideas, and infrastructure specs. Infra concepts carry their own Behavior checklist of verifiable operational assertions.
- **Decisions**: ADRs for real design forks between reasonable alternatives (chosen, rejected, why). Not for every choice.
- **Summaries**: one digest per ingested raw source.
- **Reviews**: dated audit reports.
- **Ledgers**:
  - *todos*: the priority-ordered work queue, tagged `complex` / `infra` / `review-finding`.
  - *gotchas*: project-specific traps.
  - *wiki-todos*: the maintainer's inbox for deferred cleanup.
  - *log*: an optional timeline; see §2.2.

### 6.3 Page conventions

- **Filename is identity.** One page per concept, and alternate names go in `aliases`. Check aliases before creating a page.
- **Minimal frontmatter:** type, status (stub / developing / stable), sources, updated. Add more properties only when something queries them.
- **Wikilinks** connect pages, and a broken link is a bug. When a link target doesn't exist yet, create a stub in the same change.
- **Never invent to fill a gap.** Unknowns go into `open_questions` or to the human.
- **Inline vs queued:** small, local fixes (one ADR, one gotcha, the entity you're working on) happen in the same change. Cross-page cleanup (merges, contradictions, recurring patterns) is queued in `wiki-todos` for the maintainer.
- *Optional:* a richer ontology with typed relations between pages (implements, specializes, contrasts, depends-on, contradicts) and closed facet vocabularies. It pays off in knowledge-heavy domains and is overhead in most app projects.

### 6.4 Lifecycle

**interview** → raw transcript → requirements, entity Behavior cases and todos → **work** ticks cases and fills the implementation/tests sections → **health pass** reconciles drift, dedups, fixes links and drains the inbox.

---

## 7. Roles

Each role is defined by its **purpose, inputs, outputs, write scope, tier, capabilities, and what it never does**. A role names a tier (strong or efficient), never a model or a harness: whichever harness runs it maps the tier to a model (§4.5). Roles are leaves: they dispatch nothing, run no git writes, and answer with a result file (§4.2).

**Tiering:** use the strong tier for rare, high-leverage reasoning (planning, adversarial review, audits) and the efficient tier for per-cycle execution. The conductor runs on whatever model the human started its session with.

### Core

| Role | Purpose | Writes |
| --- | --- | --- |
| **developer** | Implements **one** Behavior case per dispatch: failing test, confirmed Red, minimal Green, refactor, ticks the case in the wiki, proposes the commit message. May record a gotcha or ADR it discovered. | The case's code and tests, its entity page, gotchas, decisions |
| **reviewer** (adversarial) | Reads a diff with **no** author context and hunts defects against the wiki: correctness, edge cases, security, spec drift, missing tests. Returns ranked findings, each with a concrete failure scenario. | Nothing (read-only) |
| **wiki-maintainer** | Ingests a raw source into the wiki, or runs the health pass. Run manually only. | `docs/wiki/` only |

### Optional (add when the named failure shows up)

| Role | Purpose | Prevents |
| --- | --- | --- |
| **planner** | Turns a complex or batched todo into a stepwise, one-test-per-step plan file in the run directory. | Developers thrashing on multi-case work |
| **plan reviewer** | Attacks the plan or todo **before** any test exists: ambiguity, missing cases, wrong layer, scope creep. | Building the wrong thing correctly |
| **triage** | Gives a second opinion on review findings and drafts a disposition for each: does it hold, what would a fix touch. Never decides. | Conductor bias, and conductor tokens spent writing dispositions |
| **auditor** | Periodic whole-repo review against the wiki for drift, missing tests, security and performance. Never part of the work loop. | Slow accumulated drift |
| **researcher** | Web research written up as one cited raw document. Never writes the wiki. Needs a runner with web access. | Ungrounded claims in research-heavy domains |

*Consolidation option:* the plan reviewer, the diff reviewer and the auditor can be one read-only role with three modes (brief / diff / repo), as long as it never reviews work it authored.

---

## 8. Commands

Commands are conductor procedures. They name abstract operations (dispatch, wait, verify, ask) and `wf` calls, never a harness's tool names, so any harness can run them. Each accepts free-text context that scopes the run (which todo, what to skip, a fact to record, `resume`). Context never bypasses preconditions, the failing-test step, or human checkpoints.

### Core

- **`init`** runs once per project:
  1. Check the workflow wiring: the canonical tree, the adapters for each harness in use (`wf adapters --check`), and each side prompt's probes.
  2. Detect the stack.
  3. Interview for what's missing. Don't re-ask what the scaffold already recorded in `runners.md` (harnesses in use, spawn permissions).
  4. Scaffold the wiki with real answers, leaving TBD only where nothing was discussed.
  5. Bootstrap a **test command that actually runs** (zero tests passing cleanly), and a focused variant for single test files.
  6. Optionally pick an architecture shape and an enforcement check, **proven by planting a violation** and seeing it caught.
  7. Prove `wf scope` and `wf prove` the same way.
  8. Optionally set up CI.
  9. Fill the root instructions file, create the integration branch.
- **`interview`** is a grill-me Q&A that defines a feature, plan or requirements:
  - one question at a time, each with a recommended answer;
  - dependencies are resolved first, and answers already in the wiki or code are read, not asked;
  - contradictions are surfaced immediately;
  - the transcript is **streamed to disk** question by question and answer by answer, so nothing is lost;
  - when it ends, the affected wiki pages, Behavior cases and todos are updated.
- **`work`** is the development loop. Every step appends to the run state.
  1. **Pick** the top todo (or the named one). Its entity page must have testable Behavior cases, or stop and recommend `interview`. With `resume`, read the run state instead and continue from its last step.
  2. **Branch** from the integration branch.
  3. *(complex only)* **Plan**, then **review the plan**, and dispose of each finding: applied, escalated to the human, or rejected with a reason.
  4. **For each case:** `wf brief developer`, dispatch by the transport of the runner chosen for it (§4.5), `wf await`. Then verify independently, whatever harness ran it:
     - `wf scope`: the tree changed only within Scope;
     - `wf prove`: the focused tests pass, the architecture check passes, and the tests fail with the implementation set aside (Red proven, not claimed).
     If all hold, `wf commit` (one case per commit) and `wf clean`. Otherwise send it back once with a new brief naming the failing log, then apply the two-strike rule.
  5. **Close the loop:** run the full suite once, push, and confirm the entity page is ticked.
  6. *(complex only)* **Diff review** over the whole cycle, ideally on a different model family from the developer's. Dispose of each finding in one line:
     - **fix**: severe findings, human-gated;
     - **file**: queued as a todo, only if worth doing;
     - **reject**: with one sentence why.
     Rounds are capped.
  7. **PR** with `wf pr` once every case on the entity passes.
  8. **Report** from the fixed template, with a maintenance nudge (time for an audit or health pass?).
- **`wiki`**: with a source, ingest it (researcher first if it's a web topic). With no argument, run the health pass: drain wiki-todos, reconcile drift, fix links and orphans, re-triage stale filed findings.

### Optional

- **`review`**: periodic auditor run (every ~5 cycles or before a release), producing a dated report plus todos.
- **`adversary`**: diff review on demand, outside the work loop.
- **`sync-template`**: pull generic workflow-file improvements from a template repo into an adopting project. Only worth having if you maintain a template.

---

## 9. Skills

Skills are **how-to procedures**, never textbook explanations. Group them by consumer, and merge any that are under ~15 lines into their caller. The protocol mechanics (brief, result, transports, worker contract, conductor rules) live in `protocol.md`, not in a skill.

**Conductor:**

- **dispatch**: choose the runner (§4.5) and its transport, verify and accept or send back, resume after an interruption or from another harness.
- **human checkpoint**: when and how to stop and ask (question, options, recommendation), in chat or through `checkpoint.md`, and how fast mode resolves checkpoints from recorded defaults.
- **finding disposition**: the dispositions for brief and diff findings, the severity gate, round commits, round cap.
- **branching and PR**: branch naming, batching related todos, syncing, opening the PR, cleanup after merge.
- **git recovery**: undo, reflog, conflicts. Load only in emergencies.
- **spec writing**: how to write Behavior cases that map one-to-one to tests (When/Then, one observable outcome, state transitions).
- **toolkit update** (meta): how to add, change or retire a role, skill, command, rule, runner or harness, including the pruning check. Every change is made to the canonical file, followed by `wf adapters --write`.

**Worker (listed in the role file, read by path):**

- **TDD loop** (developer): Red for the right reason (a missing behavior, never a typo or broken fixture), minimal Green, refactor, tick the wiki.
- **simplicity ladder** (developer): see §2.1.
- **architecture boundaries** (developer): which boundary a file belongs to, how to reach outward through a port. Only if a non-flat shape was chosen.
- **plan writing / plan review / adversarial review** (the matching optional roles): categories to sweep, severity vocabulary, report shape.
- **wiki update** (maintainer, and anyone writing the wiki): placement, dedup, page shapes, inline vs queued.

**On demand:**

- **record a gotcha**
- **record a decision**
- **design-system check** (UI projects only): use token roles, not raw values, and verify contrast and states.

---

## 10. Rules (always loaded)

Write ≤ 12 in `AGENTS.md`, each in one line with its *why*, covering these invariant families:

1. Spec before code, in the same commit.
2. Failing test before production code, failing for the right reason.
3. Never edit a test to make it pass. Fix the spec first.
4. Verify before asserting and report failures verbatim. State uncertainty; never invent facts or spec.
5. Human in the loop when the spec doesn't decide.
6. Two-strike pivot.
7. Workers get a brief file with paths only, never pasted content or conductor reasoning. The conductor writes no code inside the work loop, and no prose a script or worker can produce.
8. Reviewers are read-only and never review their own work.
9. Raw sources are immutable.
10. A dirty tree you didn't dirty belongs to someone else: account for every path before any destructive git command. One writer per checkout.
11. Acceptance is checked by git, never by the harness: every result is held against its brief's base and Scope, whatever harness produced it.
12. Smallest correct change. Ceremony scales with risk.

New rules are appended (never renumbered) and must name the failure that motivated them. Project-specific traps go to *gotchas*, not to rules.

---

## 11. Git and delivery

- `main` is releases, `develop` is integration, `feat/*` / `fix/*` are code work that merges by PR.
- Living documentation (wiki, raw, workflow files) may commit straight to `develop` or ride along on the active branch.
- Code branches commit **one Behavior case per commit**. Every commit is pushed, so work survives interrupted sessions and a conductor changing harness.
- The conductor owns every commit, push and PR, through `wf`. Workers never run git writes, in any harness.
- `.handoff/` is gitignored. Parallel sessions use separate worktrees, each with its own `.handoff/`.

---

## 12. Optional infrastructure

- **Permissions**, in each harness's own approval or sandbox model: allowlist the test commands, the architecture check, `wf` and read-only git so unattended workers don't stall. Deny git forms that write files (e.g. `--output`) for read-only roles. Git-checked acceptance (rule 11) still applies where the harness can't enforce any of this.
- **Fast mode:** checkpoints are answered by recorded defaults, or the run stops.
- **Guard hooks**, only in harnesses that support them: warn when the conductor edits code directly or breaks a rule, and optionally show the run state. Hooks are an enhancement in one harness and never the only enforcement. Build them only after the rules alone have proven insufficient.
- **CI:** install, test, architecture check and `wf adapters --check` on every PR.

---

## 13. Domain adaptation

Before scaffolding, map the abstractions onto the domain:

| Question | Changes |
| --- | --- |
| What is the unit of behavior? (endpoint, screen, pipeline stage, model capability, document section) | What an *entity* is |
| What counts as a test? (unit/integration, data assertions, snapshot, LLM eval with threshold, manual checklist) | The TDD loop and the Red proof in `wf prove` |
| How costly is a defect? (prototype vs production vs regulated) | How many optional modules, default tier, review severity floor |
| Which harnesses and models does the team have, and what does each cost? | The harnesses in `runners.md`, which may be spawned, any standing preferences or overrides |
| Is there a UI? | Design-system page and check |
| Is it research-heavy? | Researcher role (on a runner with web access), richer wiki ontology |
| Does the code have real boundaries? | Architecture shape and enforcement, or flat |
| One person or a team? Parallel sessions? | Worktrees, PR flow, guard hooks |

For non-software domains (docs, data, research), keep the spine (spec → verifiable check → execution → independent review → wiki update) and replace "test" with whatever check is objective in that domain.

---

## 14. Growth and pruning

- **Adding:** a new role, skill, command, rule or `wf` subcommand needs a recurring failure or a recurring manual procedure (seen at least twice). Name it in the change.
- **Pruning:** every ~10 work cycles, ask of each component whether it changed an outcome. Delete what never fired. Merge skills that always load together.
- **Conductor output:** at the same interval, look at what the conductor actually wrote. Anything it composed more than once is a candidate for a `wf` subcommand or a result-header field.
- **Harness drift:** when a harness changes, update its side prompt, note and renderer only, then `wf adapters --write`. If a canonical file had to change too, it was carrying harness knowledge: move that knowledge out.
- **Drift:** when a procedure and the wiki disagree, the wiki wins for *what*, and the skill wins for *how*.
