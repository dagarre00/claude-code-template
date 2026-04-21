---
name: setup
description: One-time setup guide for this wiki-driven Claude Code template. Install qmd, configure MCP, verify hooks.
type: guide
---

# Setup

One-time setup for this wiki-driven Claude Code template. Run through this after cloning.

---

## 1. Prerequisites

- **Claude Code** — install from https://claude.com/claude-code
- **Git** — any recent version
- **Go 1.22+** — only if you want `qmd` for semantic wiki search (optional but recommended)
- **Obsidian** (optional) — to browse `docs/wiki/` as a graph

---

## 2. Install `qmd` (optional — enables semantic wiki search)

[`qmd`](https://github.com/tobi/qmd) is a hybrid BM25 + vector search tool for markdown, built by Tobi Lutke. It lets `/wiki:query` answer questions across the wiki using semantic search instead of raw grep.

### Option A — `go install` (fastest)

```bash
go install github.com/tobi/qmd@latest
```

Binary lands in `$GOPATH/bin` (usually `~/go/bin`). Make sure that's on your `PATH`:

```bash
echo 'export PATH="$HOME/go/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Option B — build from source

```bash
git clone https://github.com/tobi/qmd.git
cd qmd
go build -o qmd .
sudo mv qmd /usr/local/bin/
```

### Verify

```bash
qmd --help
```

### Index this repo's wiki

From the repo root:

```bash
qmd index docs/wiki
```

Re-run after large ingests. Or add to a git hook if you're disciplined.

---

## 3. Configure Claude Code MCP (optional — only if `qmd` ships an MCP server)

Check whether your `qmd` build exposes an MCP server:

```bash
qmd mcp --help
```

If it does, register it in `~/.config/claude-code/mcp.json` (or your platform's equivalent):

```json
{
  "mcpServers": {
    "qmd": {
      "command": "qmd",
      "args": ["mcp", "--root", "/absolute/path/to/this/repo/docs/wiki"]
    }
  }
}
```

Restart Claude Code. `/wiki:query` will auto-prefer `qmd` when available and fall back to `Grep` otherwise.

---

## 4. Obsidian vault (optional)

`docs/wiki/` is already Obsidian-compatible — wiki-links (`[[page#section]]`), frontmatter, and a graph view work out of the box.

1. Open Obsidian → **Open folder as vault** → select `docs/wiki/`.
2. Settings → **Files & Links** → set *New link format* to **Shortest path when possible**.
3. Install the **Dataview** plugin if you want to query frontmatter (e.g. `status: draft` pages).

Obsidian edits live-sync to disk; the next `/wiki:lint` run will catch anything broken.

---

## 5. Verify hooks

From the repo root:

```bash
ls -la .claude/hooks/
```

You should see:

- `wiki-drift-check.sh` — Stop hook. Warns if code was edited but no wiki page was touched.
- `raw-index-sync.sh` — PostToolUse hook. Auto-catalogs new files under `docs/raw/`.
- `reviewer-write-guard.sh` — guard for reviewer-agent writes.
- `auto-checkpoint.sh` / `on-task-complete.sh` — session bookkeeping.

Make them executable if needed:

```bash
chmod +x .claude/hooks/*.sh
```

---

## 6. First session smoke test

Open a Claude Code session in the repo root and run:

```
/project:status
```

You should see: no active todos, empty log, no pending raw sources, no checkpoints. That's the clean state.

Then:

```
/project:interview
```

to gather **initial** project requirements (full project scope, rewrites requirements.md).

Or if the project already exists and you're adding a feature:

```
/project:feature
```

to define a single new feature (appends to requirements.md, creates entity page, seeds TODOs).

Or `/wiki:ingest` if you've already dropped a transcript or spec doc into `docs/raw/`.

---

## 7. What to read next

- [`CLAUDE.md`](CLAUDE.md) — the schema. Wiki layout, frontmatter rules, operations.
- [`HUMAN.md`](HUMAN.md) — how a human collaborates with this setup day-to-day.
- [`docs/wiki/index.md`](docs/wiki/index.md) — the wiki's own front page once content exists.

---

## Troubleshooting

**`qmd: command not found`** — `$GOPATH/bin` not on `PATH`. See step 2.

**Hooks aren't firing** — check `.claude/settings.json` → `hooks` keys; re-run `chmod +x`.

**Obsidian shows no backlinks** — frontmatter must have `name:` and links must use `[[entities/<slug>]]` format.

**`/wiki:query` returns nothing** — either the wiki is empty (run `/wiki:ingest`) or `qmd` index is stale (`qmd index docs/wiki`).
