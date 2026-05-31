---
name: behavioral-rules
description: Hard behavioral constraints for all agents. Loaded at session start.
type: rule
---

# Behavioral Rules

Hard constraints from real failures. These override default agent inclinations; harness hooks back several of them.

1. **Wiki-first, code-second.** Never change code behavior without also updating the relevant `docs/wiki/entities/<slug>.md`. If the spec is wrong, fix the spec first, then the code. The `wiki-drift-check` hook warns at session end if you only touched code.

2. **Tests before implementation.** Never write production code without a failing test first. The Red phase is mandatory. The `test-first-check` hook _reminds_ you on `feat/*` and `fix/*` when code is edited with no test in the session's changes — it no longer blocks, so keeping the discipline is on you.

3. **Never modify tests to make them pass.** If a test seems wrong, update the entity Behavior spec → regenerate the test → implement. Changing a test to match broken code is not TDD.

4. **Tests must fail for the right reason.** A passing test before implementation tests existing behavior, not the new feature. Confirm RED is real (missing feature, not a typo or import error).

5. **Two-strike pivot.** If an approach fails twice on the same mechanism, try a fundamentally different one. Two failures → tag the state (`git tag checkpoint-<stamp>`), `git reset --hard` to a known-good commit, and re-spec via `/project:interview`.

6. **Verify before asserting.** Run it, don't assume. Never tell the human a feature works unless tests pass and you read the output yourself.

7. **Never present uncertain information as fact.** If you're not sure, say so.

8. **Human in the loop.** When you need a decision the wiki doesn't answer, stop and ask. Use the `human-checkpoint` skill to format the ask. Do not silently improvise.

9. **No silent failures.** If a command fails, report the exact error.

10. **Scoped context for sub-agents.** Give sub-agents only the task, prior outputs, and relevant constraints. Never dump full memory.

11. **Raw sources are immutable.** Never edit files under `docs/raw/`. Only append new ones.

12. **Reviewer is periodic and isolated.** `/project:review` runs in a fresh worktree with no `developer` context. Not part of the work loop.

13. **Progressive disclosure.** Don't preload domain knowledge. Skills auto-load when their `description` matches the task. If a needed skill doesn't exist, create one via `update-skill` rather than stuffing it into an agent prompt.

14. **Skills are how-to, not what-is.** When writing or editing a skill, the body must be a procedure: read these wiki pages, follow these steps, update these pages. Never explain a concept the LLM already knows.

15. **One agent owns the TDD loop.** The `developer` writes the failing test, confirms Red itself, then implements — there is no separate `tester`/`implementer` split and no handoff JSON to write or read. Red must be genuine (rule 4) before any production code; confirm it yourself, don't trust a prior step. The only upstream split is the `planner` (Opus), which writes a `.claude/handoff/<slug>-plan.md` for `[complex]`/batched work — markdown scratch the developer reads, never a contract it must validate.

16. **Append, don't bury.** When agents discover something the maintainer should clean up later (orphan page, missing ADR, repeated concept), append a one-line entry to `docs/wiki/wiki-todos.md`. Don't wait for `/project:wiki-lint`.

17. **Use the existing workflow before improvising.** Slash commands and skills exist for a reason. If the workflow seems missing, add a command or skill via the meta skills — don't work around the gap silently.

18. **Obsidian-format the wiki.** Inside `docs/wiki/`, all internal links use `[[wiki-style]]` syntax — e.g. `[[entities/auth]]`, `[[gotchas#login-flow]]`, or `[[concepts/retry-pattern|the retry pattern]]`. Tags use `#tag`. Embeds use `![[summaries/some-source]]`. The wiki is browsed in Obsidian; broken Obsidian links are a bug. External URLs and references to non-wiki files (`.claude/...`, `src/...`) keep standard markdown link syntax.

19. **Finalize with commit + push.** Any command or agent that mutates tracked files ends by committing the change and pushing it to the working branch (`git push -u origin <branch>`). A local commit is not enough: remote execution containers are recycled between sessions, so an unpushed commit is lost work. The orchestrating command (`/project:work`) owns the final bundled commit + push. Read-only commands and gitignored artifacts (the `*-plan.md` scratch) are the only exceptions. On network failure, retry the push with exponential backoff; never bypass hooks with `--no-verify`.

20. **Branch model & LLM-owned, human-approved integration.** The agent owns git state end to end; the human approves but does not run git. Work runs on two protected long-lived branches: `main` (released) and `develop` (integration). Cut every short-lived branch (`feat/*`, `fix/*`, `chore/*`, `docs/*`, `refactor/*`, `test/*`, `perf/*`) from `develop`; cut `hotfix/*` from `main`. **Never commit directly to `main` or `develop`** — the sole carve-out is append-only `docs/wiki/log.md` bookkeeping records (the `session-end` hook's auto-log and the `/project:release` log entry). Integrate via the `branch-merge` skill: `feat/* → develop` with a `--no-ff` merge at the end of each cycle, and `develop → main` via `/project:release` — each only after explicit human go-ahead in the current conversation. Re-run the full suite on the protected branch after the merge; never push it red. Never force-push `main` or `develop` (`--force-with-lease` is for feature branches only). The full policy is in `docs/wiki/git-conventions.md`.

## Adding rules

When a new failure pattern emerges that's broader than a project-specific quirk (i.e. it's a discipline issue, not a domain detail), append it here as a numbered rule. Project-specific failures go in `docs/wiki/gotchas.md`.
