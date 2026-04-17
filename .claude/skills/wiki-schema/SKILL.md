---
name: wiki-schema
description: Full specification of the wiki-driven knowledge base — directory layout, page templates, frontmatter, Code References format, and the ingest/query/lint procedures. Load this whenever operating on docs/wiki/ or docs/raw/ — especially inside the wiki-maintainer agent and every /wiki:* command. Implementer/tester/reviewer agents do NOT need this; they work against specific entity pages only.
type: skill
---

# Wiki Schema

This skill is the canonical reference for how the wiki is organized and how it is maintained. `CLAUDE.md` only describes the shape of the system; this skill describes the mechanics.

**Load when:**
- You are the `wiki-maintainer` agent.
- You are executing a `/wiki:*` or `/project:*` command that creates, edits, or cross-links pages under `docs/wiki/` or `docs/raw/`.
- You need to know the on-disk structure, page templates, or frontmatter rules.

**Do not load when:** implementing feature code, writing tests, or reviewing code — those agents read specific pages only and do not own the schema.

---

## 1. Directory layout

```
docs/
├── raw/                        # immutable sources — read only, never edit
│   ├── index.md                # catalog + ingestion status per source
│   ├── feature-requests/       # /project:feature specs land here
│   ├── interviews/             # /project:interview output lands here
│   ├── memory-snapshots/       # agents drop knowledge dumps here
│   └── <user-dropped-files>    # PDFs, markdown, transcripts, anything
├── wiki/                       # LLM-owned knowledge base
│   ├── index.md                # one-line catalog of every page
│   ├── log.md                  # append-only ops log
│   ├── requirements.md         # LIVING SPEC — code must match
│   ├── architecture.md         # stack, conventions, patterns
│   ├── todos.md                # priority-ordered work queue
│   ├── completed.md            # shipped work with wiki-link back-refs
│   ├── gotchas.md              # known failure points
│   ├── commands.md             # working shell commands
│   ├── file-map.md             # auto-generated project tree
│   ├── entities/               # one page per feature/module/component
│   ├── concepts/               # patterns, conventions, domain ideas
│   ├── decisions/              # ADRs
│   └── summaries/              # one page per ingested raw source
├── changelog.md                # hook-appended session summaries
├── INDEX.md                    # pointer to wiki/index.md
└── SETUP.md                    # qmd install + environment setup
```

## 2. Frontmatter convention

Every `.md` under `docs/wiki/` (and every agent/command/skill/rule file under `.claude/`) must begin with YAML frontmatter:

```yaml
---
name: <kebab-case-short-name>
description: <one line, action-oriented>
type: wiki-entity | wiki-concept | wiki-decision | wiki-summary | wiki-index | wiki-log | wiki-spec
sources: [../raw/...]          # optional, list of raw source paths
updated: YYYY-MM-DD             # required on wiki pages
status: draft | approved | shipped | stale | deprecated
---
```

After any wiki edit, update the `updated:` field on the touched page.

## 3. Page types

| Folder | Type | Purpose |
|--------|------|---------|
| `entities/` | `wiki-entity` | One page per feature/module/component. The implementer reads it before coding and updates it after. |
| `concepts/` | `wiki-concept` | Patterns, conventions, cross-cutting ideas. File back non-obvious `/wiki:query` outputs here. |
| `decisions/` | `wiki-decision` | ADRs — one per non-trivial design choice. |
| `summaries/` | `wiki-summary` | One per ingested raw source. Describes what the source said and what pages it touched. |

Templates live in `docs/wiki/<folder>/README.md`. Always copy-adapt from the README when creating a new page.

## 4. Entity page template

```markdown
---
name: <feature-slug>
description: <one-line summary>
type: wiki-entity
status: draft | approved | shipped | deprecated
sources: [../raw/...]
updated: YYYY-MM-DD
---

# <Feature Name>

## Purpose
What this feature exists for.

## Behavior
How it behaves from the user's perspective. This is the test contract.

## Interface
API signatures, CLI surface, UI components — whatever applies.

## Design
How it's built. Key modules, data flow, dependencies on other entities.

## Code References

<!-- Last verified: YYYY-MM-DD -->
| Symbol | Location | Description |
|--------|----------|-------------|
| `functionName()` | `src/module/file.ts:42` | What it does |

## Related
- [[../requirements#<section>]]
- [[<other-entity>]]

## Open questions
```

## 5. Code References rules (mandatory for `status: approved` or `shipped`)

- File paths relative to repo root.
- Line number = **declaration** line, not a call site.
- Include: exported functions, classes, interfaces, key constants, configuration knobs.
- Omit: trivial getters/setters, test helpers, internal-only details, generated code.
- Update line numbers and the `<!-- Last verified: YYYY-MM-DD -->` comment after every refactor.
- Concept pages use `## Code Locations` (simpler bullet list is fine).
- **Ownership:** the implementer updates this table atomically with the code change. The wiki-maintainer only verifies it during the step-8 wiki update and the `/wiki:lint` pass.

### Enforcement hooks
- `code-ref-check.sh` (PostToolUse on `Write|Edit`) — warns when a source file is edited and (a) no entity references it, or (b) the referencing entity lacks a `## Code References` section.
- `wiki-drift-check.sh` (Stop) — at session end, lists all approved/shipped entity pages missing a Code References section.

## 6. Core operations

### Ingest — `/wiki:ingest [path]` → wiki-maintainer

1. Identify input: a specific path argument, or every row in `docs/raw/index.md` with `status: pending`.
2. For each source:
   - Read fully. Never modify.
   - Write `docs/wiki/summaries/<slug>.md` from the summaries template.
   - Update/create affected `entities/` pages. For entities tied to existing source code, `Grep -n` `src/` to populate or refresh the `## Code References` table.
   - Update `concepts/` if a pattern is introduced or revised; add `## Code Locations` when applicable.
   - If a non-trivial design choice is present, write an ADR under `decisions/`.
   - Cross-link: add `[[wiki-links]]` on every related page back to the new summary and forward to the new entities/concepts.
   - Flag contradictions inline: `> ⚠ contradicts [[page#section]]: <one-line>`.
3. Update `docs/wiki/index.md` with new pages.
4. Update the source's row in `docs/raw/index.md`: `status: ingested`, link to summary.
5. Append `## [YYYY-MM-DD] ingest | <source-title>` to `docs/wiki/log.md`.

**Quality gate:** one source should touch 5–15 pages. If you only touched one, re-read and look for implicit connections.

### Query — `/wiki:query <question>` (inline)

1. Read `docs/wiki/index.md` to locate candidate pages.
2. If `qmd` is installed (`command -v qmd`), prefer `qmd search "<question>" docs/wiki/` for hybrid BM25+vector search.
3. Read relevant pages, follow `[[wiki-links]]` where they add context.
4. Synthesize an answer. **Every claim must cite a page** using `[[path/to/page#section]]`. Cite raw sources from the page's `sources:` frontmatter when origin matters.
5. If the wiki is insufficient, say so; do not speculate.

**File back:** if the answer is non-obvious (cross-cutting or a new connection), offer to save it as `docs/wiki/concepts/<slug>.md`, link backward from related pages, add to `index.md`, and append `## [YYYY-MM-DD] query-filed | <title>` to `log.md`.

### Lint — `/wiki:lint` → wiki-maintainer

Run every check and emit a report organized by **Critical / Warning / Suggestion**:

1. Broken `[[wiki-links]]` (file or anchor missing).
2. Orphan pages (no inbound links).
3. Hub pages (>20 inbound links — candidates for split).
4. Concept density — terms mentioned ≥3× with no `concepts/` page.
5. Stale pages — `updated:` >30 days old AND related raw sources ingested since.
6. Contradictions — `> ⚠ contradicts` markers or disagreements between pages.
7. **Code drift:**
   - Requirements feature areas without an `entities/` page.
   - Shipped rows in `completed.md` whose entity is deprecated or missing.
   - Source files under `src/` with no entity-page reference.
8. Missing ADRs — `entities/*` whose `## Design` makes a choice not in `decisions/`.
9. Pending raws — rows in `docs/raw/index.md` still `pending` after 7+ days.
10. Frontmatter hygiene — every wiki page has `name`, `description`, `type`.
11. File-map drift — regenerate `wiki/file-map.md` and diff.
12. **Code References health:**
    - Approved/shipped entities missing a `## Code References` section.
    - Rows where the referenced file no longer exists at the given path.
    - Entities whose `<!-- Last verified: -->` lags `updated:` by >30 days.

Append `## [YYYY-MM-DD] lint | <n> critical, <m> warnings, <p> suggestions` to `docs/wiki/log.md`.

### Wiki update after code work (called from `/project:work` step 8)

Inputs: task title, diff, entity slug.

1. Update `## Behavior`, `## Interface`, `## Design` in `entities/<slug>.md` to match what was shipped.
2. Verify (do not rewrite) `## Code References` — the implementer owns this table.
3. If a non-trivial choice was made, write `decisions/<slug>.md`.
4. If the spec changed, update `requirements.md` and summarize the change.
5. Move the TODO from `In Progress` in `todos.md` to `completed.md` (include first commit SHA).
6. Update `commands.md` if new shell commands were introduced.
7. Append `## [YYYY-MM-DD] work | <task-title>` to `log.md`.
8. Regenerate `docs/wiki/file-map.md` (three levels deep).

## 7. Agent memory → raw sources

When a sub-agent finishes a task and learns something worth keeping (gotcha, pattern, decision), it writes a snapshot:

```
docs/raw/memory-snapshots/YYYY-MM-DD-<agent>-<slug>.md
```

The next `/wiki:ingest` integrates it into the relevant wiki pages.

## 8. Invariants

- **Raw is immutable.** Read-only. Only add new files to `docs/raw/`.
- **Agents own `docs/wiki/`.** Users browse; agents write. Exceptions (the initializer, the implementer's Code References rows, the reviewer's gotchas) are named explicitly in per-agent instructions.
- **Never silently delete content.** Supersede with a note, mark `status: stale`, or link to the replacement.
- **Cite forward and backward.** Every new page links to every related existing page; related pages backlink.
- **Keep `index.md` under ~200 lines.** Split into sub-indexes when it outgrows this (`entities/README.md` is already sub-indexed).
