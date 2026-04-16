---
name: wiki-lint
description: Health-check the wiki — contradictions, orphan pages, stale claims, broken links, code drift, missing ADRs.
type: command
---

Use the **wiki-maintainer** agent to run a full health check on `docs/wiki/`.

## Checks (run all)

1. **Broken wiki-links** — every `[[wiki-link]]` resolves to an existing file + anchor.
2. **Orphans** — pages with no inbound links (may indicate the page is unreferenced or should be merged).
3. **Hubs** — pages with >20 inbound links (may need splitting).
4. **Concept density** — terms mentioned ≥3 times across the wiki without their own `concepts/` page.
5. **Stale pages** — frontmatter `updated:` older than 30 days AND related raw sources have been ingested since.
6. **Contradictions** — `> ⚠ contradicts` markers or claims that disagree between pages.
7. **Code drift (code-dev specific)** —
   - Every feature area in `wiki/requirements.md` has a corresponding `entities/` page.
   - Every shipped row in `wiki/completed.md` still has a non-deprecated entity page.
   - No source file in `src/` lacks any entity-page reference.
8. **Missing ADRs** — non-trivial `entities/` pages whose `## Design` section makes choices not documented in `decisions/`.
9. **Pending raws** — rows in `docs/raw/index.md` still `pending` despite being >7 days old.
10. **Frontmatter hygiene** — every `.md` in `wiki/` has `name`, `description`, `type`; values match folder conventions.
11. **File-map drift** — regenerate `wiki/file-map.md` and diff; flag new files that haven't been integrated.

## Output

Produce a lint report organized by severity:
- **Critical** (broken links, code drift, contradictions) — fix now
- **Warning** (stale, orphans, missing ADRs)
- **Suggestion** (concept density, hub splits)

For each issue, suggest the concrete fix or question to ask.

Append `## [YYYY-MM-DD] lint | <n> critical, <m> warnings, <p> suggestions` to `docs/wiki/log.md`.
