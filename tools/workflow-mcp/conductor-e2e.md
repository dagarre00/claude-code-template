# Conductor conformance run

Everything below the line is a **prompt**: paste it into a CLI acting as conductor and it drives the workflow end to end and reports a pass/fail table. Run it when you adopt a new conductor CLI, and again after changing `.agents/config.json`.

To check a **worker engine** instead — after upgrading its CLI or adapter, or before moving a role onto it — no conductor is needed: `npm --prefix tools/workflow-mcp run e2e -- --engine <name>` runs the scripted equivalent of steps 3–8 and exits non-zero on any failed check.

## One-time setup per conductor

Register the workflow MCP with **absolute paths** — codex and agy spawn the server from a directory that is not necessarily the repository ([Troubleshooting](getting-started.md#troubleshooting)):

```bash
# Codex: scripts/adopt.sh writes the project-local .codex/config.toml; by hand:
codex mcp add workflow -- node /abs/path/to/repo/tools/workflow-mcp/server.mjs --root /abs/path/to/repo --engine codex

# Antigravity (machine-global — re-register when you switch projects)
agy mcp add workflow node /abs/path/to/repo/tools/workflow-mcp/server.mjs --root /abs/path/to/repo --engine antigravity
```

Claude Code needs nothing: `.mcp.json` registers it with `--engine claude`. `--engine` is what `inherit` resolves to, so it must name the CLI you paste into. If any role runs on agy, do the one-time grant in [`engine-setup.md`](engine-setup.md) first, or every agy worker returns an empty response with exit 0.

```bash
codex "$(cat tools/workflow-mcp/conductor-e2e.md)"
agy -i "$(cat tools/workflow-mcp/conductor-e2e.md)"
```

Expect 5–15 minutes and several real model calls.

---

You are running a conformance test of this repository's agent workflow, acting as the **conductor**. Work through every check in order and produce the report in step 9. Diagnose, don't repair: record what happened, including your own failures.

**Ground rules**

- Never use your own subagent or task tool. Every worker is dispatched through the `workflow` MCP server and run as a subprocess. Can't reach the server → stop at step 1 and report it.
- No commits, pushes or pull requests against the real project. Work only in the scratch fixture from step 2, and delete nothing outside it.
- Report exact errors verbatim. A failed check is a useful result; a skipped check reported as passing is not.

**1 — Reach the server.** Call `list_roles` and `check`. Record each role's resolved `engine` and confirm the list matches `.agents/roles/`. `check` must report the generated files in sync (record any drift and continue), and every engine's `setup.ok` must be true — record `missing_command_grants` verbatim; on agy each is a worker that dies on its first command.

**2 — Build a fixture.** The template's wiki is empty, so build a throwaway project outside the repository:

- Copy `.agents/`, `docs/`, `tools/` (without `node_modules`), `AGENTS.md`, `CLAUDE.md`, `.gitignore`; `git init -b develop`; commit.
- Add a `package.json` whose `test` script runs, with one trivial passing test; confirm the suite is green.
- Fill `docs/wiki/commands.md § Test` and the `Stack`, `Layout`, `Testing strategy` and `Conventions` sections of `docs/wiki/architecture.md`.
- Write `docs/wiki/entities/<slug>.md` for one tiny pure function with exactly two single-assertion cases, `B1` and `B2`.
- Add two todos under `docs/wiki/todos.md § Now (P0 — next)`: one `[complex]` naming the entity and both cases, one deliberately vague one-liner.
- Commit; `git status --porcelain` must print nothing.

From here every MCP call uses the fixture as its root. If your server is pinned to the real repository, say so and run the remaining checks by invoking the tool modules directly (`tools/workflow-mcp/tools.mjs` exports `makeTools(root, conductorEngine)`, which the server wraps).

**3 — Worktree lifecycle.** `prepare_worktree`, then `list_worktrees`: the workspace exists, on its own `worker/<id>` branch, at committed HEAD. Keep it.

**4 — Compose a prompt.** `build_worker_prompt` for the `planner`, with the entity slug, both case IDs and the test command as `instructions`. Before running anything, check the response against `.agents/config.json`: `engine`, `model` and `effort` match the role's config (`engine_chain` shows its order, `engine_available` whether the CLI is installed, and a fallback announces itself in `warnings`); `access` is `read-only` with empty `owned_paths`; `prompt_bytes` is non-zero; the skills are exactly those `work.md` declares for the planner. Record any `warnings` verbatim.

**5 — Dispatch for real.** Run the returned `command` verbatim in a POSIX shell sharing this checkout's filesystem (Git Bash on Windows, never WSL), or launch from the structured `executable`/`args`/`cwd`/`stdin_file` fields. Capture stdout, stderr and the exit code. On every engine the command leaves the worker's report in `report_file` (the full codex/agy transcript goes to `raw_file`, for debugging only) — read `report_file` the same way whatever the engine. Call `inspect_dispatch` and record its `verdict` and reasons verbatim before reading the report yourself, then `record_decision`. Answer, with evidence:

- **Did it produce output?** Exit 0 with an empty response is a failure. Did `inspect_dispatch` agree? A mechanical verdict that contradicts what you read is an MCP defect.
- **Could it run commands?** Quote any denied-permission message — a worker that can't run the test command can't do TDD, and this is the check most likely to fail.
- **Did it respect read-only?** `list_worktrees` must show this workspace `clean` with empty `violations`.
- **Did it stay in its workspace?** Record the audit's `reads_outside_workspace` and `commands_not_allowlisted` (agy and codex). A read outside is not a failed dispatch, but it is a finding.
- **Did it do the job?** For the planner: a stepwise plan covering B1 and B2.

**6 — Repeat for each role you can reach.** Save the plan to a file; dispatch `plan-adversary` with `instructions_file` pointing at it; then `developer` for `B1` only (same file, plus `owned_paths`, `test_paths`, `test_command` and a `commit_message`); then `adversary` over the resulting commit range with `diff_range`. Answer step 5's questions for each, plus:

- **`developer`:** a failing test *before* the implementation — run its `red_check_command` — and every change inside `owned_paths`. Run the suite yourself; never trust the report's claim.
- **`adversary`:** findings in its report, numbered and graded, with a `Checked:` line, citing lines actually in the range (confirm `## Diff under review` was in its prompt). It wrote no files: `violations` empty.
- **`plan-adversary`:** findings graded `blocker`/`risk`/`note`, with a `Checked:` line. An unexplained pass is a failed review.

**You** stage the developer's owned paths, commit them in the workspace and merge the branch — workers never run git.

**7 — Leaf-worker check.** In one extra read-only dispatch, append to the instructions: *"Before anything else, answer literally: (1) name every tool you have that can spawn a subagent, or NONE; (2) quote the behavioral rule that names the three review roles (plan-adversary, adversary, reviewer) if you were given it, or ABSENT; (3) name any slash command you can run from this repository, or ABSENT; (4) name every tool you have that can create or modify a file, or NONE."* Expected: NONE, ABSENT, ABSENT, NONE — that rule is conductor-only, workers get no command catalog, and read-only workers have no subagent or write tools. Ask for the rule by content, never by number (workers get the rules renumbered). Confirm any other answer against the transcript or audit — a worker's account of its own tools is not evidence on its own.

**8 — Close the loop.** Merge the worker branch, run the suite on `develop` yourself, then `remove_worktree`; `list_worktrees` must come back empty. A refusal is a real result — record the reason rather than forcing it.

**9 — Report.** One table, one row per check:

| # | Check | Result | Evidence |
| - | ----- | ------ | -------- |

`Result` is PASS, FAIL or BLOCKED; `Evidence` is actual output, an exact error or a file path — never a restatement of the check. Then: a **per-role summary** (engine, model, effort, seconds, exit code, output produced, commands runnable, access honoured); **defects**, most severe first (a worker that silently produces nothing outranks a cosmetic issue); and **what you could not test, and why**. Finally delete the fixture, and say in one line whether this CLI can conduct this workflow: yes, yes-with-caveats (name them), or no.
