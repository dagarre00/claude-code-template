# Agentic Prototyping Template

A Claude Code template for building a working prototype with an LLM agent as the developer. Wiki-driven, no TDD, runs on a small box. This is the **rapid-prototyping branch** of the agentic-development template — the fast-loop sibling of the rigorous spec + TDD track.

## Three ideas

1. **The wiki is the spec.** `docs/wiki/` is the source of truth for what the prototype does and how it's built. Code that disagrees with the wiki is the bug. Speed comes from skipping *tests*, never from skipping the spec.
2. **Running it is the proof.** There is no test suite. A slice is done when the agent has launched the thing, exercised the path, and pasted the real output into the wiki. It is forbidden from claiming anything it didn't run.
3. **The technical layer is assumed, not discussed.** Stack, storage, config, deployment — the agent picks them itself, inside a fixed envelope: one modest, always-on consumer machine. You are only ever interviewed about **what the thing should do**.

## Quick start

```bash
git clone <this-template> my-prototype
cd my-prototype
rm -rf .git    # drop the template's history — /project:init re-inits git for your project
claude
```

Inside Claude Code:

```
/project:init        # pick the stack, scaffold docs/wiki, get something that starts
/project:interview   # grill yourself on the product logic and its gaps
/project:work        # build the next slice, run it, record the output, commit
/project:demo        # run everything as it stands; report what actually works
/project:graduate    # export a handoff file for a full-workflow repo
/project:wiki-lint   # periodic wiki health check
```

Open `docs/wiki/` in Obsidian on the side. That's your view of the agent's knowledge.

For a worked walkthrough, see [`docs/getting-started.md`](docs/getting-started.md).

## The unit of work: a slice

A **slice** is the smallest thing that can be demonstrated with one command:

```markdown
- [x] S2: Posting a CSV stores its rows — demo: `curl -F file=@sample.csv localhost:8000/upload`
```

One slice → one run → one commit. The output of that run goes into the entity page under `## Demonstrations`, verbatim. Anything the agent faked to get there — hardcoded delimiter, skipped auth, no error handling — goes into `## Shortcuts` in the same commit. That ledger is the most valuable thing the prototype produces.

## What's in the box

```
.claude/
├── agents/          # builder, wiki-maintainer, researcher — that's all
├── skills/          # build-loop, slice-writing, stack-assumption, graduation-export,
│                    #   wiki-update, feature-branching, … + update-toolkit meta skill
├── commands/        # /project:init, interview, work, demo, graduate, wiki-lint,
│                    #   wiki-ingest, agent-scout
├── settings.json    # harness settings
└── rules/           # behavioral constraints — the law
docs/
├── raw/             # immutable source documents (interviews, articles, transcripts)
└── wiki/            # LLM-owned knowledge base (entities, decisions, log, …)
CLAUDE.md            # the schema — read first
HUMAN.md             # the human's-eye view of how this works
```

## Deliberately absent

No `developer`/`planner`/`adversary`/`reviewer` agents, no `/project:review`, no `/project:adversary`, no `develop` branch, no PR ceremony, no test suite. Those belong to the rigorous track. If you find yourself wanting them, that's not a gap in this template — it's the signal to graduate.

## Graduating

When the prototype has answered its question and you want tests, review, and a spec you can defend, run `/project:graduate`. It compiles one self-contained markdown handoff — requirements, slices translated into draft behavior cases (marked *demonstrated* or *inferred*), the assumed stack and why, the full shortcut ledger, the gotchas you already paid for, and an honest list of what was never actually run. Hand that file to `/project:init` in a repo running the full workflow and it starts from real material instead of a blank interview.

Nothing gets converted in place. The two tracks stay separate on purpose.

## Philosophy

- **Skills are how-to, not what-is.** No skill explains "what a prototype is" — they explain how *this* project builds one.
- **Demonstrate, don't assert.** The single rule that makes a test-free template trustworthy.
- **Shortcuts are declared, never hidden.** Hardcode anything; hide nothing.
- **Wiki ships with code.** Same commit, always.
- **Human in the loop for product, not plumbing.** Ambiguous logic → it asks. Which JSON library → it decides.
- **Dynamic config.** The `update-toolkit` meta skill lets the agent evolve its own skills and commands as the prototype grows.

## License

MIT — see [`LICENSE`](LICENSE). Use it. Fork it. Bend it.
