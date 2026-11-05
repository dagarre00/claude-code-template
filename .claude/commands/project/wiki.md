---
description: Wiki operations, both run by the wiki-maintainer so the conductor never reads a source or the findings backlog itself. With an argument, ingest one source (a file path, or "search for <topic>" to research first); with none, the periodic health pass — wiki-todos queue, reconciliation, lint, orphans, broken links and the filed-findings backlog.
argument-hint: '[fast | handoff] [path/to/file | search for <topic>] — empty runs the periodic health pass'
disable-model-invocation: true
---

# /project:wiki

**Argument:** `$ARGUMENTS`

The argument **selects the mode**:
- **Existing file path** → **ingest** that file.
- **`search for <topic>` or research topic** → **ingest** via web research (`researcher` → `wiki-maintainer`).
- **Empty** → full **health pass**.
- **Narrowing phrase naming no source** (`entities/ only`, `broken links`, `archive the log`) → **health pass** scoped to that focus.

If ambiguous between a source and a health-pass filter, ask first. A leading `fast` or `handoff` sets the **dispatch mode** (`subagent-dispatch § Dispatch mode`) and is stripped before reading the rest.

## State at invocation

Branch: !`git branch --show-current`

```!
git status --short
```

You never read the raw source or backlog yourself — `researcher` and `wiki-maintainer` run in their own context via `subagent-dispatch`.

## Preconditions

- **Ingest:** clean tree (except a newly dropped raw source file, which step 1 commits).
- **Health pass:** clean tree.
- `docs/wiki/` exists with `summaries/`, `requirements.md`, and `wiki-todos.md`.

Any other uncommitted changes → `human-checkpoint` (rule 21). Then **sync develop** via [`sync-develop.md`](../../skills/feature-branching/sync-develop.md).

## Ingest mode

1. **Commit the raw source under `docs/raw/`, unread:**
   - **Local file:** copy into `docs/raw/` if outside it and commit alone: `docs(raw): add <name>`.
   - **Research query:** dispatch `researcher` with the query and scope `docs/raw/research/<slug>.md`, then commit its output file alone: `docs(raw): research <slug>` (if unreachable or empty, report and stop).
2. **Dispatch `wiki-maintainer`** with the `docs/raw/` path, task `"ingest this source"`, and `Scope: docs/wiki/`.
3. **Verify diff** (`git status --short`): only `docs/wiki/` changed (no code or `docs/raw/` edits).
4. **Log, commit and push** per [`log-and-commit.md`](../../skills/feature-branching/log-and-commit.md) — kind `wiki-ingest`, fields `Ingested: <path> → [[summaries/<slug>]]` and `Cross-links added: <list>`. Stage `docs/wiki/`; subject `docs: ingest <name> → [[summaries/<slug>]]`.
5. **Report** slug, summary path, key claims, and any contradictions flagged.

## Health-pass mode

Run periodically when `wiki-todos.md` has 10+ items, open `[adversary]` todos hit `FINDINGS_MAX`, 5+ `work` cycles elapsed since the last pass, `/project:review` flagged drift, or a batch of raw files landed.

1. **Gather counts without reading the files:**

   ```bash
   grep -c "^## \[" docs/wiki/log.md 2>/dev/null || true                      # archive at >= 100
   grep -c '^- \[ \] .*\[adversary\]' docs/wiki/todos.md 2>/dev/null || true  # against FINDINGS_MAX
   find docs/raw -type f ! -name README.md ! -path 'docs/raw/interviews/*' | while IFS= read -r f; do grep -rqF -- "$f" docs/wiki/ 2>/dev/null || echo "$f"; done   # raw files no wiki page cites
   ```

2. **Dispatch `wiki-maintainer`** with the focus (if any), both counts, the uncited raw files from step 1, and `Scope: docs/wiki/` (including `wiki-todos.md`, `todos.md` for `[adversary]` re-triage, and `log.md` for archiving).
3. **Verify diff** (`git diff --stat`): only `docs/wiki/` touched, no modified `docs/raw/` files, and no mass entity rewrites.
4. **Log, commit and push** per [`log-and-commit.md`](../../skills/feature-branching/log-and-commit.md) — kind `wiki-maintenance` with the maintainer's fields, staging `docs/wiki/`; subject `chore(wiki): lint — <N todos, M orphans, K broken links, F findings re-triaged>`, including every Closed/Re-graded `[adversary]` reason in the commit body (rule 20).
5. **Report** processed counts, remaining items, gaps/contradictions, and the maintainer's human questions in one batch.

## Failure modes

- **Source missing or unreadable** → report exact error and stop.
- **Slug collision** → merge if same concept; append `-2` and warn if distinct.
- **Maintainer touched code or rewrote entity specs** → reject (`subagent-dispatch`) and re-dispatch with stricter scope.

## What you do NOT do

- **No code changes** and **no modifying existing `docs/raw/` files** (rule 11).
- **No silent contradiction resolution** and **no mass entity rewrites** (use `/project:interview`).
- **No mixing ingest and health-pass lint** (health pass only ingests uncited stragglers).
