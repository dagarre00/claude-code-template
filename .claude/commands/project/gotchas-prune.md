---
name: gotchas-prune
description: Prune and compact docs/wiki/gotchas.md when it grows too large for models to scan. Enforces the When/Symptom/Cause/Fix format, removes stale entries, promotes critical items, and archives overflow. Run when gotchas.md exceeds ~60 lines of content or when /project:review flags attention loss.
type: command
---

# /project:gotchas-prune

Gotchas.md degrades in two ways: **volume** (too many entries to scan) and **format drift** (entries ballooning into essays). Both cause models to miss relevant traps. This command fixes both.

## When to run

- `gotchas.md` exceeds ~60 lines of actual content (excluding frontmatter/headers).
- `/project:review` or a post-session gotcha audit flags that models are ignoring entries.
- A section has more than 5 entries — too many to absorb in one read.
- An entry was added more than 6 months ago and references a feature that no longer exists.

## Preconditions

- Working tree clean. If dirty: commit first or run `human-checkpoint`.
- No active `feat/*` or `fix/*` branch in progress — this is maintenance, not feature work.

## Steps

### 1. Branch

```bash
git checkout -b chore/gotchas-prune-YYYY-MM-DD
```

### 2. Read and triage

Open `docs/wiki/gotchas.md`. For every entry, classify it as one of:

| Class        | Criteria                                                                           | Action                            |
| ------------ | ---------------------------------------------------------------------------------- | --------------------------------- |
| **Keep**     | Still applies; format is tight (≤ 1 paragraph per field)                           | Leave as-is                       |
| **Compact**  | Still applies; entry is verbose (multi-paragraph fields, prose instead of bullets) | Rewrite to single-sentence fields |
| **Archive**  | Fixed at the root (the code was changed), or references a deleted entity           | Move to archive                   |
| **Delete**   | Duplicate of another entry, or generic discipline issue already in `behavioral.md` | Remove entirely                   |
| **Escalate** | Critical severity that is buried in a lower section                                | Promote to `## Critical`          |

Do **not** rewrite the meaning of an entry — only its format. When in doubt about whether something is still relevant, keep it.

### 3. Compact verbose entries

The target format is strictly:

```markdown
### <Short, scannable title>

**When:** <one sentence>
**Symptom:** <one sentence>
**Cause:** <one sentence>
**Fix:** <one sentence — or two if the steps differ by context>
**Related:** [[entities/<slug>]]
```

If a field needs more than one sentence to be correct, the entry describes a concept, not a gotcha. File a `wiki-todos.md` entry to create a `[[concepts/<slug>]]` page, then replace the verbose field with a link: `**Fix:** See [[concepts/the-pattern]]`.

### 4. Archive overflow

When the file has more entries than models can hold in one scan (rough threshold: more than 10 entries across all sections), move the oldest non-Critical entries to `docs/wiki/gotchas-archive.md`:

```markdown
<!-- Append to gotchas-archive.md -->

## Archived YYYY-MM-DD

### <title from original>

...
```

Keep `gotchas.md` itself under 10 entries total. Agents rarely need entries from 6+ months ago; the archive exists only for reference.

### 5. Re-sort sections

Final order in `gotchas.md`:

1. `## Critical` — silent data corruption, security, unrecoverable state
2. `## Runtime` — things that go wrong while the code runs
3. `## Testing` — fixture isolation, flake, framework quirks
4. `## Tooling` — build, lint, formatter, env quirks

Within each section: most recently added last (new agents need the latest context; the newest entry is the live signal).

### 6. Update frontmatter

Change `updated:` to today's date.

### 7. Commit

```bash
git add docs/wiki/gotchas.md docs/wiki/gotchas-archive.md
git commit -m "chore(wiki): prune gotchas — <N kept, M archived, K removed>"
```

### 8. Report to human

State: how many entries were kept, archived, deleted. List any entries you converted to `wiki-todos` for follow-up concept pages. If you promoted any entry to Critical, name it explicitly.

## What you do NOT do

- **Do not alter the meaning of any entry.** Format only.
- **Do not delete entries because they seem unlikely.** "Unlikely" gotchas are the ones agents forget to check.
- **Do not merge entries that differ in fix.** Separate fixes = separate entries.
- **Do not move a Critical entry to the archive.** Critical entries stay until the root cause is fixed in the code.

## Failure modes

- **Entry rewritten to be wrong.** Reset with `git checkout docs/wiki/gotchas.md` and re-read the original.
- **Archive grows as large as the original.** Archive is reference-only; agents don't load it. No action needed unless human requests it.
- **Entry references a broken `[[link]]`.** Append a `wiki-todos` line to create the missing page; don't delete the gotcha.
