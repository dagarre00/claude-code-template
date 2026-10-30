# Harness side prompt — Claude Code

> Pairs with `workflow-meta-prompt.md` (§3.4). It says where the canonical workflow lands in Claude Code and in what format. It adds no role, rule, step or skill: everything it maps is defined once under `workflow/` and `AGENTS.md`.

## 1. Verified on

Claude Code **2.1.314**, 2026-10-30. The spawn behavior in §5 was probed headless that day; the rest comes from this template's own Claude Code setup. Check the installed version with `claude --version`. If it differs, run the probes in §11 before relying on anything below, and fix this file where they fail.

## 2. Instructions

- Claude Code loads `CLAUDE.md` at the project root; it doesn't read `AGENTS.md` on its own.
- **Adapter (pointer):** `CLAUDE.md` holds one line, `@AGENTS.md`, which imports it. Nothing else goes in `CLAUDE.md`.
- Don't put rules in `.claude/rules/`. They would be a second copy of the rules in `AGENTS.md`.

## 3. Adapter map

| Canonical | Claude Code target | Form |
| --- | --- | --- |
| `AGENTS.md` | `CLAUDE.md` | pointer (`@AGENTS.md`) |
| `workflow/roles/<role>.md` | `.claude/agents/<role>.md` | generated |
| `workflow/skills/<name>/SKILL.md` | `.claude/skills/<name>/SKILL.md` | generated (project skills load only from `.claude/skills/` or a plugin) |
| `workflow/commands/<name>.md` | `.claude/commands/<ns>/<name>.md`, invoked as `/<ns>:<name>` | generated |
| allowlists | `.claude/settings.json` → `permissions` | hand-edited (settings, not procedure) |
| guards (optional) | `.claude/settings.json` → `hooks`, or a project plugin | hand-written |

Every generated file carries `<!-- generated from <canonical path> by wf adapters; edit that file -->` right after its frontmatter.

### Role → `.claude/agents/<role>.md`

| Claude key | Rendered from |
| --- | --- |
| `name` | `name` |
| `description` | `description`. Claude uses it to decide on automatic delegation, so keep the "dispatched by `<command>` only" clause |
| `model` | The override for this role on Claude Code in `runners.md`, otherwise the role's tier in the tier map (§8) |
| `effort` | The override in `runners.md`; omit when there is none |
| `tools` | Built from `access` and `capabilities`: shell → `Read, Grep, Glob, Bash` (add `PowerShell` on Windows); write → add `Edit, Write`; web → add `WebSearch, WebFetch` |
| `permissionMode` | write → `acceptEdits`; read-only → `dontAsk` (commands that aren't allowlisted are denied without a prompt) |
| `maxTurns` | A generous per-role cap (e.g. 120 for the developer, 60 for reviewers), so a looping worker ends as `partial` instead of running forever |
| `skills` | The canonical `skills:` list. These preload into a native subagent |

The body is the canonical role body, verbatim.

### Skill → `.claude/skills/<name>/SKILL.md`

`name` and `description` copied; `user-invocable: false` when `invocable` is false. Then the canonical body, verbatim. Keep the trigger at the front of `description`: it's all Claude sees before loading the skill.

### Command → `.claude/commands/<ns>/<name>.md`

`description` and `argument-hint` copied, then the canonical body, then a final line `Context: $ARGUMENTS`. Pick one short namespace for every command (e.g. `project`).

## 4. Native dispatch

- Dispatch with the `Agent` tool, `subagent_type: <role>`, and the bootstrap line as the whole prompt. Never use `fork` (it inherits the conductor's conversation) or `general-purpose` (it has no role definition).
- Agents and skills load at session start. After `wf adapters --write`, restart the session; `/agents` shows what's loaded.
- The subagent's final message lands in the conductor's context, which is why the protocol makes it return only the result header.
- Continue a partial run with `SendMessage` to the same agent, passing the log path, not the log.
- Read-only roles may run in parallel as several `Agent` calls in one message. Write roles run one at a time.
- **Loads by itself:** the native transport loads the role body and its preloaded `skills:`. Record this in the harness note so `wf brief` leaves both out of Read-first.

## 5. Spawn

```
claude -p --agent <role> --model <model> --effort <effort> \
  --permission-mode <acceptEdits | dontAsk> --output-format json \
  "You are a workflow worker. Read <brief path> and follow it." > <log> 2>&1
```

- `--agent` applies the role's body, tools and model, but **not** its preloaded `skills:` (seen on 2.1.284 and again on 2.1.314, 2026-10-30). Record that spawned workers load the role body but not its skills, so `wf brief` lists the skills in Read-first.
- With `--output-format json` the run ends in one JSON object with `subtype`, `is_error`, `permission_denials`, `stop_reason` and `result` (seen on 2.1.314). `wf await` treats it as `partial` unless `subtype` is `success`, `is_error` is false and `permission_denials` is empty, whatever the result file says. A worker denied a command can still exit 0.
- A spawned worker uses the same checkout, so the one-writer rule holds. Parallel writers each get their own worktree (`claude --worktree <name>`) and their own run.
- **Manual transport** (the human wants to watch): `claude --agent <role> "You are a workflow worker. Read <brief path> and follow it."` in a second terminal.

## 6. Waiting and asking

- **Background:** run the launch line with the shell tool's `run_in_background`. The harness notifies the conductor when it exits; then `wf await` returns the header at once. Never block in the foreground: shell calls time out after 10 minutes.
- **Ask:** an interactive conductor uses `AskUserQuestion` (question, 2–4 options, recommended option first). A headless conductor (`claude -p`) can't ask; it writes `checkpoint.md` and exits (meta-prompt §4.7).

## 7. Permissions and read-only

- In `.claude/settings.json` → `permissions.allow`, list the test, focused-test and architecture commands, `wf`, and read-only git (`git status`, `git diff *`, `git log *`, `git rev-parse *`), each in exact and prefix forms: `Bash(<cmd>)`, `Bash(<cmd> *)`, plus `PowerShell(<cmd>)` and `PowerShell(<cmd> *)` on Windows. Add the launch commands of the runners the human allowed to spawn (e.g. `Bash(agy -p *)`).
- `dontAsk` keeps read-only roles from stalling on prompts, but `Bash` can still write files. Read-only is enforced by the git check (rule 11), not by Claude Code.
- `.claude/settings.local.json` is per-user: gitignore it.

## 8. Tier map

| Tier | `model` |
| --- | --- |
| strong | `opus` |
| efficient | `sonnet` |

Effort levels: `low`, `medium`, `high`, `xhigh`, `max`. Full model ids work too when `runners.md` pins one. Set the conductor's effort with `--effort` at launch, or with `/effort`.

## 9. Token notes

- `CLAUDE.md` and everything it imports are in every turn, conductor's and workers' alike: keep `AGENTS.md` within its budget.
- Subagent final messages and shell output enter the conductor's context. The result header and `wf`'s ≤ 5-line output keep both small. Never `cat` a background task's output file; `wf await` prints the header.
- Between cycles, `/clear` rather than `/compact`: the run state is on disk, and a summary still costs tokens.
- Generated skills are listed only by `description` until used, so a long skill library costs little; a long `description` costs every turn.

## 10. Gotchas

- **Windows:** both a Bash (Git Bash) and a PowerShell tool exist; allowlist both forms. Heredocs in the Bash tool mangle backslashes, so write scripts with the file tools. Check line endings in generated files.
- **Lenient YAML:** malformed frontmatter can load without an error. `wf adapters --check` parses every generated frontmatter with a real YAML parser.
- **Quote descriptions** that contain a colon.
- **Stale agents:** a session started before `wf adapters --write` still dispatches the old definitions.

## 11. Probes

Run each at scaffold time; each must show the expected result before Claude Code is used in a run.

1. `claude -p "Quote rule 1 from your instructions verbatim."` → rule 1 of `AGENTS.md` (the import works).
2. In a fresh session, `/agents` lists every role, and `/<ns>:work` appears with its argument hint.
3. `claude -p --agent <role> "Print the first heading of your system prompt."` → the role's heading.
4. Native: dispatch a read-only role with a brief that asks it to create a file → it refuses, or `wf scope` flags the file.
5. Spawn the developer with `--permission-mode acceptEdits` on a trivial brief → it runs the test command without a prompt, and the JSON result is `success`.
6. `wf adapters --check` passes; hand-edit one generated file → it fails.

## 12. Harness note

Write `workflow/harnesses/claude-code.md` (≤ 40 lines) with:

- the verified version and date;
- the tier map (§8);
- `launch:` — the line in §5 with `<role>`, `<model>`, `<effort>`, `<mode>`, `<brief path>` and `<log>` as placeholders;
- what each transport loads by itself: native → role body and skills; spawn → role body only;
- the partial rule for `wf await` (§5);
- native dispatch, background wait and ask, one line each (§4, §6);
- limits: read-only isn't enforced (§7); agents load at session start.
