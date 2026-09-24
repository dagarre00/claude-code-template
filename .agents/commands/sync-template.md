---
name: sync-template
description: Pull the generic workflow — .agents/ text and tools/workflow-mcp/ — from a template checkout into this adopting project, leaving project-owned files alone. Run in an adopting project, never in the template. Use when the template has fixes this project lacks, or a cycle here rediscovers a bug already fixed upstream.
argument-hint: [template source — e.g. "../claude-code-template" | "tools only" | empty to reuse the last one from the log]
type: command
---

# /project:sync-template

**Argument:** `$ARGUMENTS`

The argument names **where the template is and how much to take**. A path sets the source for this run. `tools only` narrows step 5 to `tools/workflow-mcp/`, the safe subset — that tree is never customized per project. Both may appear together. Empty → the source from the last `sync-template` entry in `docs/wiki/log.md`, taking everything generic; with no such entry, ask via `human-checkpoint` rather than guess a path. Nothing bypasses the overwrite checkpoint (step 4) or the validation (step 7).

A one-directional pull: generic files are copied from the template, derived files regenerated, and nothing is ever written back. Use it when the template has fixes this project lacks, when a finding here turns out to be fixed upstream, or before a large piece of work.

## Preconditions

- **This is not the template:** `.agents/project.md` has been filled in, and the source is not this checkout. Syncing a template into itself corrupts both sides of the comparison.
- On `develop`, or the active branch mid-cycle (rule 19 — tooling is living operations).
- A clean tree, **and clean because you left it so**: `git status --porcelain`, every line accounted for (rule 21).
- The source is a real checkout containing `.agents/` and `tools/workflow-mcp/`.

Any failure → `human-checkpoint`.

## What is generic and what is yours

This table is the whole decision; getting it wrong either drops the project's configuration or leaves the lag in place.

| Path | Action | Why |
| --- | --- | --- |
| `tools/workflow-mcp/**` | **Copy** — `package-lock.json` included; skip `node_modules/` and the template-only `test/`, and drop the `test` script from the copied `package.json` | Pure tooling. A local customization is a bug to report upstream, not an edit to protect. The lockfile pins the versions the template was tested with. |
| `.agents/skills/`, `.agents/roles/`, `.agents/commands/` | **Copy**, subject to step 4 | The workflow itself — usually identical, occasionally diverged on purpose. |
| `.agents/rules.md`, `.agents/worker-contract.md` | **Copy**, subject to step 4 | Shared discipline. |
| `.agents/.claude-plugin/plugin.json` | **Copy** | Plugin wiring, not project content. |
| `.claude-plugin/marketplace.json` | **Copy only if absent**, then set `name` to this project's `workflow-<dir-name>` and match it in `.claude/settings.json` | Its name is per project — a name shared with another project on the machine serves that project's skills here — so an existing manifest is never overwritten. Without the file, `project@<name>` never registers and no restart fixes it. |
| `.agents/config.json` | **Never** | Engine pins, `workerCommands`, model choices — project facts. |
| `.agents/project.md` | **Never** | This project's identity. |
| `AGENTS.md`, `CLAUDE.md` | **Never copy — regenerate** (step 6) | Derived; copying installs the template's project facts here. |
| `docs/**`, source, tests | **Never** | Yours. |
| Files under `.agents/` that exist only here | **Leave, and report** (step 8) | A project may add its own; never delete to make the trees match. |

## Steps

1. **Resolve and pin the source.** Record its SHA and branch (`git -C <source> rev-parse --short HEAD`) — the SHA goes in the log entry and is what lets the next run say how far behind this project was. Say so if the source is behind its own remote: a stale checkout syncs old code that looks new.
2. **Refuse to sync into itself.** Same path as this checkout → stop.
3. **Classify before copying.** Diff the trees over the **Copy** rows with `diff -rq --strip-trailing-cr` — a Windows checkout is CRLF, and a plain diff flags files that are identical: files that differ, files only upstream, files only here. Report the counts.
4. **Checkpoint customization.** For each `.agents/` text file that differs, compare the project's copy with the template at the SHA the last `sync-template` log entry recorded: `git -C <source> show <sha>:<path> | diff --strip-trailing-cr - <project>/<path>`. No difference → the project never changed it: *stale*, safe to overwrite. A difference → *customized*, as is a path absent at that SHA or a SHA the source cannot resolve — nothing proves otherwise. Anything you cannot confidently call stale goes to the human via `human-checkpoint`, with its diff, before it is overwritten. `tools/workflow-mcp/**` skips this check. An empty argument is not consent — this step still runs.
5. **Copy, never delete.** Write the classified files (`tools only` → that row alone). A file only here is never deleted. Then reinstall the server's dependencies from the copied lockfile — `npm ci` in `tools/workflow-mcp/` (`npm install` only if the local npm refuses the lockfile): a template that added or bumped a dependency otherwise leaves a server that fails to start after the restart in step 8. A failed install is blocking, like step 7.
6. **Regenerate** — directly, not through the MCP's `sync`: the running server holds its own old source in memory, so a freshly copied `generate.mjs` would not run (`tools/workflow-mcp/getting-started.md` § Troubleshooting). From `tools/workflow-mcp/`, with a forward-slash root:
   ```
   node -e "import('./generate.mjs').then(m => m.generate('<repo-root>'))"
   ```
   Confirm the new content landed with a targeted grep.
7. **Validate before committing.** The loader gets stricter over time and `config.json` is never synced, so the new validator may refuse a config that loaded an hour ago. Check that `loadConfig` succeeds, every role in `list_roles` resolves an engine chain, and `checkGenerated` reports no drift. A config that no longer loads is **blocking**: report the rule that rejected it and stop. The human can repair it in the editor (`node tools/workflow-mcp/config-ui.mjs`, [`config.md`](../../tools/workflow-mcp/config.md)), which opens on a rejected file and offers to remove an unknown key; you fix it here only if asked. Typical causes: a `workerCommands` line with shell composition (`&`, `|`, `;`), an unknown key the loader used to ignore, an `effort` or model the engine does not accept. Never patch the copied validator to accept it, and never run the MCP's own test suite here — it belongs to the template.
8. **Report what was left behind:** files only here, and generic files kept customized in step 4 — the reasons the next sync will show drift again. Then name the **project-side setup the new version expects but this project lacks**, since project files are never synced: `check` reporting `architecture.enforced: false`, no `## Layers` in `docs/wiki/architecture.md`, no `.gitattributes` union line for `docs/wiki/log.md`, no CI step running `tools/workflow-mcp/verify.mjs`, no `claudeMdExcludes` for `**/.worktrees/**/CLAUDE.md` and `AGENTS.md` in `.claude/settings.json` (a Claude Code conductor otherwise loads every worker checkout's instructions into its own context). The first three map to `/project:init` step 5b or 5c, the last to `scripts/adopt.sh`'s settings keys — recommend them, don't do them here. Restart the session's MCP server so it runs the new code.
9. **Log, commit and push** per [`log-and-commit.md`](../skills/feature-branching/log-and-commit.md) — kind `chore`, subject `chore(workflow): sync <scope> from the template`, fields `Source: <path> @ <sha>`, `Changed: <N> files`, `Kept local: <list or none>`, `Config: loads | REJECTED — <rule>`.

## Failure modes

- **A customized file silently overwritten** — the expensive one; it surfaces later as "the workflow stopped doing what we set it up to do". Step 4 is the guard; `git diff HEAD~1` on this commit is the recovery.
- **`check` passes against a cached MCP** — it compares stale output against itself. The grep in step 6 is the real confirmation.

## What you do NOT do

- **No writes to the template.** A fix it needs is made there, with its own tests.
- **No `.agents/config.json` or `.agents/project.md`** — not even the parts that look generic.
- **No deletions to make the trees match.** Report the extras; the human decides.
- **No wiki work** — drift between this project's wiki and code is `/project:review` and `/project:wiki`.
