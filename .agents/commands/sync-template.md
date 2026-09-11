---
name: sync-template
description: Pull the generic agent workflow — .agents/ text and tools/workflow-mcp/ — from a template checkout into this adopting project, leaving project-owned files alone. Run in the adopting project, never in the template. Use when the template has fixes this project has not received, or when a cycle here rediscovers a bug that was already fixed upstream.
argument-hint: [template source — e.g. "../claude-code-template" | "tools only" | empty to reuse the last one from the log]
type: command
---

# /project:sync-template

**Argument:** `$ARGUMENTS`

The argument names **where the template is and how much to take**. A path (`../claude-code-template`, an absolute path) sets the source for this run. A scope word narrows step 5: `tools only` copies `tools/workflow-mcp/` and nothing else — the safe subset, because that tree is never customized per project. Both can appear together. Empty means: recover the source from the last `sync-template` entry in `docs/wiki/log.md` and take everything generic; if no entry exists, ask via `human-checkpoint` rather than guessing a path. The argument can never bypass the overwrite checkpoint in step 4 or the validation in step 7.

You copy generic files from a template checkout into this project and regenerate what is derived. This is a one-directional pull: nothing here is ever written back to the template.

## When to use

- The template has landed fixes this project has not received.
- A cycle here filed a finding that turns out to be already fixed upstream — the lag is the finding.
- Before starting a large piece of work, so the cycle runs on current tooling.

## Preconditions

- **This is not the template.** If `.agents/project.md` still carries the unfilled template placeholders, or this checkout is the template itself, stop — syncing a template into itself corrupts both sides of the comparison.
- On `develop`, or your active branch if running mid-cycle (behavioral rule 19 — `.agents/` and tooling are living operations, not a feature).
- Working tree clean, **and clean because you left it that way**: run `git status --porcelain` and account for every line. A path you did not touch is another session's work, not dirt (rule 21).
- The template source resolves to a real checkout with `.agents/` and `tools/workflow-mcp/` in it.

If any fails: run `human-checkpoint`.

## What is generic and what is yours

This table is the whole decision. Getting it wrong either drops the project's own configuration or leaves the lag in place.

| Path | Action | Why |
| --- | --- | --- |
| `tools/workflow-mcp/**` | **Copy** (skip `node_modules/`, `package-lock.json`) | Pure tooling. Never customized per project — if it is, that is a bug to report upstream, not a local edit to protect. |
| `.agents/skills/`, `.agents/roles/`, `.agents/commands/` | **Copy**, subject to step 4 | The workflow itself. Usually identical; occasionally a project has deliberately diverged. |
| `.agents/rules.md`, `.agents/worker-contract.md` | **Copy**, subject to step 4 | Behavioral rules are shared discipline. |
| `.agents/.claude-plugin/plugin.json` | **Copy** | Plugin wiring, not project content. |
| `.agents/config.json` | **Never** | Engine pins, `workerCommands`, model choices — all project facts. |
| `.agents/project.md` | **Never** | This project's identity. |
| `AGENTS.md`, `CLAUDE.md` | **Never copy — regenerate** (step 6) | Derived from `.agents/`. Copying them installs the template's project facts into this repo. |
| `docs/**`, source, tests | **Never** | Yours entirely. |
| Anything under `.agents/` that exists here and not upstream | **Leave, and report** | A project may add its own. Never delete to make the trees match — see step 8. |

## Steps

1. **Resolve the source and pin it.** Take the path from `$ARGUMENTS`, or the last `sync-template` log entry. Record the template's current SHA (`git -C <source> rev-parse --short HEAD`) and its branch — that SHA goes in the log entry and is what makes the next run able to say how far behind this project was.

2. **Refuse to sync a template into itself.** Compare the resolved source against this checkout's root. Same path → stop and report; there is nothing to pull.

3. **Classify, before copying anything.** Diff the two trees over the **Copy** rows of the table above. Produce three lists: files that differ (will change), files only upstream (will be added), files only here (will be left alone). Report the counts.

4. **Human checkpoint on customization — the one that matters.** For each `.agents/` text file in the "will change" list, decide whether this project's version looks *customized* or merely *stale*: stale is behind on upstream edits, customized carries content the template never had. Any file you cannot confidently call stale goes to the human via `human-checkpoint` with the diff, before it is overwritten. `tools/workflow-mcp/**` skips this check by table rule. An empty argument does not mean consent — it means take everything generic, and this step still runs.

5. **Copy, never delete.** Write the files from the classification. Deleting a file that exists only here is out of scope for this command, always: an adopting project's extra skill is not drift. Honour a `tools only` argument here by copying that row alone.

6. **Regenerate the derived files.** Do **not** call the workflow MCP's `sync` — the server caches its own source for the life of the session, so a just-copied `generate.mjs` will not be the one that runs (`gotchas.md`). Invoke it directly instead, from `tools/workflow-mcp/`, with a forward-slash root path:
   ```
   node -e "import('./generate.mjs').then(m => m.generate('<repo-root>'))"
   ```

7. **Validate before committing, because a stricter template can reject this project's config.** The config loader gets stricter over time, and `.agents/config.json` is deliberately not synced — so the newly copied validator may refuse a file that loaded fine an hour ago. Check three things and read the output: `loadConfig` succeeds; every role in `list_roles` resolves to an engine chain; `checkGenerated` reports no drift. A config that no longer loads is a **blocking** failure — report exactly which rule rejected it and stop, rather than committing a project that cannot dispatch. Do not run the MCP's own test suite here; it is the template's suite and belongs in the template.

8. **Report what was left behind.** Name the files that exist only in this project, and any generic file the human chose to keep customized in step 4. These are the reasons the next sync will show drift again, and an unexplained recurring diff is how a project stops trusting this command.

9. **Log, commit and push** per [`log-and-commit.md`](../skills/feature-branching/log-and-commit.md) — kind `chore`, subject `chore(workflow): sync <scope> from the template`, fields `Source: <path> @ <sha>`, `Changed: <N> files`, `Kept local: <list or none>`, `Config: loads | REJECTED — <rule>`. The SHA is the load-bearing field: it is what the next run compares against, and without it "are we current?" costs a full tree diff.

## Failure modes

- **The template source is stale too.** A path pointing at a checkout that has not itself been pulled syncs old code that looks new. Report the source's SHA and branch in step 1 so this is visible, and say so if the source is behind its own remote.
- **Config rejected by the new validator** (step 7). Blocking. Common shape: an entry that a newly added rule forbids — a `workerCommands` line carrying shell composition (`&`, `|`, `;`), an unknown role key. Fix `.agents/config.json` here, then re-run step 7. Never patch the freshly copied validator to accept it; that reintroduces the drift this command exists to remove.
- **A customized file silently overwritten.** The expensive one, because it surfaces later as "the workflow stopped doing the thing we set it up to do". Step 4 is the guard; if you skipped it, `git diff HEAD~1` on this commit is the recovery.
- **Regenerating with a cached MCP** (step 6). `check` passes because it compares stale output against itself. Verify the new content landed with a targeted grep before trusting it.

## What you do NOT do

- **No writes to the template.** One direction only. A fix this project needs in the template is a change made *there*, with its own tests.
- **No `.agents/config.json`, no `.agents/project.md`.** Not even "just the parts that look generic". If a role pin here is wrong, that is a decision for this project.
- **No deletions to make the trees match.** Report the extras; let the human decide.
- **No wiki work.** Drift between this project's `docs/wiki/` and its code is `/project:review` and `/project:wiki`, not this.
