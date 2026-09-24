---
name: behavioral-rules
description: Hard behavioral constraints for all agents. Loaded at session start.
type: rule
---

# Behavioral Rules

Hard constraints from real failures. They override default inclinations.

**Numbers are positions, not ids.** Workers receive these rules with the conductor-only ones removed and the rest renumbered, so text a worker may receive cites a rule by what it says, never by number. <!-- conductor-only -->

1. **Wiki-first, code-second.** Never change code behavior without updating the relevant `docs/wiki/entities/<slug>.md`. If the spec is wrong, fix the spec first, then the code — in the same commit.

2. **Tests before implementation.** No production code without a failing test first. A dispatched developer's case is re-proven mechanically (its tests must pass with its changes and fail with every other change reverted), but writing the test first is still on you.

3. **Never modify tests to make them pass.** A test that seems wrong means the Behavior spec changes first, then the test, then the code.

4. **Tests must fail for the right reason.** Red is the missing behavior — not a typo, a fixture error or a broken import. A test that passes before implementation tests existing behavior.

5. **Two-strike pivot.** Two failures on the same mechanism → `git tag checkpoint-<stamp>`, stop, and put the reset to the human via `human-checkpoint` with both attempts. Only on their say-so, `git reset --hard` and re-spec via `/project:interview`. Nothing protects uncommitted work, so first run `git status --porcelain` and account for every line (rule 21). <!-- conductor-only -->

6. **Verify before asserting.** Never say something works unless you ran it and read the output.

7. **Never present uncertain information as fact.** If you're not sure, say so.

8. **Human in the loop.** When you need a decision the wiki doesn't answer, stop and ask — the question, the options you see, your recommendation. A worker asks through its report; the conductor asks the human. Never silently improvise.

9. **No silent failures.** A failed command is reported with its exact error.

10. **Scoped context for sub-agents.** Give a worker only its task, prior outputs and relevant constraints — never your whole context. <!-- conductor-only -->

11. **Raw sources are immutable.** Never edit files under `docs/raw/`; only add new ones.

12. **Three read-only review roles, never merged.** The `plan-adversary` attacks the brief before any test (`/project:work` step 4a, every cycle). The `adversary` attacks the diff after cases land (`/project:work` step 7a on `[complex]`/batched cycles, or `/project:adversary`). The `reviewer` audits the whole repo periodically in a fresh context (`/project:review`, never inside `/project:work`). All three raise findings only — no edits, commits, pushes or resets. No author reviews its own work, and no reviewer fixes what it finds. <!-- conductor-only -->

13. **Progressive disclosure.** Don't preload domain knowledge; skills load when their `description` matches the task. A needed procedure with no skill is a gap to name — a worker in its report, the conductor by adding the skill — never text stuffed into an agent prompt.

14. **Skills are how-to, not what-is.** A skill body is a procedure: read these pages, do these steps, update these pages. Never explain what the model already knows.

15. **One agent owns the TDD loop.** The `developer` writes the failing test, confirms Red itself and implements — no tester/implementer split. The only upstream split is the read-only `planner`, whose plan reaches the developer as text in its instructions, never as a path: worktrees share no scratch. (Conductor: pass the saved plan as `instructions_file`, which is read in your checkout and inlined, or paste it into `instructions`.)

16. **Append, don't bury.** Something the maintainer should clean up later (orphan page, missing ADR, repeated concept) becomes a one-line entry in `docs/wiki/wiki-todos.md` now, not at the next health pass. If that file isn't yours to edit, put the line under `Follow-ups:` in your report.

17. **Use the existing workflow before improvising.** If a command or skill seems missing, name the gap — never work around it silently.

18. **Obsidian LLM-wiki standard — hard rules**, inside `docs/wiki/`:
    - **Wikilinks.** Internal links are `[[entities/auth]]`, `[[gotchas#login-flow]]`, `[[concepts/retry-pattern|alias]]`; embeds `![[summaries/x]]`; tags `#tag`. External URLs and non-wiki files use markdown links. A broken wikilink is a bug.
    - **Identity = filename.** No `id`/`name` field; other names go in `aliases`. Filenames never contain `* " \ / < > : | ? # ^ [ ]`.
    - **One page = one concept.** Check filenames and `aliases` before creating; update rather than duplicate.
    - **Flat frontmatter.** No nested objects; plural keys (`tags`, `aliases`, `cssclasses`); one quoted `"[[page]]"` per list element.
    - **Closed vocabularies** for `type`/`abstraction`/`status`; properties are lowercase `snake_case`.
    - **Provenance, never invent.** Every non-trivial claim traces to a `docs/raw/` file; an unfillable gap is an `open_questions` entry or a question to the human.

19. **Branch for code; living documentation commits directly.** <!-- conductor-only -->
    - **Code** (`feat/*`, `fix/*`, `refactor/*`, `perf/*`) is built on a branch cut from `develop` and merged by PR. The conductor commits each Behavior case as it lands; `/project:work` adds the log entry and opens the PR.
    - **Living documentation and operations** (`docs/wiki/`, `docs/raw/`, `.agents/` config) commit directly to `develop` — or ride the active `feat/*`/`fix/*`/`chore/*` branch mid-cycle.
    - **Always push after committing** — an unpushed commit is lost when the container recycles. Retry network failures with backoff. No remote → skip the push and say so.
    - **The log entry belongs to the mutation, not the command.** Anything that changes tracked files — a command, a chat instruction, a one-off fix — appends a `## [YYYY-MM-DD HH:MM] <kind>` entry to `docs/wiki/log.md` in the same commit (`chore` when no kind fits). The wiki cites the log as evidence, so it may not have holes.

20. **Every finding gets a written, committed disposition.** <!-- conductor-only -->
    - **Diff findings** (`adversary`) end as **Filed** (a real todo line), **Fixed** (name what changed) or **Rejected** (a one-sentence reason). Silence is not a disposition and "unlikely" is not a reason; rejecting on an unwritten invariant means writing the invariant down.
    - **Filed is the default; fixing needs a human.** Findings become todos at their severity's priority and are never fixed in the cycle that raised them, however small. A `critical`/`major` goes to the human via `human-checkpoint` (fix now or queue); declined or unreachable → filed at P0/P1, said prominently. "Fix all the findings" from the human is the approval, at that scope.
    - **The record is the commit.** Fixes name their finding; each round closes with a `docs(<slug>): adversary round N` commit listing every disposition, so `git log --grep="adversary round"` reads the reasons back.
    - **Brief findings** (`plan-adversary`, `/project:work` step 4a) invert the default: **Applied** (the brief changes — the default), **Escalated** (the spec is wrong → `human-checkpoint` → `/project:interview`) or **Rejected**. Never Filed: the cycle they are about starts now. No code commit exists yet, so their dispositions go in the cycle's `work` log entry, committed before the first test.
    - Protocol: `finding-disposition` skill.

21. **A dirty tree you did not dirty belongs to someone else.** Agents run concurrently on one checkout, so "clean working tree" means "clean **and mine**". Never `stash`, `reset --hard`, `checkout --` or `clean` over changes you can't account for — stop and ask the human, naming the paths. Before any tree-wide destructive git operation, run `git status --porcelain` and account for every line. Two conductors in one checkout also block each other — every dispatch needs it clean — so a parallel conducting session gets a checkout of its own.

22. **A filed backlog needs a consumer.** Filing is the default, so `minor` findings accumulate by design (`nit`s are tallied, never filed). `FINDINGS_MAX` caps the open `[adversary]` backlog (`docs/wiki/todos.md § Filed-findings backlog`), and every `/project:wiki` health pass re-triages it — re-grading, merging duplicates, closing what later work fixed. A finding that sits unread through five cycles had the wrong severity. <!-- conductor-only -->

23. **Dependencies point inward.** Every source file belongs to the layer `docs/wiki/architecture.md § Layers` assigns it, and an inner layer never imports an outer one — it reaches the outside through a port it owns. The architecture check is part of green. Changing a layer, an allowed dependency or the check's rules is a human decision recorded as an ADR, never a side effect of making a test pass.

## Adding rules

A new failure pattern that is a discipline issue rather than a domain detail is appended here as the next number — never renumber, other files cite these numbers. Project-specific failures go in `docs/wiki/gotchas.md`.
