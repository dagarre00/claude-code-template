<!-- Generated from .harness/; DO NOT EDIT. Run node scripts/sync-harness.mjs. -->

# Project

- Name: `<set during project initialization>`
- Vision: `<set during project initialization>`
- Stack: `<detect or ask during project initialization>`
- Application tests: `<verify during project initialization>`

# Project Schema — Wiki-Driven Development

This is a reusable development template for Claude Code, Codex, and Antigravity
CLI. The wiki is the application spec; `.harness/` is the canonical source for
the agent workflow. Generated harness files are delivery artifacts.

## Start every session

1. Read the behavioral rules included below.
2. Before implementation, read `docs/wiki/gotchas.md`, `docs/wiki/todos.md`, the
   matching entity Behavior cases, and relevant requirements and architecture.
3. Search `docs/wiki/` for related concepts and decisions before changing behavior.
4. Load only relevant skills. If a harness does not expose a skill loader, read
   `.harness/skills/<name>/SKILL.md` and its required supporting files directly.
5. Follow the current user's scope. When maintaining this uninitialized template,
   keep `docs/wiki/` and `docs/raw/` scaffolds blank: do not add migration todos,
   requirements, entities, ADRs, transcripts, or log entries. Put maintenance
   evidence in tests and commit messages. Project initialization fills these pages
   only from the adopting project's facts and the human's answers.


## Files and shell commands

Paths written in backticks are repository-root paths unless explicitly relative.
Markdown links are navigation, not file inclusion. Read linked instructions when
directed. Only `CLAUDE.md` uses a native `@` import; other prompt content is expanded
by the generator. Do not assume `@path` or shell interpolation works in arbitrary
agent or skill bodies. Shared skills take the user's trailing context as their
argument, including spaces, quotes, Unicode, and newlines. Forward it verbatim
when delegating; never interpolate it into shell command text.

Shell examples labeled `bash` require Bash (Git Bash on Windows), not PowerShell.
Use the active shell's equivalents where necessary, preserving error checks and
quoting. The template's Node.js checks run directly in either shell. Do not confuse
template checks with the adopting application's test command.

## Wiki map

- `docs/raw/`: immutable input; append new project sources, never edit old sources.
- `docs/wiki/requirements.md`: what the application must do.
- `docs/wiki/architecture.md`: stack, layout, patterns, testing strategy.
- `docs/wiki/entities/`: feature/module specs and Behavior cases.
- `docs/wiki/concepts/`, `decisions/`, `summaries/`: patterns, ADRs, source summaries.
- `docs/wiki/design-system.md`: UI-only design contract, created when needed.
- `docs/wiki/commands.md`: verified application commands.
- `docs/wiki/todos.md`, `gotchas.md`, `log.md`, `wiki-todos.md`: work, traps, history,
  deferred wiki maintenance. Closed todos are removed; git records shipped work.

The wiki follows the Obsidian LLM-wiki standard in
`.harness/skills/wiki-update/SKILL.md`. Navigation uses the directory tree and graph;
there is no hand-maintained wiki index or glossary. Stack knowledge belongs in
skills, not additional domain agents. Evolve the toolkit through `update-toolkit`.


# Behavioral Rules

Hard constraints from real failures. These override default agent inclinations.

1. **Wiki-first, code-second.** Never change code behavior without also updating the relevant `docs/wiki/entities/<slug>.md`. If the spec is wrong, fix the spec first, then the code — in the same commit.

2. **Tests before implementation.** Never write production code without a failing test first. The Red phase is mandatory. Nothing enforces this on `feat/*` and `fix/*` — keeping the discipline is on you.

3. **Never modify tests to make them pass.** If a test seems wrong, update the entity Behavior spec → regenerate the test → implement. Changing a test to match broken code is not TDD.

4. **Tests must fail for the right reason.** A passing test before implementation tests existing behavior, not the new feature. Confirm RED is real (missing feature, not a typo or import error).

6. **Verify before asserting.** Run it, don't assume. Never tell the human a feature works unless tests pass and you read the output yourself.

7. **Never present uncertain information as fact.** If you're not sure, say so.

8. **Human in the loop.** When you need a decision the wiki doesn't answer, stop and ask. Use the `human-checkpoint` skill to format the ask. Do not silently improvise.

9. **No silent failures.** If a command fails, report the exact error.

11. **Raw sources are immutable.** Never edit files under `docs/raw/`. Only append new ones.

13. **Progressive disclosure.** Don't preload domain knowledge. Skills auto-load when their `description` matches the task. If a needed skill doesn't exist, create one via the `update-toolkit` skill rather than stuffing it into an agent prompt.

14. **Skills are how-to, not what-is.** When writing or editing a skill, the body must be a procedure: read these wiki pages, follow these steps, update these pages. Never explain a concept the LLM already knows.

15. **One agent owns the TDD loop.** The `developer` writes the failing test, confirms Red itself (rule 4 — don't trust a prior step), then implements. No tester/implementer split, no handoff JSON. The only upstream split is the `planner` (the reasoning profile), which returns a complete Markdown plan for `[complex]`/batched work. The conductor may persist `.harness/handoff/<slug>-plan.md` and passes the full plan inline to the developer; ignored scratch is not shared between worktrees. The entity Behavior cases remain the spec.

16. **Append, don't bury.** When writable agents discover something within their owned scope the maintainer should clean up later (orphan page, missing ADR, repeated concept), append a one-line entry to `docs/wiki/wiki-todos.md`. Don't wait for `project-wiki-lint`. Read-only agents report the discovery to the conductor instead of writing a queue entry.

17. **Use the existing workflow before improvising.** Slash commands and skills exist for a reason. If the workflow seems missing, add a command or skill via the `update-toolkit` skill — don't work around the gap silently.

18. **Obsidian LLM-wiki standard — hard rules.** Violating these breaks rendering, the graph, or dedup. Full standard: `wiki-update` skill. The invariants, inside `docs/wiki/`:
    - **Wikilink syntax.** Internal links are `[[wiki-style]]` (`[[entities/auth]]`, `[[gotchas#login-flow]]`, `[[concepts/retry-pattern|alias]]`), tags `#tag`, embeds `![[summaries/x]]`. External URLs and non-wiki files keep standard markdown links. A broken wikilink is a bug.
    - **Identity = filename.** No `id`/`name` field; alternative names go in `aliases`. Filenames never contain `* " \ / < > : | ? # ^ [ ]`.
    - **One page = one concept.** Before creating a page, check existing filenames and `aliases`; if the concept exists → update, don't duplicate.
    - **Flat frontmatter, quoted-solitary wikilinks.** No nested objects; plural special keys (`tags`, `aliases`, `cssclasses`); one `"[[page]]"` per list element.
    - **Closed vocabularies** for `type`/`abstraction`/`status` (defined in `wiki-update`); properties lowercase `snake_case`.
    - **Provenance, never invent.** Every non-trivial claim traces to a `docs/raw/` file; an unfillable gap is an `open_questions` entry or a question to the human, never invented prose.

21. **A dirty tree you did not dirty belongs to someone else.** Workers run in separate worktrees; the integration checkout can still contain human or other-session changes. "Clean working tree" preconditions mean a verified clean checkout, not permission to erase unknown work. Never `stash`, `reset --hard`, `checkout --`, or `clean` over changes whose author you cannot account for — stop and run `human-checkpoint` naming the paths. Before any tree-wide destructive git operation, `git status --porcelain` and account for every line: a path you didn't touch this session is evidence, not dirt.
