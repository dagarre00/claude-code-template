---
name: behavioral-rules
description: Hard behavioral constraints for all agents. Loaded at session start.
type: rule
---

# Behavioral Rules

Hard constraints from real failures. These override default agent inclinations.

1. **Wiki-first, code-second.** Never change code behavior without also updating the relevant `docs/wiki/entities/<slug>.md`. If the spec is wrong, fix the spec first, then the code — in the same commit.

2. **Tests before implementation.** Never write production code without a failing test first. The Red phase is mandatory. Nothing enforces this on `feat/*` and `fix/*` — keeping the discipline is on you.

3. **Never modify tests to make them pass.** If a test seems wrong, update the entity Behavior spec → regenerate the test → implement. Changing a test to match broken code is not TDD.

4. **Tests must fail for the right reason.** A passing test before implementation tests existing behavior, not the new feature. Confirm RED is real (missing feature, not a typo or import error).

5. **Two-strike pivot.** If an approach fails twice on the same mechanism, try a fundamentally different one. Two failures → tag the state (`git tag checkpoint-<stamp>`), `git reset --hard` to a known-good commit, and re-spec via `/project:interview`.

6. **Verify before asserting.** Run it, don't assume. Never tell the human a feature works unless tests pass and you read the output yourself.

7. **Never present uncertain information as fact.** If you're not sure, say so.

8. **Human in the loop.** When you need a decision the wiki doesn't answer, stop and ask. Use the `human-checkpoint` skill to format the ask. Do not silently improvise.

9. **No silent failures.** If a command fails, report the exact error.

10. **Scoped context for sub-agents.** Give sub-agents only the task, prior outputs, and relevant constraints. Never dump full memory.

11. **Raw sources are immutable.** Never edit files under `docs/raw/`. Only append new ones.

12. **Two review roles — never merged, both read-only.** The `reviewer` is periodic and whole-repo: it runs in a fresh, isolated session context via `/project:review`, with no `developer` context, and is never part of the work loop. The `adversary` is the opposite shape — diff-scoped and per-change, dispatched inside `/project:work` (step 7a) for `[complex]`/batched cycles and by `/project:adversary` on demand. What they share is what makes either worth running: both read without the author's context, and both raise **findings only** — no edits, no commits, no pushes, no resets. A developer never audits its own work, and a reviewer of either kind never fixes what it finds.

13. **Progressive disclosure.** Don't preload domain knowledge. Skills auto-load when their `description` matches the task. If a needed skill doesn't exist, create one via the `update-toolkit` skill rather than stuffing it into an agent prompt.

14. **Skills are how-to, not what-is.** When writing or editing a skill, the body must be a procedure: read these wiki pages, follow these steps, update these pages. Never explain a concept the LLM already knows.

15. **One agent owns the TDD loop.** The `developer` writes the failing test, confirms Red itself, then implements — there is no separate `tester`/`implementer` split and no handoff JSON to write or read. Red must be genuine (rule 4) before any production code; confirm it yourself, don't trust a prior step. The only upstream split is the `planner` (Opus), which writes a `.claude/handoff/<slug>-plan.md` for `[complex]`/batched work — markdown scratch the developer reads, never a contract it must validate.

16. **Append, don't bury.** When agents discover something the maintainer should clean up later (orphan page, missing ADR, repeated concept), append a one-line entry to `docs/wiki/wiki-todos.md`. Don't wait for `/project:wiki-lint`.

17. **Use the existing workflow before improvising.** Slash commands and skills exist for a reason. If the workflow seems missing, add a command or skill via the `update-toolkit` skill — don't work around the gap silently.

18. **Obsidian LLM-wiki standard — hard rules.** Violating these breaks rendering, the graph, or dedup — they are not stylistic. The full standard (facet vocabulary, link ontology, page templates) lives in the `wiki-update` skill; it is the single source of truth. The non-negotiable invariants, inside `docs/wiki/`:
    - **Wikilink syntax.** Internal links are `[[wiki-style]]` (`[[entities/auth]]`, `[[gotchas#login-flow]]`, `[[concepts/retry-pattern|alias]]`), tags `#tag`, embeds `![[summaries/x]]`. External URLs and non-wiki files (`.claude/...`, `src/...`) keep standard markdown links. A broken wikilink is a bug.
    - **Identity = filename.** No `id`/`name` field; alternative names go in `aliases`. Filenames never contain `* " \ / < > : | ? # ^ [ ]`.
    - **One page = one concept.** Before creating a page, check existing filenames and `aliases`; if the concept exists → update, don't duplicate.
    - **Flat frontmatter, quoted-solitary wikilinks.** No nested objects; plural special keys (`tags`, `aliases`, `cssclasses`); one `"[[page]]"` per list element.
    - **Closed vocabularies** for `type`/`abstraction`/`status` (defined in `wiki-update`); properties lowercase `snake_case`.
    - **Provenance, never invent.** Every non-trivial claim traces to a `docs/raw/` file; an unfillable gap is an `open_questions` entry or a question to the human, never invented prose.

19. **Branch for code changes; living wiki commits directly on develop (or current branch).**
    - **Code modifications (`feat/*`, `fix/*`, `refactor/*`, `perf/*`)** must always be built on a dedicated branch cut from `develop` and merged via PR. The `developer` commits and pushes each Behavior case as it lands (`git-conventions.md`, Cadence); `/project:work` adds the log entry and opens the PR.
    - **Living documentation & operations (`docs/wiki/`, `docs/raw/`, `.claude/` config)** from maintenance commands (`/project:wiki-lint`, `/project:review`, `/project:wiki-ingest`, `/project:interview`, `/project:agent-scout`, `/project:handoff`): when standing on `develop`, commit and push directly to `develop` (`git push -u origin develop`). If you are already on a `feat/*`/`fix/*` branch whose work this belongs to, keep the doc edits on that branch. This prevents branch and PR proliferation for routine knowledge-base updates while preserving strict PR-gated integration for application code.
    - A local commit is not enough: remote execution containers are recycled between sessions, so an unpushed commit is lost work. Always push after committing. On network failure, retry the push with exponential backoff.

    **The log entry belongs to the mutation, not to the command.** `docs/wiki/log.md` gets a `## [YYYY-MM-DD HH:MM] <kind>` entry from *whatever* changed tracked files — a slash command, a bare chat instruction, a one-off fix, a deploy run from a terminal. Binding the log to a command's step number means work that never entered a command is invisible, and a timeline with holes is worse than no timeline because the wiki still cites it as evidence. If no `kind` fits, use `chore`. Same commit as the change, like every other wiki edit (rule 1).

20. **Every finding gets a written disposition, and the record is committed.** An adversarial review (rule 12) is answered, not absorbed. Each numbered finding ends as **Filed** (a real todo line), **Fixed** (name what changed), or **Rejected** (state the reason in one sentence). Silence is not a disposition and "unlikely" is not a reason. If you reject a finding by citing an invariant that isn't written down anywhere, write it down as part of the rejection — an undocumented invariant is not one.

    **Filed is the default; fixing needs a human.** A review files work, it does not do work: findings become todos in `docs/wiki/todos.md` at the priority their severity maps to, and are not fixed in the cycle that surfaced them — not even the two-line ones. The sole exception is a `critical` or `major`, which goes to the human via `human-checkpoint` with its failure scenario and a recommendation; they decide fix-now or queue. Never fix one on your own initiative, and never let one become a todo without having asked. If the human declines or is unreachable, file it at P0/P1 and say so prominently — that is the only path by which a `critical` is queued rather than fixed.

    **The record is the commit.** Triage in the mailbox (`.claude/handoff/<slug>-findings.md`, gitignored scratch), then write each disposition into the body of the commit that answers it: approved fixes name the finding they close, and each round ends with a `docs(<slug>): adversary round N` commit whose body lists every finding with its disposition, filed ones included. The todo says what to do; the commit says why it was not done now. Git history is already tracked, dated, and immutable, so the record needs no file of its own — but a disposition that exists only in a deleted scratch file satisfies nothing. If a rejection's reason cannot be read a cycle later with `git log --grep`, the review was theatre.

21. **A dirty tree you did not dirty belongs to someone else.** Uncommitted changes you did not make are another session's live work — agents run concurrently on one checkout, and "clean working tree" preconditions read as "clean **and mine**". Never `stash`, `reset --hard`, `checkout --`, or `clean` over changes whose author you cannot account for: stop and run `human-checkpoint`, naming the paths and what you were about to do. Before any tree-wide destructive git operation, `git status --porcelain` and account for every line — if a path is not one you touched this session, it is evidence, not dirt. The recoverable version of this failure is a stash you have to hunt down; the unrecoverable one is rule 5's two-strike `git reset --hard` landing on someone else's uncommitted afternoon.

22. **A filed backlog needs a consumer, or filing is just deletion with extra steps.** Rule 20 makes filing the default disposition, which means `minor` findings accumulate by design — and a queue nothing ever drains is where findings go to be forgotten while everyone believes they were handled. (`nit` findings are not filed at all; the adversary tallies them and they end there.) Two guards, both computable: `FINDINGS_MAX` caps the open `[adversary]` backlog (`docs/wiki/todos.md § Filed-findings backlog`), and `/project:wiki-lint` re-triages it on every pass — re-grading, merging duplicates, and closing what later work already fixed. A finding that has sat unread through five cycles is telling you its severity was wrong, not that the queue needs to be longer.

## Adding rules

When a new failure pattern emerges that's broader than a project-specific quirk (i.e. it's a discipline issue, not a domain detail), append it here as a numbered rule. Project-specific failures go in `docs/wiki/gotchas.md`.
