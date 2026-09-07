---
name: behavioral-rules
description: "Hard behavioral constraints for all agents. Loaded at session start."
---

# Behavioral Rules

Hard constraints from real failures. These override default agent inclinations.

1. **Wiki-first, code-second.** Never change code behavior without also updating the relevant `docs/wiki/entities/<slug>.md`. If the spec is wrong, fix the spec first, then the code — in the same commit.

2. **Tests before implementation.** Never write production code without a failing test first. The Red phase is mandatory. Nothing enforces this on `feat/*` and `fix/*` — keeping the discipline is on you.

3. **Never modify tests to make them pass.** If a test seems wrong, update the entity Behavior spec → regenerate the test → implement. Changing a test to match broken code is not TDD.

4. **Tests must fail for the right reason.** A passing test before implementation tests existing behavior, not the new feature. Confirm RED is real (missing feature, not a typo or import error).

5. **Two-strike pivot.** Two failures on the same mechanism → stop and preserve the state. A worker returns both failures and its task ID to the conductor without tagging or resetting. The conductor may tag known committed state (`git tag checkpoint-<stamp>`) and puts any proposed reset to the human via `human-checkpoint`, presenting both failed attempts. Only on their say-so do you `git reset --hard` and re-spec via `{{cmd:interview}}`. The reset is gated because it is the most destructive step in this workflow: the tag protects committed history, but nothing protects uncommitted work — before it runs, `git status --porcelain` and account for every line (rule 21).

6. **Verify before asserting.** Run it, don't assume. Never tell the human a feature works unless tests pass and you read the output yourself.

7. **Never present uncertain information as fact.** If you're not sure, say so.

8. **Human in the loop.** When you need a decision the wiki doesn't answer, stop and ask. Use the `human-checkpoint` skill to format the ask. Do not silently improvise.

9. **No silent failures.** If a command fails, report the exact error.

10. **Scoped context for sub-agents.** Give sub-agents only the task, prior outputs, and relevant constraints. Never dump full memory.

11. **Raw sources are immutable.** Never edit files under `docs/raw/`. Only append new ones.

12. **Two review roles — never merged, both read-only.** The `reviewer` is periodic and whole-repo, in a fresh session context via `{{cmd:review}}`, never inside the work loop. The `adversary` is diff-scoped and per-change, dispatched by `{{cmd:work}}` step 7a (`[complex]`/batched) or `{{cmd:adversary}}`. Both read without the author's context and raise **findings only** — no edits, commits, pushes, or resets. A developer never audits its own work; a reviewer of either kind never fixes what it finds.

13. **Progressive disclosure.** Don't preload domain knowledge. Skills auto-load when their `description` matches the task. If a needed skill doesn't exist, create one via the `update-toolkit` skill rather than stuffing it into an agent prompt.

14. **Skills are how-to, not what-is.** When writing or editing a skill, the body must be a procedure: read these wiki pages, follow these steps, update these pages. Never explain a concept the LLM already knows.

15. **One agent owns the TDD loop.** The `developer` writes the failing test, confirms Red itself (rule 4 — don't trust a prior step), then implements. No tester/implementer split, no handoff JSON. The only upstream split is the `planner` (the reasoning profile), which returns a complete Markdown plan for `[complex]`/batched work. The conductor may persist `.harness/handoff/<slug>-plan.md` and passes the full plan inline to the developer; ignored scratch is not shared between worktrees. The entity Behavior cases remain the spec.

16. **Append, don't bury.** When writable agents discover something within their owned scope the maintainer should clean up later (orphan page, missing ADR, repeated concept), append a one-line entry to `docs/wiki/wiki-todos.md`. Don't wait for `{{cmd:wiki-lint}}`. Read-only agents report the discovery to the conductor instead of writing a queue entry.

17. **Use the existing workflow before improvising.** Slash commands and skills exist for a reason. If the workflow seems missing, add a command or skill via the `update-toolkit` skill — don't work around the gap silently.

18. **Obsidian LLM-wiki standard — hard rules.** Violating these breaks rendering, the graph, or dedup. Full standard: `wiki-update` skill. The invariants, inside `docs/wiki/`:
    - **Wikilink syntax.** Internal links are `[[wiki-style]]` (`[[entities/auth]]`, `[[gotchas#login-flow]]`, `[[concepts/retry-pattern|alias]]`), tags `#tag`, embeds `![[summaries/x]]`. External URLs and non-wiki files keep standard markdown links. A broken wikilink is a bug.
    - **Identity = filename.** No `id`/`name` field; alternative names go in `aliases`. Filenames never contain `* " \ / < > : | ? # ^ [ ]`.
    - **One page = one concept.** Before creating a page, check existing filenames and `aliases`; if the concept exists → update, don't duplicate.
    - **Flat frontmatter, quoted-solitary wikilinks.** No nested objects; plural special keys (`tags`, `aliases`, `cssclasses`); one `"[[page]]"` per list element.
    - **Closed vocabularies** for `type`/`abstraction`/`status` (defined in `wiki-update`); properties lowercase `snake_case`.
    - **Provenance, never invent.** Every non-trivial claim traces to a `docs/raw/` file; an unfillable gap is an `open_questions` entry or a question to the human, never invented prose.

19. **Branch for code changes; living wiki commits directly on develop (or current branch).**
    - **Code (`feat/*`, `fix/*`, `refactor/*`, `perf/*`)** is built on a dedicated branch cut from `develop` and merged via PR. A dispatched `developer` writes files and never runs git: the supervising runner commits its owned paths on the worker branch after a successful exit, with the subject the conductor passed to `spawn_worker` (rule 23). MCP integrates completed workers into the conductor's feature branch; the conductor verifies, pushes, and opens the PR. Work the conductor does itself, outside a worker, it commits itself.
    - **Living documentation & operations (`docs/wiki/`, `docs/raw/`, `.harness/` config)** from maintenance commands commit and push directly to `develop` — or stay on the active `feat/*`/`fix/*`/`chore/*` branch when mid-cycle. Strict PR gating for code, no PR fatigue for knowledge.
    - **The conductor pushes integration commits.** Workers never push. Their local branches and logs preserve results until integration, but are not an off-device backup. After each verified worker merge or conductor commit, push the integration branch. On network failure, retry with bounded backoff and report any remaining unpushed commits. No remote → skip the push and report local-only work.
    - **The log entry belongs to the mutation, not to the command.** Whatever changed tracked files — a command, a bare chat instruction, a one-off fix — appends a `## [YYYY-MM-DD HH:MM] <kind>` entry to `docs/wiki/log.md` in the same commit (`chore` when no kind fits). A timeline with holes is worse than none, because the wiki cites it as evidence. Coordinate ledger ownership: include log changes in the worker's owned paths or have the conductor record them after integration. During blank-template maintenance, do not fill wiki/raw scaffolds; record evidence in tests and commit messages instead.

20. **Every finding gets a written disposition, and the record is committed.** Each numbered adversary finding ends as **Filed** (a real todo line), **Fixed** (name what changed), or **Rejected** (one-sentence reason). Silence is not a disposition and "unlikely" is not a reason. Rejecting by citing an unwritten invariant → write the invariant down as part of the rejection.
    - **Filed is the default; fixing needs a human.** Findings become todos at the priority their severity maps to — not fixed in the cycle that surfaced them, not even two-line ones. Exception: a `critical`/`major` goes to the human via `human-checkpoint` (fix-now or queue); it is filed at P0/P1 only if they decline or are unreachable, and that is said prominently. A human instruction like "fix all the findings" is itself the approval, at that scope.
    - **The record is the commit.** Triage in the gitignored mailbox, then write each disposition into the commit that answers it: fixes name their finding; each round closes with a `docs(<slug>): adversary round N` commit whose body lists every finding's disposition. `git log --grep="adversary round"` must read the reasons back a cycle later — a disposition that exists only in deleted scratch satisfies nothing. Protocol: `adversarial-review` skill.

21. **A dirty tree you did not dirty belongs to someone else.** Workers run in separate worktrees; the integration checkout can still contain human or other-session changes. "Clean working tree" preconditions mean a verified clean checkout, not permission to erase unknown work. Never `stash`, `reset --hard`, `checkout --`, or `clean` over changes whose author you cannot account for — stop and run `human-checkpoint` naming the paths. Before any tree-wide destructive git operation, `git status --porcelain` and account for every line: a path you didn't touch this session is evidence, not dirt.

22. **A filed backlog needs a consumer, or filing is just deletion with extra steps.** Rule 20 makes filing the default, so `minor` findings accumulate by design (`nit` findings are never filed — the adversary tallies them and they end there). Two computable guards: `FINDINGS_MAX` caps the open `[adversary]` backlog (`docs/wiki/todos.md § Filed-findings backlog`), and `{{cmd:wiki-lint}}` re-triages it every pass — re-grading, merging duplicates, closing what later work fixed. A finding that sat unread through five cycles had the wrong severity, not too short a queue.

23. **MCP is the worker control plane, and the supervisor commits.** The conductor follows `mcp-coordination` for spawn, status, cancellation, and SHA-pinned local integration. Workers obey `.harness/worker-contract.md`: no recursive dispatch, commits, branch changes, pushes, PRs, merges, resets, stashes, tags, or cleanup. The toolkit generates no native agent files, so MCP dispatch is the only way to run a worker; a host CLI's own subagent tooling is not a second path. Serialize overlapping ownership and merge dependencies before dispatching dependents. On failure, preserve worktrees and logs; never force-clean to manufacture success.
    - **A worker delivers files; its runner delivers the commit.** One convention for every CLI, because two of the three cannot commit at all — Codex's `workspace-write` sandbox protects `.git`, and Antigravity denies every unlisted shell command in headless mode. The runner stages the worker's owned paths after a successful exit and commits them with the subject passed as `spawn_worker`'s `commit_message`; pass one, because it becomes a real line of project history. Nothing is committed for a failed, cancelled, or timed-out worker, and nothing at all for a read-only role.
    - **Out-of-scope edits are not committed, and that is the alarm.** If the worker touched anything outside `owned_paths`, the runner commits nothing and fails the task naming the paths. Do not "fix" that by widening ownership after the fact; read what it wrote first.

## Adding rules

When a new failure pattern emerges that's broader than a project-specific quirk (i.e. it's a discipline issue, not a domain detail), append it here as a numbered rule. Project-specific failures go in `docs/wiki/gotchas.md`.
