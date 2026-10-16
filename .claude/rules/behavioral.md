# Behavioral Rules

Hard constraints from real failures. Rules marked *(Conductor)* bind the main session; subagents follow all others. Numbers never change.

1. **Wiki-first, code-second.** Never change behavior without updating `docs/wiki/entities/<slug>.md` (or `concepts/<slug>.md` for `[infra]`) in the same commit. Wrong spec → fix spec first, then code.
2. **Tests before implementation.** No production code without a failing test first. Conductor re-proves every developer case (its focused tests pass at `HEAD`, fail when non-test paths restore to `HEAD~1`) and runs the full suite once when the case loop closes.
3. **Never modify tests to make them pass.** Wrong test → update Behavior spec first, then test, then code.
4. **Tests must fail for the right reason.** Red must fail on missing behavior (assertion or missing symbol), never a typo, fixture error or broken import.
5. **Two-strike pivot.** *(Conductor)* Two failures on the same mechanism → `git tag checkpoint-<stamp>`, stop, and ask via `human-checkpoint` with both attempts. Only on approval: verify `git status --porcelain` (rule 21), `git reset --hard`, and re-spec via `/project:interview`.
6. **Verify before asserting.** Never claim something works without running it and reading the output.
7. **Never present uncertain information as fact.** State uncertainty explicitly.
8. **Human in the loop.** When the wiki doesn't decide, stop and ask (question, options, recommendation). Subagents ask in their report; the conductor uses `human-checkpoint` (or takes a recorded default / ends the run in `fast` mode). Never silently improvise.
9. **No silent failures.** Report any failed command with its exact error.
10. **Scoped context for subagents.** *(Conductor)* Brief a subagent only with task, inputs, scope and return format — never reasoning or chat history. Dispatch by `subagent_type` or `dispatch-handoff`, never `fork` or `general-purpose`.
11. **Raw sources are immutable.** Never edit existing files under `docs/raw/`; only add new ones.
12. **Three read-only review roles, never merged.** *(Conductor)* `plan-adversary` checks the brief before Red (`/project:work` step 4a); `adversary` checks the diff (`/project:work` step 7a on `[complex]`/batched cycles, or `/project:adversary`); `reviewer` audits the whole repo (`/project:review`, never inside `/project:work`). Reviewers raise findings only and never edit; no author reviews its own work.
13. **Progressive disclosure.** Load skills only when their `description` matches the task. Report missing skill gaps (`Follow-ups:` for subagents, `update-toolkit` for conductor) instead of stuffing procedures into briefs.
14. **Skills are how-to, not what-is.** *(Conductor)* Skill bodies are actionable procedures (read, do, update), never textbook explanations.
15. **One agent owns the TDD loop.** `developer` writes the failing test, confirms Red, implements Green, refactors and ticks the wiki. Only `planner` sits upstream (`.handoff/<slug>-plan.md`). Inside `/project:work` the conductor edits no source or tests itself; outside it, a direct edit the human asks for is fine. `conductor-guard` shows the human a notice when the main session edits code directly.
16. **Append, don't bury.** Deferred wiki cleanup goes into `docs/wiki/wiki-todos.md` immediately — or under `Follow-ups:` in a subagent report if out of scope.
17. **Use the existing workflow before improvising.** Name missing commands or skills instead of working around them silently.
18. **Obsidian LLM-wiki standard** (`docs/wiki/`, full schema in `wiki-update`):
    - **Wikilinks:** internal `[[entities/auth]]`, `[[gotchas#login-flow]]`, `[[concepts/x|alias]]`, embeds `![[summaries/x]]`, tags `#tag`; markdown links for external URLs and repo files. Broken wikilinks are bugs.
    - **Identity = filename:** one page per concept (check `aliases` first); no `id`/`name` field; no `* " \ / < > : | ? # ^ [ ]` in filenames.
    - **Frontmatter:** flat keys (`tags`, `aliases`, `cssclasses`), quoted `"[[page]]"` list items, lowercase `snake_case` properties, closed `type`/`abstraction`/`status` vocabularies.
    - **Provenance:** trace non-trivial claims to `docs/raw/`; unfillable gaps go in `open_questions` or to the human, never invented.
19. **Branch for code; living documentation commits directly.** *(Conductor)*
    - **Code** (`feat/*`, `fix/*`, `refactor/*`, `perf/*`) branches from `develop`, commits one Behavior case at a time, and merges via PR.
    - **Living docs & ops** (`docs/wiki/`, `docs/raw/`, `.claude/`) commit directly to `develop` or ride the active branch.
    - **Push every commit** (`git push`; retry network failures; skip and note if no remote) — a code branch's case commits together when the case loop closes, or earlier when the run pauses.
    - **Log mutations.** Append `## [YYYY-MM-DD HH:MM] <kind>` (UTC) to `docs/wiki/log.md` (`log-and-commit.md`) in the same commit as any direct commit to `develop`/`main` (a raw-source arrival is logged by the ingest that follows); on a code branch the cycle's `work` entry and the `pr` entry cover its commits.
20. **Every finding gets a written, committed disposition.** *(Conductor, `finding-disposition`)*
    - **Diff findings** (`adversary`): **Filed** (default; queued in `todos.md` by severity, never fixed in the raising cycle without human approval), **Fixed** (`critical`/`major` approved via `human-checkpoint`), or **Rejected** (one-sentence reason; unwritten invariants must be written to the wiki). Committed in `docs(<slug>): adversary round N`.
    - **Brief findings** (`plan-adversary`, before Red): **Applied** (default; updates plan/brief), **Escalated** (spec defect → `human-checkpoint` → `/project:interview`), or **Rejected**. Never Filed; logged in the cycle's `work` entry before the first test.
21. **A dirty tree you did not dirty belongs to someone else.** Sessions and subagents share a checkout. Before any dispatch or destructive git command (`stash`, `reset --hard`, `checkout --`, `restore`, `clean`), run `git status --porcelain` and account for every line; stop and ask over unexplained paths. Parallel conductors use `claude --worktree <name>`.
22. **A filed backlog needs a consumer.** *(Conductor)* `FINDINGS_MAX` (`docs/wiki/todos.md § Filed-findings backlog`) caps open `[adversary]` todos; `/project:wiki` health passes re-triage them (closing fixed/duplicate items, promoting or closing any untouched across two passes).
23. **Dependencies follow the declared boundaries.** Source files obey the shape `docs/wiki/architecture.md § Layers` declares (layered, core/shell, slices or flat); a unit reaches one it may not import only through a port or public API the declaration names, verified by the architecture check. Changing the shape, its boundaries, allowed dependencies or check rules requires human approval and an ADR.

## Adding rules

Append new discipline rules as the next number — never renumber. Project-specific traps go in `docs/wiki/gotchas.md`.
