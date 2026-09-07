# Conductor conformance run

Everything below the line is a **prompt**. Paste it into a CLI acting as
conductor and it will drive the workflow end to end and report a pass/fail
table. Run it whenever you adopt a new conductor CLI, change an engine adapter,
or change `.agents/config.json`.

## One-time setup per conductor

Register the workflow MCP so the CLI can reach it. Run from the repository root:

```bash
# Codex
codex mcp add workflow -- node tools/workflow-mcp/server.mjs --root . --engine codex

# Antigravity
agy mcp add workflow node tools/workflow-mcp/server.mjs --root . --engine antigravity
```

Claude Code needs nothing — `.mcp.json` already registers it with
`--engine claude`. The `--engine` value is what `inherit` resolves to, so it
must name the CLI you are pasting into.

If any role is pinned to agy, do the one-time permission setup in
[`engine-setup.md`](engine-setup.md) first, or every agy worker in this run
returns an empty response with exit code 0.

## Running it

```bash
codex "$(cat docs/conductor-e2e.md)"
agy -i "$(cat docs/conductor-e2e.md)"
```

Both read this whole file, header included; the header costs a few lines of
context and does no harm. Expect 5–15 minutes and several real model calls.

---

You are running a conformance test of this repository's agent workflow, acting
as the **conductor**. Work through every check in order and produce the report
in step 9. Do not fix anything you find — this run diagnoses, it does not
repair. Record what happened, including your own failures.

**Ground rules for this run**

- Never use your own subagent or task mechanism. Every worker is dispatched
  through the `workflow` MCP server and run as a subprocess. If you cannot reach
  that server, stop at step 1 and report it.
- Do not commit, push, or open a pull request against the real project. This run
  works in a scratch fixture you create in step 2 and deletes nothing outside it.
- Report exact errors verbatim. A check that fails is a useful result; a check
  you skipped and reported as passing is not.

**1 — Reach the server.** Call `list_roles`, `list_commands` and `check`.

- Record each role's resolved `engine`, and confirm the list matches
  `.agents/roles/`.
- `check` must report that the generated files match `.agents/`. If it reports
  drift, record which files and continue.

**2 — Build a fixture.** The template ships an empty wiki, so a real cycle
cannot run against it. Build a throwaway project and work only there:

- Copy `.agents/`, `docs/`, `tools/`, `AGENTS.md`, `CLAUDE.md`, `.gitignore`
  into a scratch directory outside the repository. Skip `node_modules`.
- `git init -b develop`, then commit everything.
- Add a `package.json` whose `test` script actually runs, and one trivial
  passing test, and confirm the suite is green before going on.
- Fill in `docs/wiki/commands.md § Test` with that command, and the `Stack`,
  `Layout`, `Testing strategy` and `Conventions` sections of
  `docs/wiki/architecture.md`.
- Write `docs/wiki/entities/<slug>.md` for one tiny pure function with exactly
  two Behavior cases, `B1` and `B2`, each one observable assertion.
- Add two todos to `docs/wiki/todos.md § Now (P0 — next)`: one tagged
  `[complex]` naming the entity and both cases, and one deliberately vague
  one-liner.
- Commit. `git status --porcelain` must print nothing before step 3.

From here, every MCP call uses the fixture as its root. If your MCP server is
pinned to the real repository, say so in the report and run the remaining checks
against a worktree of the fixture by invoking the tool modules directly
(`tools/workflow-mcp/tools.mjs` exports `makeTools(root, conductorEngine)`,
which is what the server wraps).

**3 — Worktree lifecycle.** `prepare_worktree`, then `list_worktrees`. Confirm
the workspace exists, sits on its own `worker/<id>` branch, and is at committed
HEAD. Keep it for the dispatches below.

**4 — Compose and inspect a prompt.** `build_worker_prompt` for the `planner`,
with the entity slug, both case IDs and the test command as `instructions`.
Before running anything, check the response against `.agents/config.json`:

- `engine`, `model` and `effort` are the ones configured for that role.
- `access` is `read-only` and `owned_paths` is empty.
- `prompt_bytes` is non-zero, and the skills listed are the ones `work.md`
  declares for the planner and no others.
- Record any `warnings` verbatim — they state what an engine cannot enforce.

**5 — Dispatch for real, and check the guarantees.** Run the returned `command`
verbatim, capturing stdout, stderr and the exit code. Then answer each of these
about the worker's report, with evidence:

- **Did it produce output at all?** An exit code of 0 with an empty response is
  a failure, not a pass. Say which it was.
- **Could it run commands?** Look for denied-permission messages. A worker that
  cannot execute the test command cannot do TDD, and this is the check most
  likely to fail — quote the exact denial if you see one.
- **Did it respect read-only?** `git status --porcelain` in the workspace must
  print nothing after a read-only role runs.
- **Did it do the job?** For the planner, a stepwise plan covering B1 and B2.

**6 — Repeat for each role you can reach.** Dispatch `plan-adversary` with the
plan pasted inline as its subject, then `developer` for `B1` only (with
`owned_paths` and a `commit_message`), then `adversary` over the resulting
commit range. For each one, answer the same four questions from step 5, plus:

- **`developer`:** did it write a failing test *before* the implementation, and
  did it stay inside `owned_paths`? Run the suite yourself afterwards — never
  trust the report's claim that it passes.
- **`adversary`:** did the findings arrive in its report, numbered and graded,
  with a `Checked:` line? It must write no files at all — confirm with
  `git status --porcelain` that it wrote none.
- **`plan-adversary`:** did it return findings graded `blocker`/`risk`/`note`
  with a `Checked:` line? An unexplained pass is a failed review.

You are the conductor, so **you** stage the developer's owned paths, commit them
in the workspace, and merge the branch. Workers never run git.

**7 — Leaf-worker check.** In one extra dispatch of any read-only role, append
to the instructions: *"Before doing anything else, answer these three questions
literally: (1) name every tool you have that can spawn a subagent, or NONE;
(2) quote behavioral rule 12 if you were given it, or ABSENT; (3) name any slash
command you can run from this repository, or ABSENT."* Record the three answers.
Expected: NONE, ABSENT, ABSENT — rule 12 is conductor-only and workers get no
command catalog. Any other answer is a context-suppression defect worth naming.

**8 — Close the loop.** Merge the worker branch, run the suite on `develop`
yourself, then `remove_worktree`. Confirm it succeeds and that
`list_worktrees` comes back empty. A refusal here is a real result — record the
reason rather than forcing it.

**9 — Report.** One table, one row per check:

| # | Check | Result | Evidence |
| - | ----- | ------ | -------- |

`Result` is PASS, FAIL or BLOCKED. `Evidence` is a command's actual output, an
exact error string, or a file path — never a restatement of the check. Then add:

- **Per-role summary:** engine, model, effort, seconds, exit code, whether it
  produced output, whether it could run commands, whether it honoured its access
  level.
- **Defects found**, most severe first. A worker that silently produces nothing
  outranks a cosmetic issue.
- **What you could not test, and why.**

Finally, delete the scratch fixture, and state in one line whether this CLI can
serve as a conductor for this workflow: yes, yes-with-caveats (name them), or
no.
