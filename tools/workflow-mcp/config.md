# Configuring the workflow — `.agents/config.json`

`.agents/config.json` decides three things: which AI command-line tool (an **engine**: Claude Code, Codex or Antigravity) runs each worker role, which **model** and effort that tool uses, and which shell commands a worker may run. JSON has no comments, so the file cannot explain itself. The editor described here can.

## Open the editor

```bash
node tools/workflow-mcp/config-ui.mjs
```

The same thing as `npm --prefix tools/workflow-mcp run config`. It prints a URL and opens it in your browser. Leave the terminal running while you edit, and press Ctrl+C when you are done.

- **From any directory.** It finds the project by where the script lives — the project root is two directories above `tools/workflow-mcp/`.
- **Nothing to install.** It uses only Node's built-ins, so it works without `npm install` in `tools/workflow-mcp/`.
- **The same Node** that runs the workflow server is all it needs.

| Option | What it does |
| --- | --- |
| `--root <dir>` | Edit the config of another project — any directory that has an `.agents/` folder. |
| `--port <n>` | Listen on a fixed port. The default is any free one. |
| `--no-open` | Print the URL without opening a browser. |
| `--help` | Print the usage and exit. |

## What the page gives you

- **General** — the default engine and the worker time limit.
- **Roles** — one card per role in [`.agents/roles/`](../../.agents/roles/). A role either follows the default engine, or you choose its engines yourself: each **row** is one engine with its own model and effort, and the top row runs first (the others only if the tool above is not installed). Every part of a row is a dropdown. **+ Add an engine** adds a row, filled in with real values rather than left blank; **Remove** takes one out; the ☰ handle (or ↑ / ↓ on the keyboard) reorders. Only the engines a role actually uses are listed. Each card ends with a **Will run:** line showing what a dispatch of that role would use, so you never have to work it out from the JSON.
- **Engines — fallback defaults** — for each tool, the program to launch and the model and effort used where a role's row is left on `default` (see [How an engine, model and effort are chosen](#how-an-engine-model-and-effort-are-chosen)), plus a read-only list of the flags every worker on that tool is launched with and why ([Flags every worker is launched with](#flags-every-worker-is-launched-with)).
- **Safety and advanced** — the commands workers may run, the worktree setup commands, the protected paths and the architecture check. Each has a plain-language note under it.
- **Show the file this will write** — the exact JSON that Save will store.

**Save stays disabled until the change is valid.** Every edit is checked by the same function the dispatcher loads the file with, and the message you see is that function's own text. Saving what you loaded changes nothing, and an edit changes only the lines you touched: the file is written as 2-space JSON in its own line endings, so a file that was formatted some other way is reflowed once, on its first save. If the file changed on disk after you opened the page — a hand edit, another tool — Save refuses rather than overwrite it, and offers a reload.

**Changes apply to the next dispatch — no restart.** The workflow server reads the file on every call. The one follow-up is Antigravity: after you change the commands workers may run, call `grant_antigravity_setup` (the `check` tool tells you whether anything is missing), as described in [engine-setup.md](engine-setup.md).

**It is only reachable from your machine.** It listens on `127.0.0.1`, rejects any request whose `Host` is not this machine's loopback address, and requires a random token that appears only in the URL it printed — because this file decides which programs run, a web page you happen to have open must not be able to change it. A new run prints a new token, so a page left over from an earlier run stops working. Run it on the machine whose browser you will use.

## How an engine, model and effort are chosen

For one dispatch of one role:

1. **Engine.** The role's `engine` if it has one, otherwise `defaultEngine`. A list is an order of preference: the first engine installed on this machine is used, so `["codex", "claude"]` means Codex, or Claude if Codex is missing. `inherit` means whichever CLI you are running the workflow from — Claude Code runs Claude workers, Codex runs Codex workers.
2. **Model.** What you set on the role's row, `roles.<role>.models.<engine>` — always wins. Where the row is left on `default` (or the role follows the default engine), the engine's fallback for the role's **profile**, `engines.<engine>.models.<profile>`. A blank or `inherit` model passes no model flag, so the tool uses its own default. Either way the model is one that engine runs: a model is stored under an engine and never crosses to another.
3. **Effort.** The same, from `effort`.

**What you set on a role is what it uses; a profile only fills in what you did not set.** A profile is a kind of role — `reasoning`, `balanced` or `fast`, most to least demanding — declared by the `profile:` line of `.agents/roles/<role>.md`, not in `config.json`. The config holds, per engine, the model and effort each kind falls back to, so a role with no model of its own (or a fallback engine you gave no model) still gets a sensible one, and changing what `fast` means is one edit. **A row added in the editor is written with explicit values, so it never leans on a profile.** To change a role's kind, edit its role file and run `sync` (the generated `AGENTS.md` lists it).

Worked example, from the template's own config: the `planner` role is a `reasoning` role, `"engine": ["claude", "codex"]`, and pins `claude-opus-5` at `high` effort on Claude. On Claude it runs exactly that. If Claude is not installed it falls back to Codex, where it has no pin, so it uses `engines.codex.models.reasoning` — the Codex fallback for a `reasoning` role.

## Keeping model names up to date

Model names change often, and **nothing in `config.json` updates itself**: an id you wrote stays as written until you change it, so a model the vendor retires or renames breaks quietly — it is only found when a dispatch runs. The editor helps in three ways:

- **The dropdowns read the tools' own lists.** When the page opens (and on **Refresh model lists**) the server runs each tool's list command, from the executable the saved config names: `codex debug models` and `agy models`. The dropdown then offers what the tool says it has today — a model released after this template shipped appears with no change to any file. Both commands answer in a couple of seconds and only read; if one fails, the dropdown falls back to the built-in list and the **Model lists** line on the General card says why. Antigravity lists each model once per effort (`gemini-3.8-flash-high`, `-medium`, `-low`); because effort is its own setting, the editor folds those into one entry, `gemini-3.8-flash`.
- **A model that has gone is flagged.** When a tool's list is known and a model in your config is not in it, the page shows a warning naming every place it is used, and the dropdown marks it ⚠.
- **Claude has no list command, but has aliases.** `opus`, `sonnet` and `fable` always mean the newest model of that family, and the dropdown offers them beside the full ids. Use one when you want a role to follow the newest model automatically; use a full id when you want it pinned. The trade-off is that an alias changes what a role runs the day a new model ships.

The built-in lists (`knownModels` in `tools/workflow-mcp/engines/<engine>.mjs`) are only the offline fallback. The editor cannot check a Claude full id, because there is nothing to ask — confirm it against Anthropic's model list.

A single dispatch can override all of this without touching the file: `build_worker_prompt` accepts `cli_engine`, `model_override` and `thinking_budget`.

## Reference: every setting

### Top level

| Key | Value | What it does |
| --- | --- | --- |
| `$comment` | text | Free text, ignored by the workflow. The one key that may hold a note; the editor keeps it. |
| `version` | `1` | The only supported version. |
| `defaultEngine` | `inherit` or an engine name | The engine for any role that names none. |
| `workerTimeoutSeconds` | whole number, 1–86400 | Seconds before a worker is stopped, with every process it started, on every engine and OS. Antigravity also gets it as its own `--print-timeout`, so it reports its timeout itself a minute before the runner would stop it. |
| `workerCommands` | up to 32 command lines | The exact commands a worker may run, one per line. Matched literally, not as patterns: `npm test` allows exactly `npm test`. A line with `;`, `&`, `\|`, `<`, `>`, a backtick or `$(` can never match, so it is refused. Keep the list short. See [engine-setup.md](engine-setup.md). |
| `worktreeSetup` | up to 16 command lines (optional) | Commands **you** run inside a fresh worktree before a worker starts — installing dependencies, building a virtualenv. Handed back by `prepare_worktree`, never given to a worker, so these may chain with `&&`. See [Projects with a Python virtualenv](engine-setup.md#projects-with-a-python-virtualenv). |
| `protectedPaths` | repository-relative paths | Paths no worker may change, even inside the paths it was given to write. No absolute paths, no `..`. The template protects `.agents`. |
| `architecture` | object | The project's layer check, described below. |
| `roles` | object keyed by role name | Per-role overrides, described below. A role missing here uses the defaults; a name with no file in `.agents/roles/` does nothing. |
| `engines` | object keyed by engine name | One block per engine, all three required, described below. |

### `architecture`

| Key | Value | What it does |
| --- | --- | --- |
| `command` | one plain command line, or `null` | The command that fails when an import breaks the layers in `docs/wiki/architecture.md`. It is added to `workerCommands` for you, at load time — you do not list it twice. |
| `rules` | repository-relative paths | The files that define those rules. They are added to `protectedPaths` for you. |

`/project:init` fills both. `check` reports whether the architecture check is enforced.

### `roles.<role>`

| Key | Value | What it does |
| --- | --- | --- |
| `engine` | `null`, an engine name, or an ordered list | `null` follows `defaultEngine`. A list is tried in order, first installed wins. |
| `models` | `{ "<engine>": "<model>" }` | Pin a model for this role on that engine. Leave the engine out to use its profile default. |
| `effort` | `{ "<engine>": "<effort>" }` | Pin an effort the same way. |

### `engines.<name>`

`claude`, `codex` and `antigravity` are each required.

| Key | Value | What it does |
| --- | --- | --- |
| `executable` | program name or path | What to launch. Use the real program; `.cmd` and `.bat` shims are refused. |
| `models` | `{ "reasoning": …, "balanced": …, "fast": … }` | The model each profile means on this engine. All three are required; `null` means the tool's own default. |
| `effort` | `{ "reasoning": …, "balanced": …, "fast": … }` | The effort each profile means. All three are required; `null` means the tool's own default. |
| `toolOutputTokenLimit` | positive whole number (optional) | **Codex only.** Caps how much of one file read or command output a worker keeps in its own history. |
| `modelAutoCompactTokenLimit` | positive whole number (optional) | **Codex only.** When a worker summarizes its own history. See [Codex — optional context-management overrides](engine-setup.md#codex--optional-context-management-overrides). |

The efforts each engine accepts:

| Engine | Efforts |
| --- | --- |
| `claude` | low, medium, high, xhigh, max |
| `codex` | minimal, low, medium, high, xhigh |
| `antigravity` | low, medium, high |

A model name has to be a plain id — letters, digits and `. _ : / -`, starting with a letter or digit. **The loader checks that shape, and that the engine runs models of that family — not that the model exists**: a retired or misspelled name is only caught when the tool runs. Model names change often, so confirm a name against the vendor's current list before you save it.

**A model belongs to its engine.** Every model in the file sits under an engine's name — `engines.<engine>.models` and `roles.<role>.models.<engine>` — and is only ever passed to that engine's tool, so an id the engine cannot run (a Codex `gpt-5.6-sol` under `antigravity`) is a worker that fails to start. The loader refuses it, naming the setting and whose model it is, and so does the launcher, whatever the id's source. The ids an engine runs start with one of these prefixes:

| Engine | Model ids that start with |
| --- | --- |
| `claude` | `claude-`, `opus`, `sonnet`, `haiku`, `fable` |
| `codex` | `gpt-`, `codex-`, `o1`, `o3`, `o4` (not `gpt-oss`) |
| `antigravity` | `gemini-`, `claude-`, `gpt-oss-` |

Prefixes rather than names, so a newer model of a family fits the day it ships. They come from `modelPrefixes` (and `modelExcludes`) in `tools/workflow-mcp/engines/<engine>.mjs`; a tool that starts serving a new family (`agy models` lists Claude and GPT-OSS beside Gemini) gets it added there, on purpose. `inherit` and a blank are not models and fit every engine. A dispatch's `model_override` is held to the same rule against the engine it resolves to: if the chain fell through to another engine, the override is refused with a message to pass `cli_engine`.

**The model dropdowns offer only the engine's own models, but are not a whitelist.** Each lists what the engine's tool reports (see [Keeping model names up to date](#keeping-model-names-up-to-date)), then every id your config already uses for that engine. The first entry, `default`, pins nothing, so the profile's default applies; the last, **Other…**, takes any id that engine runs. Another engine's id turns the row red with the reason and keeps Save off; one already in the file gets a red banner with **Clear it**, and the "Will run" line marks it ✖.

## Flags every worker is launched with

Each engine is started with a fixed set of command-line flags on every run. They are **not** in `config.json` and the editor does not let you change them, on purpose: some of them are what keeps the workflow's promises, and a config file — which a web page or an agent could write — must not be able to switch a read-only role's read-only off.

The editor lists them anyway, so you can see exactly what is passed and why: on the **Engines** card of each tool, open **Flags every … worker is launched with**. The list is generated by running the adapters, not written by hand, so it is what is really launched. Each flag is one of four kinds:

- **From your settings** — the value comes from this file: `--model` and `--effort` (per role and profile), the allowed commands (`workerCommands`), the worker time limit (`workerTimeoutSeconds`), Codex's two token limits. Change these in the config.
- **Guarantee** — enforces a rule. Fixed. See the table below.
- **Plumbing** — what the harness needs to run a worker and read its report back (non-interactive mode, the worktree, the report file, the prompt on stdin).
- **Housekeeping** — session and cache tidiness (no saved session, no colour codes, a stable prompt prefix for caching).

The guarantees:

| Engine | Flag | What it enforces |
| --- | --- | --- |
| `claude` | `--safe-mode` | The worker sees only the prompt it was sent, not the project's own instruction files. |
| `claude` | `--permission-mode` | Read-only roles run with no way to approve an edit, so edits are denied while the allowed commands still run. |
| `claude` | `--disallowedTools` | A worker is a leaf: it cannot start another worker. |
| `codex` | `--sandbox` | An OS-level sandbox: read-only roles cannot write; write roles write only inside their worktree. |
| `codex` | `-c project_doc_max_bytes` | Codex reads no `AGENTS.md`. |
| `codex` | `-c mcp_servers` | No MCP servers, so a worker cannot call the workflow server or any other. |
| `codex` | `-c agents.enabled` | A worker is a leaf: it cannot start sub-agents. |
| `antigravity` | `--agent` | Runs the worker as a custom agent with no write tools (read-only roles) and no sub-agent tools. |
| `antigravity` | `--mode` | `plan` for read-only roles, `accept-edits` for write roles. |

There is no setting for adding your own flags. To change what an engine is launched with, edit its adapter, `tools/workflow-mcp/engines/<engine>.mjs`: each flag it passes has a note in that file's `flagNotes`, and the test suite fails on a flag with no note and on a note for a flag that is gone. Anything that weakens a guarantee is a decision to record, not a side effect of getting something to run.

## What the loader rejects

Editing by hand still works. The loader is strict on purpose, because a setting that is silently ignored looks exactly like one that works. It rejects:

- a file that is not valid JSON, or a `version` other than `1`;
- an **unknown key** anywhere — at the top level, in `architecture`, in a role, or in an engine block (`worktreeSetups` for `worktreeSetup`, `model` for `models`);
- an **effort** the engine does not accept, a malformed **model** id, or a model the engine does not run (see [a model belongs to its engine](#reference-every-setting)) — at load, rather than when that role is first dispatched;
- an engine that is not `inherit` or one of the three, or an empty engine list;
- a `workerCommands` line that chains or redirects, and any `workerCommands` or `worktreeSetup` line that contains a line break;
- an absolute path or `..` in `protectedPaths` or `architecture.rules`;
- an engine block missing a profile, pointing at a `.cmd`/`.bat` shim, or carrying a Codex-only key on another engine.

The `check` tool reports a rejection with the rule that fired. The editor shows the same text, opens on a file that parses but is rejected, and offers a **Remove it** button for an unknown key — so a config that a newer template rejects after `/project:sync-template` can be repaired in the page. A file that is not valid JSON has to be fixed by hand first.

## Common tasks

| To… | Do this |
| --- | --- |
| Run one role on a different model | Roles → that role → **Model** on the engine it uses: pick one from the list, or **Other…** to type an id that is not listed. |
| Give a role a fallback | Roles → that role → **+ Add an engine**. The new row joins the end of the list; pick its engine, model and effort. |
| Change which engine runs first | Roles → that role → drag the ☰ handle to reorder the rows (top runs first), or focus a handle and press ↑ / ↓. Press **Remove** to stop using an engine. |
| Make a role follow whichever tool you are in | Roles → that role → tick **Use the default engine**. |
| Change what a whole tier means | Engines → that engine → the kind of role's **Default model** or **Default effort**. Only rows left on `default` are affected. |
| Let workers run one more command | Safety and advanced → **Commands workers may run**, one exact line. If Antigravity is in use, then call `grant_antigravity_setup`. |
| Prepare each fresh worktree (a virtualenv, `node_modules`) | Safety and advanced → **Setup commands for a fresh worktree**. |
| Point a role at a tool installed somewhere unusual | Engines → that engine → **Program to launch**, with a full path. |

## When something goes wrong

| You see | What it means |
| --- | --- |
| `Missing or wrong token` | Use the exact URL the command printed, including `?t=…`. A new run prints a new token. |
| “changed on disk since the page loaded it” | Something edited the file after you opened the page. Reload, then redo your edit; nothing was written. |
| The browser did not open | Open the printed URL yourself. `--no-open` skips the attempt on purpose. |
| The port is in use | Run with `--port <another number>`, or leave it off for any free port. |
| “No `.agents/` directory” | Run it from inside a project that has adopted the workflow, or pass `--root <project>`. |
| “is in the file but has no role file” | The config names a role that has no file in `.agents/roles/`, so it does nothing. **Remove it** deletes the entry. |
| Not valid JSON | The page cannot repair a syntax error. Fix the file by hand, then reload the page. |

A project that adopted the template before the editor existed has no pointer to it inside its own `config.json`, because `/project:sync-template` never rewrites that file. Add `"$comment": "Run node tools/workflow-mcp/config-ui.mjs to edit this."` if you want one.

## Related

- [engine-setup.md](engine-setup.md) — what each CLI needs before it can run a worker, including the `workerCommands` allowlist and the Antigravity grant.
- [getting-started.md](getting-started.md) — the first-time walkthrough, including where to look when something is wrong.
- [conductor-e2e.md](conductor-e2e.md) — a real dispatch on your machine; re-run it after changing which engine a role uses.
