# Wiki-Driven Development with Claude Code — Human Guide

## What is this?

A template for **wiki-driven development**: an LLM incrementally builds and maintains a persistent Obsidian-compatible wiki as the single source of truth for a project. Code is the implementation; the wiki is the spec. Sources you drop into `docs/raw/` get *ingested* into `docs/wiki/` — they never disappear, and the wiki never silently drifts from what was said.

- `docs/raw/` — immutable inputs (interview transcripts, notes, papers, any documents you drop in)
- `docs/wiki/` — the LLM-owned knowledge graph (living spec + entities + decisions + gotchas)
- `CLAUDE.md` — the schema describing both

Code development wraps around this: `/project:work` refuses to drift from the wiki, and a Stop-hook warns at session end if you edited code but forgot to update the wiki.

---

## Quick start

```bash
# 1. Unlock Write/Edit/Bash (required once per clone)
cp .claude/settings.local.json.template .claude/settings.local.json

# 2. (Optional) install qmd for semantic wiki search — see SETUP.md
go install github.com/tobi/qmd@latest

# 3. Open the repo in Claude Code
claude

# 4. Gather initial requirements (covers the whole project, once)
/project:interview

# 5. Detect stack, seed wiki/architecture.md
/project:init

# 6. Start work — classify → spec → red → green → refactor → update wiki → commit
/project:work
```

---

## Available commands

### Project commands (code flow)

| Command | What it does |
|---------|--------------|
| `/project:interview` | **Initial** project Q&A → full project scope, rewrites `docs/wiki/requirements.md` from scratch, seeds todos |
| `/project:feature` | **Incremental** feature Q&A → appends to `requirements.md`, creates entity page with Behavior spec, seeds TODOs |
| `/project:init` | Detect stack, set up environment, seed `docs/wiki/architecture.md` |
| `/project:work` | Classify TODOs (simple/complex/batch) → spec → red → green → refactor → update wiki → commit |
| `/project:review` | Periodic full audit: all code vs wiki spec, security, hidden bugs (every ~5 TODOs) |
| `/project:status` | Snapshot: todos, last wiki-log entries, pending raw sources, checkpoints |
| `/project:checkpoint` | Git tag + dump state to `docs/wiki/session-checkpoint.md` |
| `/project:rollback` | Revert to a checkpoint |
| `/project:fresh` | Resume from checkpoint in a new session |

### Wiki commands (knowledge flow)

| Command | What it does |
|---------|--------------|
| `/wiki:ingest [path]` | Process `docs/raw/` (or one file) into the wiki. Touches ~5–15 pages per source and flags contradictions |
| `/wiki:query <question>` | Answer from the wiki with `[[path#section]]` citations; offers a "file it back?" follow-up |
| `/wiki:lint` | 11-point health check — dead links, stale frontmatter, orphaned entities, wiki↔code drift |
| `/wiki:log [n]` | Tail the last `n` entries from `docs/wiki/log.md` |

---

## Browse the wiki

Open `docs/wiki/` as a vault in [Obsidian](https://obsidian.md/). Graph view, backlinks, and `[[wiki-links]]` all work out of the box. See [`SETUP.md`](SETUP.md) for vault config.

Key pages once content exists:

- `docs/wiki/index.md` — catalog
- `docs/wiki/requirements.md` — living spec (truth)
- `docs/wiki/architecture.md` — stack, conventions
- `docs/wiki/gotchas.md` — known failure points (**read before every task**)
- `docs/wiki/todos.md` / `docs/wiki/completed.md` — work queue
- `docs/wiki/log.md` — append-only op log
- `docs/wiki/entities/` — per-feature spec pages (code must match)
- `docs/wiki/decisions/` — ADRs

---

## Adding requirements

Three routes — pick by situation:

1. **Initial project setup** — `/project:interview` runs a full project Q&A (vision, user stories, functional requirements, constraints), then rewrites `docs/wiki/requirements.md` from scratch and seeds todos. Use once, at the start.
2. **New feature on an existing project** — `/project:feature` interviews you about one feature only, then **appends** to `requirements.md`, creates the entity page with the Behavior spec filled in, and seeds TODOs. This is the right route for adding an auth method, a new API endpoint, a UI flow, etc.
3. **Drop a raw doc** — put any markdown into `docs/raw/` (spec, meeting notes, research paper). The `raw-index-sync` hook auto-catalogs it as `pending`. Run `/wiki:ingest` when ready.

**Never edit `docs/raw/` files after creation.** If a transcript is wrong, append a correction doc and re-ingest — raw is immutable by design.

---

## Daily workflow

**Morning**
1. `/project:status` — what's pending and what shifted
2. `/wiki:log 10` — what was decided/changed recently
3. `/project:work` — start the top todo

**During work**
- `/project:checkpoint` before risky refactors
- `/wiki:query <question>` instead of guessing at spec
- If you edit code, update the matching `docs/wiki/entities/<slug>.md` *in the same commit* — the `wiki-drift-check` hook will warn if you don't

**Ending a session**
- `/project:checkpoint` — tag + snapshot
- `/wiki:lint` — catch dead links / drift early
- If context feels heavy → `/project:fresh` (not `/compact`)

---

## The hard rule

**The wiki is truth. Code that disagrees with the wiki is the bug.**

If behavior should actually change, edit the wiki spec *first*, commit, then align the code. If the code is right and the wiki is wrong, fix the wiki first anyway — the commit history makes the order clear. This is what keeps code and spec from silently diverging over months of LLM work.

---

## Team usage

Multiple developers can share one wiki safely:

1. Each developer runs their own Claude Code session.
2. Use git worktrees for isolation: `git worktree add ../feature-x feature-x`.
3. Merge to main sequentially; `/wiki:lint` on main catches conflicting edits.

### Parallel agents (experimental)

```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
claude
```

Note: the implementer agent no longer runs in an isolated worktree by default. Both tester and implementer work in the same branch. For true isolation, use git worktrees manually per developer.

---

## Troubleshooting

**Write/Edit/Bash blocked** — copy the local permissions template: `cp .claude/settings.local.json.template .claude/settings.local.json`. Base `settings.json` stays read-only for safety.

**Hooks not running** — `chmod +x .claude/hooks/*.sh` and verify `jq` is installed (`brew install jq` / `apt install jq`).

**Agent not found** — restart Claude Code after adding agent files. Run `/agents` to list them.

**`/wiki:query` finds nothing** — either the wiki is empty (run `/project:interview` or `/wiki:ingest`), or your `qmd` index is stale (`qmd index docs/wiki`).

**Wiki-drift warning at session end** — you edited code but didn't touch a wiki page. Open the relevant `docs/wiki/entities/<slug>.md` and update it; re-commit.

**Context heavy** — `/project:checkpoint` then `/project:fresh` in a new session. Don't trust `/compact` — it's lossy and you don't control what survives.

**Reset the wiki** — delete `docs/wiki/` and re-run `/project:init` + `/wiki:ingest docs/raw/`. Raw is the seed of truth; the wiki can always be rebuilt.

**Behavioral rules ignored** — CLAUDE.md guidance is followed ~70% of the time. Hard guarantees belong in hooks (`.claude/hooks/`), not rules. Add new rules to `.claude/rules/behavioral.md` as failures occur.
