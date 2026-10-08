---
name: subagent-dispatch
description: Conductor-only. How to dispatch one role and decide whether to accept its result — the run's dispatch mode (native subagent, handoff file, or fast), brief it, wait for it, check what it touched, prove and commit a developer case (Green, architecture, Red), send it back, resume a partial run. Use for every dispatch a /project:* command makes.
when_to_use: Trigger on dispatching or re-dispatching any role, choosing native, handoff or fast mode, proving a developer case's Red, accepting, resuming or sending back a role's result, and changing a role's model or effort.
user-invocable: false
---

# Subagent Dispatch

One procedure for every dispatch. The command decides which role gets what brief; this decides how it runs and whether its result is accepted.

## Before the cycle's first dispatch

- **The role exists.** The Agent tool lists every role in `.claude/agents/`. One missing means the session started before its file did — subagents load at session start, so ask the human to restart.
- **The roles can run the project's commands.** Read-only roles, the planner and the wiki-maintainer run in `dontAsk` mode: a command not allowlisted in `.claude/settings.json` is denied, not prompted. The test command and the architecture check from `docs/wiki/commands.md` belong there in both forms, `Bash(<command>)` and `PowerShell(<command>)` (`/project:init` step 5a). Missing → add them and commit `.claude/settings.json` on its own before the first dispatch, per [`log-and-commit.md`](../feature-branching/log-and-commit.md) — kind `chore`, subject `chore(workflow): allowlist <command> for the roles` — on the current branch (rule 19 lets `.claude/` ride it or land on `develop`).

## Dispatch mode

A dispatch runs **native** — the Agent tool, as below — or as a **handoff**: a file the human runs in another harness (a fresh Claude Code session, Antigravity), written and taken back per `dispatch-handoff`. The brief, the baseline, the checks and the case proof are the same either way.

The command's argument sets the mode for the whole run. Its leading word is the mode, stripped before the command reads the rest:

- **`fast`** → native, every dispatch, and nothing waits on the human. Load `human-checkpoint` now: its § Fast mode answers every checkpoint in the run.
- **`handoff`** → a handoff file, every dispatch.
- **Neither** → ask before each dispatch — one question for a set of read-only roles about to run in parallel — with `AskUserQuestion`: `Native (Recommended)`, `Handoff file`, `Native for the rest of this run`, `Handoff for the rest of this run`. The last two stand until the command ends.

## Brief

- **Native: dispatch with the Agent tool and `subagent_type: <role>`.** The role file sets the model, effort, tools, permission mode and preloaded skills. Never a fork and never `general-purpose`: both carry your context, which is what a scoped brief exists to keep out (rule 10) and what makes a second opinion worthless.
- **Handoff: the same brief goes in the file** — `dispatch-handoff` wraps it with what the other harness does not load on its own.
- **The brief is the subagent's whole view of the task** — it sees none of this conversation. Give it, in this order:

  ```
  Task: <one line — "Implement B3 of entities/auth">
  Inputs: <what the command lists: entity slug, case IDs, branch, test command, plan path, commit range>
  Scope: <paths it may create or edit> | read-only
  Return: <the role's report format, and anything this dispatch needs on top>
  ```

  Nothing else: no summary of your reasoning, no opinion of the plan, no expected answer. Pass files by path (`.handoff/<slug>-plan.md`, the source to ingest), never pasted.
- **One writer at a time.** Read-only roles may run in parallel with each other. A write role runs alone, from a clean tree, and nothing else touches the checkout until you have decided on its result.
- **Record the baseline** before a dispatch: `git rev-parse HEAD` and `git status --porcelain`.

## Wait, then check what it touched

A subagent may run in the background; its result arrives as a notification. A handoff's arrives when the human says it is done (`dispatch-handoff` step 5). Do nothing to the checkout until it does.

1. **Partial result** — the role hit its `maxTurns`. Continue it once with `SendMessage` to the same agent; its context is intact. A handoff: the human tells its session to continue. Partial again → `human-checkpoint`.
2. **Compare with the baseline:**
   - **Read-only role** — `HEAD` and every tracked file unchanged. Anything else voids the round: report it, restore after accounting for every path (rule 21), re-dispatch. New untracked files a test run produced are residue: they need a `.gitignore` line (a todo), never a commit.
   - **Write role** — `HEAD` unchanged (it committed → reject), and changes only inside the brief's scope. A path outside it is a defect: read it before deciding, and never widen the scope after the fact.
3. **Read the report** against what the command defines as done — numbered findings with a `Checked:` line for a review, a proven case for a developer. The report's own claim of success is not evidence.

## Prove and commit a developer case

The case's **test paths** are the tests, fixtures and helpers the developer reported — prefer the test directory to single files, so a helper added beside the test stays with it. Everything else it changed is the implementation, wiki page included. Run long suites through the shell tool with an explicit `timeout`, or in the background and wait for them; never leave one running unbounded.

```bash
<test command>                     # Green: the full suite passes with the case in place
<architecture command>             # when docs/wiki/commands.md § Architecture has one: passes
git add -- <every path the case changed>          # plus the Follow-ups lines you appended to the queues
git commit -m "<the case's commit message>"       # docs/wiki/git-conventions.md; not pushed yet
git restore --source=HEAD~1 --staged --worktree -- . ':(exclude)<test path>' …   # set the implementation aside
<test command>                     # Red: must FAIL — on the case's assertion or its not-yet-written symbol
git restore --source=HEAD --staged --worktree -- .   # put it back, deletions and moves included
git status --porcelain             # no tracked file may differ from HEAD
git push
```

- **Read the Red output.** A broken fixture, a syntax error or an import of something that should already exist is not Red.
- **Rejected** — Green or the architecture check failed before the commit, or Red was refuted (the tests still pass with the implementation set aside) → `git restore --source=HEAD --staged --worktree -- .`, then `git reset HEAD~1`: the case is uncommitted again, nothing is lost and nothing was pushed. Send it back (below) with the deciding output.
- **Interrupted mid-check** — the tree differs from `HEAD` only in paths the check set aside: account for every line (rule 21), then `git restore --source=HEAD --staged --worktree -- .`.
- **Tests inside the source file** (Rust `#[cfg(test)]`) cannot be separated from their implementation this way: brief the test into its own file, or accept the case on a `human-checkpoint` that names the layout.
- **A case the developer could not verify** — its check needs something only you can run (a GUI, a machine-specific runner, a service without credentials) — is yours to run before the commit claims it. A substitute harness can fail as a pass, so run the real thing and read its output. If you cannot run it either, the case stays `[~]` and the report says so.

## Integrate any other write role

Stage exactly the paths it reported, plus the `Follow-ups:` lines you append to `todos.md`/`wiki-todos.md`; files it reported deleted go in the same commit. Commit with the command's message and push.

## Send back, reject, two strikes

- **Send back with notes, once** — `SendMessage` to the same agent with the deciding output tail; a handoff's go to the human (`dispatch-handoff` step 6). If that agent is gone (a new session), re-dispatch with the notes and "these files are the previous attempt" in the brief.
- **Never re-send an unchanged brief** — the same inputs fail the same way. Fix the cause first: a narrower scope, a missing input, a command it could not run.
- **Discarding an attempt** — restore the tracked paths it changed (`git restore --source=HEAD --staged --worktree -- <paths>`) and delete the files it created, both read from its report and from `git status`; nothing else in the tree is yours to touch (rule 21).
- **Two failures on one mechanism**, or two rejections for one cause → rule 5.

## Resuming after an interruption

The tree holds whatever the last role wrote. Account for every path first (rule 21). A developer's uncommitted files are the case in flight: re-dispatch the case with "these files are a previous attempt" in the brief, or discard them as above. Committed cases are safe; an unpushed one is pushed before anything else.

## Changing a role's model or effort

Edit `model`/`effort` in `.claude/agents/<role>.md` and restart the session. Base it on evidence from real cycles — refuted Reds and sent-back cases for the developer, findings acted on per review round in `git log --grep="adversary round"` — and say so in the commit's log entry. A change without evidence is a guess; if you make one anyway, say that too.

## Anti-patterns

- **Accepting on the report.** A green claim with no quoted output, or a Red "confirmed" by a suite that never reached the code.
- **Leaking context into a brief** — your plan review, your theory of the bug, the conversation.
- **Two writers in one checkout**, or a dispatch onto a dirty tree.
- **Pushing a case before Red is proven.**
- **Leaving a partial result unresumed** and treating it as the answer.
