# Harness side prompt — Antigravity

> Pairs with `workflow-meta-prompt.md` (§3.4). It says where the canonical workflow lands in Antigravity (the `agy` CLI and the desktop app) and in what format. It adds no role, rule, step or skill: everything it maps is defined once under `workflow/` and `AGENTS.md`.

## 1. Verified on

Antigravity CLI **1.4.11**, 2026-10-30. Sources: `agy --help`, the built-in `agy-customizations` skill (`~/.gemini/antigravity-cli/builtin/skills/`), the live docs at `antigravity.google/docs` (subagents, headless, sandbox, CLI reference), and headless probes in a scratch repo. Facts marked **(seen)** were observed in a probe; the rest come from those docs. Run §11 again whenever the installed version differs. Check the installed version with `agy --version`.

## 2. Instructions

- Antigravity loads `AGENTS.md` (and `GEMINI.md`) from the working directory up to the repository root as always-on rules **(seen)**. **No adapter is needed** for facts and rules.
- Don't add a `GEMINI.md` or `.agents/rules/` file that repeats `AGENTS.md`.
- Each rule file is capped at 24,000 bytes, and always-on rules share a 20,000-token budget. Rules over the budget are demoted to path pointers. `AGENTS.md`'s own budget keeps it far below both.

## 3. Adapter map

Workspace customizations live under `.agents/`. Antigravity also accepts `.agent/`, `_agents/` and `_agent/`.

| Canonical | Antigravity target | Form |
| --- | --- | --- |
| `AGENTS.md` | — | loaded natively **(seen)** |
| `workflow/skills/<name>/SKILL.md` | `.agents/skills.json`: `{"entries": [{"path": "workflow/skills"}]}` | reference **(seen)** |
| `workflow/roles/<role>.md` | `.agents/agents/<role>.md` | generated |
| `workflow/commands/<name>.md` | `.agents/skills/<name>/SKILL.md`, a slash-invocable skill (`/<name>`) | generated |
| allowlists | `permissions.allow` in `~/.gemini/antigravity-cli/settings.json` | **per user, outside the repo**: see §7 |
| guards (optional) | `.agents/hooks.json` | hand-written |

- **Skills by reference.** Paths in `skills.json` that don't start with `/` or `~/` resolve from the repository root. Each entry directory is scanned **one level deep**, which matches `workflow/skills/<name>/SKILL.md`; `include_only` and `exclude` take name patterns. A skill's `name` must equal its folder, and its body must stay under 24 KB.
- **Commands are skills.** Antigravity's older "workflows" are being migrated to skills (it ships a built-in `migrate-workflows` skill). Commands and skills share one namespace, so canonical command and skill names must not collide.
- Every generated file carries `<!-- generated from <canonical path> by wf adapters; edit that file -->` right after its frontmatter.

### Role → `.agents/agents/<role>.md`

| Antigravity key | Rendered from |
| --- | --- |
| `name` | `name` (no colons) |
| `description` | `description`, quoted. The planner uses it to decide on delegation, so keep the "dispatched by `<command>` only" clause |
| `model` | The override for this role on Antigravity in `runners.md`, otherwise the role's tier in the tier map (§8): `pro` or `flash` |
| `tools` | **Required.** It defaults to `[]`, which means *no tools* **(seen)**. Build it from `access` and `capabilities`: shell → `read_file`, `grep_search`, `list_dir`, `run_command`; write → add `edit_file`, `write_file`; web → add `search_web`. A misspelled tool name can hang the subagent, so `wf adapters --check` checks names against this list |
| `skills` | The canonical `skills:` as repo-relative paths (`workflow/skills/<name>`). They load under both native dispatch and `--agent` **(seen)** |
| `subagent`, `mainAgent` | Omit both: they default to `true`, which lets native dispatch and `--agent` both select the role |
| `inheritCustomizations` | Omit it. Set to `false`, it drops `AGENTS.md`, and `rules: [AGENTS.md]` doesn't bring it back **(seen)** |
| `commandExecutionPolicy` | Omit it (default `sandbox`; values `off`, `auto`, `eager`, `sandbox`) |

The body follows the frontmatter, and the body is the system prompt: `# <role>`, then the canonical role body, verbatim. There's no effort key: a native subagent runs at its model tier's default. When a role's effort matters, spawn it with a model id that encodes the effort (§8).

### Command → `.agents/skills/<name>/SKILL.md`

Copy `name` and `description`. The body is the canonical command body, then a line saying the human's text after `/<name>` is the command's context.

## 4. Native dispatch

- The conductor calls `invoke_subagent` with the role's agent name and the bootstrap line as the prompt. When the subagent finishes, its result message comes back to the parent. This works from headless runs too **(seen)**.
- `invoke_subagent` takes a workspace mode: `inherit` (same checkout; use this for workers), `branch` (an isolated git worktree) or `share`. A worker on `branch` writes outside the conductor's checkout, so use it only for a parallel writer with its own run.
- Continue a subagent with `send_message`. A finished subagent pauses and keeps its context, so a send-back can go to the same agent.
- When the conversation compacts, a subagent's entry is cut to its type, role and result. Its result must therefore be the header, since that's all that survives.
- **Loads by itself:** native dispatch loads the role body and its `skills:` **(seen)**.

## 5. Spawn

```
agy --agent <role> --model <model id> [--mode accept-edits] --output-format json \
  --print-timeout 0 -p "You are a workflow worker. Read <brief path> and follow it." > <log> 2>err-<seq>.txt
```

- **`-p` goes last, with the prompt right after it.** `-p` takes the next argument as the prompt: `agy -p --agent x "…"` fails with "-p took … as its prompt" **(seen)**.
- **Write roles** use `--mode accept-edits`. **Read-only roles** get no mode flag and no write tools. **Never** use `--mode plan`: headless, it denies even `read_file` **(seen)**. Never use `--sandbox`: headless, it denies commands that are allowlisted **(seen)**. Never use `--dangerously-skip-permissions`.
- Pass `--print-timeout 0` explicitly. The CLI help says the default is `0s`, the headless docs say 5 minutes.
- **Reading the JSON result.** `status` is one of `SUCCESS`, `ERROR`, `CANCELED`, `INTERRUPTED`, `INVALID`, `WAITING` or `RUNNING`; there are also `response`, `error`, `finished_reason` (only when a run ended early or failed) and `denied_actions` **(seen)**.
- **A denial ends the run silently.** When a worker hits a tool it isn't allowed to use, the run stops with an empty `response`, `status: SUCCESS` and exit code 0. Only `denied_actions` and a stderr notice show it **(seen)**. `wf await` treats a result as `partial` unless `status` is `SUCCESS` and there is no `denied_actions` and no `finished_reason`.
- An unknown `--model` exits 1 with `status: ERROR` and lists the available models **(seen)**.
- **Loads by itself:** with `--agent`, the role body and its `skills:` **(seen)**.
- **Manual transport:** the desktop app, or `agy --agent <role> -i "<bootstrap line>"`. The human says "done" when the result file exists.

## 6. Waiting and asking

- **Background:** run the launch line as a background task and end the turn. When the task exits, a high-priority system message wakes the conductor, naming the task and its exit code **(seen)**. Then `wf await` returns the header at once. Never poll or sleep.
- **Native results arrive the same way:** `invoke_subagent` returns at once, and the subagent's result wakes the parent as a system message **(seen)**.
- **Ask:** an interactive conductor uses `ask_question` (question, options, recommended option first). It blocks until the human answers and returns the chosen option **(seen)**. A headless conductor can't ask: it writes `checkpoint.md` and exits (meta-prompt §4.7).

## 7. Permissions and read-only

- **Allow rules have the form `tool(pattern)`** under `permissions.allow`. A plain rule matches only the exact command line. **Only a `regex:` rule matches varying arguments**: `command(regex:git log .*)` allowed `git log -4 --format=%h`. Under the same test, a bare `command(git log)` and the wildcard `command(git log *)` both denied `git log -2 --oneline`, and the wildcard denied even `git log -3` **(seen)**. Allowlist every command whose arguments change (focused tests, `wf`, the spawn launch line) as `command(regex:<command> .*)`, with regex metacharacters in `<command>` escaped.
- **Headless runs:** reading and writing files in the workspace is allowed. Shell commands default to Ask, so headless they're denied unless allowlisted **(seen)**.
- **The rules are per user.** They live in `~/.gemini/antigravity-cli/settings.json`; no project-level file is documented. The scaffold can't commit them, so `wf` prints the rules this project needs (test, focused test, architecture check, `wf`, read-only git, allowed spawn commands), and every team member adds them once. A spawned worker without them stops silently (§5).
- Keep allowlisted invocations single-line and stable. `wf` and the test commands must be invoked exactly as allowlisted.
- Read-only is enforced by the git check (rule 11), not by Antigravity: a read-only role still has `run_command`.

## 8. Tier map

| Tier | Native `model` (frontmatter) | Spawn `--model` (from `agy models`, effort in the id) |
| --- | --- | --- |
| strong | `pro` | e.g. `gemini-4-argon-high` |
| efficient | `flash` | e.g. `gemini-3.8-flash-medium` |

`agy models` lists ids with the effort built in (`-low`, `-medium`, `-high`), so `--effort` is redundant with an id. The list also includes other vendors' models (e.g. `claude-opus-5-5-high`), so a reviewer dispatched to Antigravity can still run on a different model family from the author's.

## 9. Token notes

- `AGENTS.md` and every skill's description sit in each conversation. Keep skill descriptions short.
- With `--output-format json`, `wf await` gets the run's outcome from `status`, `denied_actions` and `finished_reason`. Nobody reads the log unless it's a failure.
- Start each cycle in a new conversation. Don't use `-c` / `--continue` across cycles; the run state is on disk.

## 10. Gotchas

- **`agy agents` printed nothing** even with valid agents in `.agents/agents/`, while `--agent` and `invoke_subagent` both found them **(seen)**. Don't use its output as a check; use probe 3.
- **Untrusted folders** don't load workspace customizations. The CLI keeps trusted paths in `trustedWorkspaces` in its settings and adds them when you accept the prompt. Open the project interactively once before any headless run.
- **Quote descriptions.** An unquoted colon in a `description:` broke loading until it was fixed; quoting costs nothing.
- **`agy plugin import claude`** converts Claude Code plugins. Don't use it to mirror the Claude Code adapters; render from the canonical tree instead.

## 11. Probes

Run in the trusted project, on the cheapest model. Each must show the expected result.

1. `agy --output-format json -p "Quote rule 1 from your instructions verbatim."` → rule 1 of `AGENTS.md`.
2. `agy --output-format json -p "List the names of every workspace skill available to you."` → the canonical skills and the command skills.
3. `agy --agent <role> --output-format json -p "Reply with the first heading of your instructions and the names of your skills."` → the role's heading and its skills.
4. Read-only role, no mode flag, asked to create a file → it can't (no write tools), and `wf scope` agrees.
5. Developer with `--mode accept-edits` on a trivial brief → it runs the allowlisted test command and writes its result. The JSON has `status: SUCCESS` and no `denied_actions`.
6. The same with a command that isn't allowlisted → `denied_actions` is set, and `wf await` reports `partial`.
7. `agy --model no-such-model -p "hi"` → exit 1, `status: ERROR`.
8. Headless `invoke_subagent` of a role → only its result comes back.
9. **Interactive (human):** `ask_question` returns the chosen option; a 45-second background command wakes the conductor when it exits **(both seen)**.
10. With `command(regex:<focused test command> .*)` allowlisted, the developer runs the focused test command headless with two different test paths, and neither run has `denied_actions`.

## 12. Harness note

Write `workflow/harnesses/antigravity.md` (≤ 40 lines) with:

- the verified version and date;
- the tier map (§8);
- `launch:` — the line in §5 with `<role>`, `<model id>`, `<mode>`, `<brief path>` and `<log>` as placeholders;
- what loads by itself: native and spawn both load the role body and skills;
- the partial rule for `wf await` (§5);
- the allow rules every user must add, in `regex:` form for any command whose arguments change (§7);
- native dispatch, background wait (a wake-up message on exit) and ask, one line each;
- limits: plan mode and the sandbox can't be used headless, and native subagents have no effort setting.
