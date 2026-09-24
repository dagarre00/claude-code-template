---
name: wiki
description: Wiki operations, both run by the wiki-maintainer so the conductor never reads a source or the findings backlog itself. With an argument, ingest one source (a file path, or "search for <topic>" to research first); with none, the periodic health pass — wiki-todos queue, reconciliation, lint, orphans, broken links and the filed-findings backlog.
argument-hint: [path/to/file | search for <topic>] — empty runs the periodic health pass
type: command
skills:
  wiki-maintainer: [wiki-update]
---

# /project:wiki

**Argument:** `$ARGUMENTS`

The argument **picks the mode**:

- **A path that exists** → **ingest** from that file. A name that is both a real path and a plausible topic resolves to the file; `search for …` means research.
- **Any other source or topic** (`search for exchange rate APIs`, `research OAuth PKCE`) → **ingest** from web research.
- **Empty** → **health pass**.
- **A narrowing phrase that names no source** (`entities/ only`, `broken links`, `archive the log`) → a health pass with that focus; the maintainer skips the checks outside it.

If you cannot tell whether it names a source or narrows a pass, ask: guessing wrong either skips a pass the human wanted or invents a summary from a lint instruction.

The conductor never reads the source or the backlog — every read, dedup, write and cross-link happens in the `wiki-maintainer`'s worktree. Every dispatch here, `researcher` and `wiki-maintainer` alike, runs per the `worker-dispatch` skill.

## Preconditions

- **Ingest:** a clean tree, except the source being ingested (a file the human just dropped counts — step 1 commits it). The file readable, or network access for research.
- **Health pass:** a clean tree — the maintainer writes across `docs/wiki/`, so unrelated dirt there is indistinguishable from its output.
- `docs/wiki/` exists, with `summaries/` for ingest, and `requirements.md` and `wiki-todos.md` for a pass.

Any other dirt → `human-checkpoint` (rule 21). Then **sync develop** with the guarded block in [`sync-develop.md`](../skills/feature-branching/sync-develop.md) (its stop conditions apply), so the wiki you dedup against is current.

## Ingest mode

One source in, one `summaries/` page out, cross-linked. No lint work — that is the health pass.

1. **Get the source committed under `docs/raw/`, unread.** The maintainer works in a worktree cut from committed HEAD, and `prepare_worktree` refuses a dirty checkout — an uncommitted or out-of-repo source is invisible to it. A file → copy it into `docs/raw/` if it lives elsewhere (keep its name), and commit that path alone, `docs(raw): add <name>` (step 4's log entry covers it). Research → dispatch the `researcher` with the query (if `check` lists it under `capability_gaps` for its engine, pass `cli_engine` elsewhere); it writes `docs/raw/research/<slug>.md`, which integrating its dispatch commits. Nothing returned, or every source unreachable → report and stop; never synthesize a summary from nothing.

2. **Dispatch the `wiki-maintainer`** with the source path and "ingest this source". Its role and the `wiki-update` skill carry the procedure: read it fully, run the placement check, write `summaries/<slug>.md` from the skill's summary template, cross-link, and flag contradictions on both pages.

3. **Review its diff** (`git diff --stat` in its worktree): only `docs/wiki/` — no code, and nothing under `docs/raw/`.

4. **Log, commit and push** per [`log-and-commit.md`](../skills/feature-branching/log-and-commit.md) — kind `wiki-ingest`, fields `Ingested: <path> → [[summaries/<slug>]]` and `Cross-links added: <list>` from the maintainer's report. Stage `docs/wiki/` and `docs/raw/`; subject `docs: ingest <name> → [[summaries/<slug>]]`.

5. **Report** the slug, summary path, key claims and every contradiction flagged.

## Health-pass mode

Periodic, not every cycle. Due when any fires: `wiki-todos.md` has more than 10 open entries; open `[adversary]` todos reach `FINDINGS_MAX` (`docs/wiki/todos.md § Filed-findings backlog`); more than 5 work cycles since the last pass; `/project:review` flagged drift; a batch of raw sources landed.

1. **Count — and read nothing else:**

   ```bash
   grep -c "^## \[" docs/wiki/log.md 2>/dev/null || true                      # archive at >= 100
   grep -c '^- \[ \] .*\[adversary\]' docs/wiki/todos.md 2>/dev/null || true  # against FINDINGS_MAX
   ```

2. **Dispatch the `wiki-maintainer`** for a health pass, with the focus (if any), both counts, and the raw files that have no matching summary — never the backlog's contents, which it reads in its own worktree. Its role defines the pass.

3. **Expect back:** resolved `wiki-todos` lines removed; every re-triage disposition (Closed / Re-graded / Kept) with its one-line reason; summaries for stragglers; cross-links making every new page reachable; `status: stub` pages for missing prerequisites, never invented content; migrated pages with facts moved, not rewritten; archive files if a threshold was hit; and the fields for the log entry.

4. **Review its diff** (`git diff --stat`): nothing outside `docs/wiki/`, no modified raw files, no mass entity rewrites — a 500-line entity diff is a red flag.

5. **Log, commit and push** per [`log-and-commit.md`](../skills/feature-branching/log-and-commit.md) — kind `wiki-maintenance` with the maintainer's fields, staging `docs/wiki/`; subject `chore(wiki): lint — <N todos, M orphans, K broken links, F findings re-triaged>`, with every Closed/Re-graded reason in the body (rule 20: a disposition that exists only in a discarded report satisfies nothing).

6. **Report** what was processed, what remains, gaps and contradictions — and the maintainer's questions **in one lot**. The human or `/project:interview` settles a contradiction; `contradicts` stays flagged until then.

## Failure modes

- **File missing or unreadable** → report the exact error; never guess the format.
- **Slug collision** → the same concept under another name means updating that page; a genuinely different one takes a discriminator (`-2`) and a warning to the human.
- **The maintainer touched code or rewrote large entity sections** → reject the dispatch and re-dispatch with stricter instructions; entity rewrites go through `/project:interview`.

## What you do NOT do

- **No code changes** — `docs/wiki/` and `docs/raw/` only, and raw files are append-only (rule 11).
- **No silent contradiction resolution** — flag both sides; the human decides.
- **No mass entity rewrites** — a cross-link is fine; rewriting an entity to match a source is `/project:interview`.
- **No lint during an ingest, and no named-source ingest during a health pass.** The pass's straggler sweep covers only raw files nobody ingested.
