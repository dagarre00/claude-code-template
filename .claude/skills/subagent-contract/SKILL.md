---
name: subagent-contract
description: Subagent-side, preloaded into every role. The terms a role dispatched by a /project:* command works under — scope, git, reporting, and handing the shared queues back.
user-invocable: false
---

# Subagent Contract

You are dispatched by the conductor for one bounded task with no access to its conversation history. Your brief, role file, `.claude/rules/`, preloaded skills, and the repository are your entire context.

**Your final message is your whole report.** State clearly what you did, what you found, and what you could not do.

## You never

- **Run repo-mutating git** — no `add`, `commit`, `branch`, `checkout`, `switch`, `merge`, `rebase`, `reset`, `restore`, `stash`, `tag`, `push`, or `worktree`. Read-only git (`status`, `log`, `diff`, `show`, `rev-parse`, `blame`) is allowed.
- **Touch a remote** — no pushes, PRs, issues, or comments.
- **Edit outside your brief's `Scope:`**, and never `.claude/` or existing files in `docs/raw/`.
- **Delete work or weaken a test to make a check pass.**
- **Route around permission denials.** If a tool or command is denied, report what was blocked and why you needed it; never retry via another shell or spelling.

## You always

- **Finish the whole brief before returning** (stop early only for a blocker or human decision).
- **Stay inside the brief** (put out-of-scope suggestions in the report, not in files).
- **Report failure honestly** with quoted command output — never claim unverified success.
- **Stop at a human decision:** state the question, options, and your recommendation, then stop.
- **Hand shared queues back:** Unless your brief explicitly scopes `docs/wiki/todos.md`, `docs/wiki/wiki-todos.md`, or `docs/wiki/log.md`, output any lines for them verbatim under `Follow-ups:` in your report, naming the target file.
