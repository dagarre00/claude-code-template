---
name: subagent-dispatch
description: Conductor-only. How to dispatch one role and decide whether to accept its result — dispatch mode (native subagent, handoff file, or fast), briefing, baseline checks, proving and committing a developer case (Green, architecture, Red), sending back, resuming, or changing a role's model/effort. Use for every dispatch a /project:* command makes.
user-invocable: false
---

# Subagent Dispatch

One procedure for every dispatch. The command decides which role gets what brief; this skill decides how it runs and whether its result is accepted.

## Before the cycle's first dispatch

- **Role exists:** The Agent tool lists every role in `.claude/agents/`. If one is missing, ask the human to restart the session (subagents load at session start).
- **Commands allowlisted:** Read-only roles, `planner`, `researcher`, and `wiki-maintainer` run in `dontAsk` mode (unlisted commands are denied without prompting). Ensure the test command and architecture check from `docs/wiki/commands.md` are in `.claude/settings.json` in both exact and prefix forms (`Bash(<command>)`, `Bash(<command> *)`, `PowerShell(<command>)`, `PowerShell(<command> *)`) so roles can run both the full suite and single test files. If missing, add them and commit `.claude/settings.json` alone per [`log-and-commit.md`](../feature-branching/log-and-commit.md) (`chore(workflow): allowlist <command> for the roles`).

## Dispatch mode

A dispatch runs **native** (via the Agent tool) or as a **handoff** (a file the human runs in another harness per `dispatch-handoff`). The command's leading argument word sets the mode for the run (stripped before reading the rest):

- **`fast`** → native for every dispatch, no waiting on the human. Load `human-checkpoint` now; its `§ Fast mode` answers every checkpoint in the run.
- **`handoff`** → handoff file for every dispatch.
- **Neither** → ask before each dispatch (once for a parallel read-only batch) via `AskUserQuestion`: `Native (Recommended)`, `Handoff file`, `Native for the rest of this run`, `Handoff for the rest of this run`.

## Brief

- **Native:** dispatch with `Agent` and `subagent_type: <role>`. Never use a fork or `general-purpose` (rule 10).
- **Handoff:** write the brief per `dispatch-handoff`.
- **Format** (the subagent sees none of this conversation):

  ```
  Task: <one line — "Implement B3 of entities/auth">
  Inputs: <entity slug, case IDs, branch, test command, plan path or brief refinements, commit range>
  Scope: <paths it may create or edit> | read-only
  Return: <the role's report format, plus any dispatch-specific additions>
  ```

  Include no conductor reasoning, opinions, or expected answers. Pass files by path, never pasted.
- **One writer at a time:** Read-only roles may run in parallel; write roles run alone from a clean tree.
- **Baseline:** Record `git rev-parse HEAD` and `git status --porcelain` before every dispatch.

## Wait, then check what it touched

Do nothing to the checkout until the subagent notification arrives (or the human marks a handoff done per `dispatch-handoff` step 5).

1. **Partial result (`maxTurns` hit):** Continue once via `SendMessage` to the same agent (or ask the human to continue the handoff session). Partial again → `human-checkpoint`.
2. **Compare with baseline:**
   - **Read-only role:** `HEAD` and all tracked files must be unchanged (else report, account for paths per rule 21, restore, and re-dispatch). Untracked residue from a test run needs a `.gitignore` todo, never a commit.
   - **Write role:** `HEAD` must be unchanged (if it committed, reject) and edits must stay within `Scope:` (read any out-of-scope file before deciding; never widen scope retroactively).
3. **Verify report:** Check required fields (`Checked:` line for reviewers, test/implementation paths for `developer`). Self-reported success is not evidence.

## Prove and commit a developer case

The case's **test paths** are the tests, fixtures, and helpers the developer reported (prefer the test directory so new helpers stay with the test); everything else changed is the implementation (wiki page included). Run suites with an explicit timeout.

```bash
<test command>                     # 1. Green: full suite passes with the case in place
<architecture command>             # 2. Architecture check passes (if defined in commands.md)
git add -- <every path the case changed>          # plus Follow-ups appended to queues
git commit -m "<the case's commit message>"       # docs/wiki/git-conventions.md; not pushed yet
git restore --source=HEAD~1 --staged --worktree -- . ':(exclude)<test path>' …   # set implementation aside
<test command>                     # 3. Red: must FAIL on the case's assertion or missing symbol
git restore --source=HEAD --staged --worktree -- .   # restore implementation (including moves/deletions)
git status --porcelain             # must be empty
git push
```

- **Read the Red output:** A broken fixture, syntax error, or import of a pre-existing module is not Red.
- **Rejected before commit (Green or architecture check failed):** No commit was created yet — **do not run `git reset HEAD~1`**. Leave the developer's edits in the working tree and send the developer back with the failing output (or discard only the attempt's paths below).
- **Rejected after commit (Red refuted — tests still pass with implementation set aside):** Run `git restore --source=HEAD --staged --worktree -- . && git reset HEAD~1` to restore the implementation and uncommit the case back into the working tree without losing edits, then send the developer back with the deciding output.
- **Interrupted mid-check:** Account for every modified path (rule 21), then run `git restore --source=HEAD --staged --worktree -- .`.
- **Inline tests** (e.g. Rust `#[cfg(test)]`): Brief the test into a separate file, or accept via a `human-checkpoint` naming the layout.
- **Unverified by developer** (needs GUI/hardware/credentials only the conductor has): Run the real check yourself before committing; if you cannot run it either, leave the case `[~]` and say so.

## Integrate any other write role

Stage the exact paths it reported (including reported deletions) plus any `Follow-ups:` lines appended to `todos.md`/`wiki-todos.md`, commit with the command's message, and push.

## Send back, reject, two strikes

- **Send back once:** Use `SendMessage` to the same agent with the deciding output tail (or handoff step 6). If the agent session is gone, re-dispatch with notes and `"these files are the previous attempt"` in `Inputs:`.
- **Never re-send an unchanged brief:** Fix the cause (scope, missing input, unrunnable command) first.
- **Discarding an attempt:** Restore only the tracked paths it changed (`git restore --source=HEAD --staged --worktree -- <paths>`) and delete only the untracked files it created (rule 21).
- **Two strikes:** Two failures on one mechanism or two rejections for one cause → rule 5.

## Resuming after an interruption

Account for every path in the working tree first (rule 21). Uncommitted developer files are the case in flight (re-dispatch with `"these files are a previous attempt"` or discard as above). Push any committed-but-unpushed case before continuing.

## Changing a role's model or effort

Edit `model`/`effort` in `.claude/agents/<role>.md` and restart the session. Cite cycle evidence (refuted Reds/send-backs for `developer`, findings acted on in `git log --grep="adversary round"` for reviewers) in the commit's log entry.

## Anti-patterns

- **Accepting on self-report** without running Green/architecture/Red.
- **Leaking conductor context** into a brief.
- **Two writers in one checkout**, or dispatching onto a dirty tree.
- **Running `git reset HEAD~1` when no commit was made** (destroys the previous committed case).
- **Pushing before Red is proven.**
