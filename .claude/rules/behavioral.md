# Behavioral Rules — Prototype Mode

Hard constraints from real failures. These override default agent inclinations.

This is the **prototyping** variant of the template: no TDD loop, no adversarial review, no periodic audit. What replaces them is a single, non-negotiable habit — **you run the thing and show the output**. Everything below protects that habit, or protects the wiki that makes the prototype graduatable later.

1. **Wiki-first, code-second.** Never change behavior without also updating the relevant `docs/wiki/entities/<slug>.md`. If the spec is wrong, fix the spec first, then the code — in the same commit. Prototype speed comes from skipping tests, not from skipping the spec.

2. **Demonstrate, don't assert.** A slice is done when you have **run it** and pasted the real output into the conversation and the entity page's `## Demonstrations` section: the exact command, the observed output (trimmed, not paraphrased). "The endpoint should return 200" is not a demonstration. There is no test suite standing behind you here — the run *is* the evidence.

3. **Never fake a demonstration.** Do not write down output you did not observe, do not present a plausible-looking transcript, do not mark a slice `[x]` because the code "obviously" works. If you could not run it (missing credential, no network, needs hardware you don't have), say so plainly, leave the slice `[~]`, and record the blocker. A fabricated demonstration is worse than no prototype.

4. **Smallest demonstrable slice.** Never build more than you can show running in one step. If a slice cannot be demonstrated without three other slices existing first, it is not a slice — split it or sequence it. One slice → one run → one commit.

5. **Two-strike pivot.** If an approach fails twice on the same mechanism, try a fundamentally different one. Two failures → tag the state (`git tag checkpoint-<stamp>`), `git reset --hard` to a known-good commit, and re-scope via `/project:interview`. In a prototype, the second failure usually means the idea needs reshaping, not the code.

6. **Assume the technical layer — never interview it.** Stack, storage, framework, config format, process model, deployment: the agent picks these itself under rule 20's envelope, records the choice in `docs/wiki/architecture.md`, and moves on. Asking the human "which database?" is a workflow violation here. The `stack-assumption` skill is the procedure. The human is interviewed about **logic, product, and gaps** only.

7. **Never present uncertain information as fact.** If you're not sure, say so.

8. **Human in the loop.** When you need a decision the wiki doesn't answer — a *product* decision, an ambiguity in the logic, a risky or irreversible operation — stop and ask via the `human-checkpoint` skill. Do not silently improvise. Technical choices are the explicit exception (rule 6): those you make yourself.

9. **No silent failures.** If a command fails, report the exact error. A prototype that half-starts is a finding, not an embarrassment.

10. **Scoped context for sub-agents.** Give sub-agents only the task, prior outputs, and relevant constraints. Never dump full memory.

11. **Raw sources are immutable.** Never edit files under `docs/raw/`. Only append new ones.

12. **Shortcuts are declared, never hidden.** Prototypes are allowed — expected — to hardcode, stub, fake, skip validation, and ignore error paths. What is forbidden is doing it quietly. Every deliberate shortcut gets a one-line entry in the entity page's `## Shortcuts` section: what is faked, and what it would take to make it real. This section is the single most valuable thing the prototype produces — it is what `/project:graduate` exports, and it is the difference between "a prototype" and "a codebase nobody can trust".

13. **Progressive disclosure.** Don't preload domain knowledge. Skills auto-load when their `description` matches the task. If a needed skill doesn't exist, create one via the `update-toolkit` skill rather than stuffing it into an agent prompt.

14. **Skills are how-to, not what-is.** When writing or editing a skill, the body must be a procedure: read these wiki pages, follow these steps, update these pages. Never explain a concept the LLM already knows.

15. **One agent owns the build loop.** The `builder` scopes the slice, writes the code, runs it, records the evidence, and updates the wiki — there is no planner, no separate implementer, no handoff file to write or read. There is also no reviewing agent in this template: the demonstration is the review, and the human watching it run is the reviewer.

16. **Append, don't bury.** When you discover something the maintainer should clean up later (orphan page, missing ADR, repeated concept), append a one-line entry to `docs/wiki/wiki-todos.md`. Don't wait for `/project:wiki-lint`.

17. **Use the existing workflow before improvising.** Slash commands and skills exist for a reason. If the workflow seems missing, add a command or skill via the `update-toolkit` skill — don't work around the gap silently.

18. **Obsidian LLM-wiki standard — hard rules.** Violating these breaks rendering, the graph, or dedup — they are not stylistic. The full standard (facet vocabulary, link ontology, page templates) lives in the `wiki-update` skill; it is the single source of truth. The non-negotiable invariants, inside `docs/wiki/`:
    - **Wikilink syntax.** Internal links are `[[wiki-style]]` (`[[entities/auth]]`, `[[gotchas#login-flow]]`, `[[concepts/retry-pattern|alias]]`), tags `#tag`, embeds `![[summaries/x]]`. External URLs and non-wiki files (`.claude/...`, `src/...`) keep standard markdown links. A broken wikilink is a bug.
    - **Identity = filename.** No `id`/`name` field; alternative names go in `aliases`. Filenames never contain `* " \ / < > : | ? # ^ [ ]`.
    - **One page = one concept.** Before creating a page, check existing filenames and `aliases`; if the concept exists → update, don't duplicate.
    - **Flat frontmatter, quoted-solitary wikilinks.** No nested objects; plural special keys (`tags`, `aliases`, `cssclasses`); one `"[[page]]"` per list element.
    - **Closed vocabularies** for `type`/`abstraction`/`status` (defined in `wiki-update`); properties lowercase `snake_case`.
    - **Provenance, never invent.** Every non-trivial claim traces to a `docs/raw/` file; an unfillable gap is an `open_questions` entry or a question to the human, never invented prose.

19. **Branch before the first tracked write; finalize with commit + push.** Any command or agent that mutates tracked files — code, wiki, transcripts, `.claude/` config, anything — opens a branch *before* the first write, not before the commit. If you are standing on `main`, `git checkout -b proto/<slug>`; if you are already on a `proto/*` branch whose work this belongs to, stay on it. Only `/project:work` gets an implicit branch — every other command owns its own, and "the command didn't say to branch" is not a defense (rule 17: fix the command). Checking the branch at commit time is too late for anything written turn-by-turn. It then ends by committing the change and pushing it (`git push -u origin <branch>`). A local commit is not enough: remote execution containers are recycled between sessions, so an unpushed commit is lost work. The `builder` commits and pushes each demonstrated slice as it lands (`git-conventions.md`, Cadence). Read-only commands and gitignored scratch are the only exceptions. On network failure, retry the push with exponential backoff.

20. **The hardware envelope binds.** Everything built here must run on **one modest, always-on consumer machine** — low-power CPU, small RAM, no GPU, ordinary home network, possibly ARM. That means: a single process (or a couple), a file-backed store, no container orchestration, no managed cloud service in the critical path, no build step that needs a beefy machine, and dependencies that install without compiling half the world. This is a constraint on every technical choice you make under rule 6, not a preference to trade away for convenience. If the feature the human asked for genuinely cannot be built inside the envelope, that is a `human-checkpoint` — you say what breaks and what it would cost, and let them decide. You never quietly reach outside it.

## Adding rules

When a new failure pattern emerges that's broader than a project-specific quirk (i.e. it's a discipline issue, not a domain detail), append it here as a numbered rule. Project-specific failures go in `docs/wiki/gotchas.md`.
