---
date: 2026-05-16
topic: template-hardening
interviewer: claude (sonnet-4.6)
interviewee: dagarre00
type: raw-interview
---

# Template hardening interview — 2026-05-16

Triggered by a project audit finding gaps in the template skeleton (incomplete `requirements.md` / `architecture.md`, missing LICENSE, hardcoded default branch, redundant test-run hook). The goal was to harden the template for use across a wide range of software projects.

> Raw transcript. Immutable — never edited later. Wiki updates derived from this transcript live in the relevant `docs/wiki/` pages.

---

## Round 1 — Scope

**Q1. License.**
Options offered: MIT (recommended), Apache 2.0, BSD-3, Unlicense/CC0.
**A:** MIT.

**Q2. Which structural sections should we add to `requirements.md`? (multi-select)**
Options: Glossary, Risks & assumptions, Success metrics / KPIs, Personas (separate from Users).
**A:** Risks & assumptions, Success metrics / KPIs. Plus: _"Maybe add a glossary.md file too, explain me in depth the personas concept before adding it."_

→ Glossary promoted to its own page (`docs/wiki/glossary.md`) rather than a section of requirements.
→ Personas decision deferred to round 2 after explanation.

**Q3. Which structural sections should we add to `architecture.md`? (multi-select)**
Options: Security/threat model, Observability, Environments, Diagrams slot.
**A:** Security / threat model, Observability, Environments (dev/staging/prod). Diagrams slot deferred (not selected).

**Q4. CI scaffolding.**
Options: GitHub Actions `.example` template (recommended), Active workflow, Multi-platform examples, Skip CI.
**A:** GitHub Actions `.example` template.

---

## Round 2 — Implementation details

**Q5. Personas.** (After in-depth explanation of personas vs. users — UX archetypes vs. auth roles.)
Options: Optional section in `requirements.md` (recommended), separate `personas.md`, skip.
**A:** Optional section in `requirements.md`.

**Q6. Schema versioning.**
Options: `SCHEMA_VERSION` constant only, version + `/upgrade-schema` command, skip.
**A:** Skip versioning.

**Q7. Auto-test-run opt-out at session end.**
Options: env var, marker file, both, flip to opt-in.
**A:** _"Reduce the hooks scope, the workflow should run tests during implementation, it is not very necessary yet to run the tests at beginning and end. Delete any other hooks or hooks commands you think are unnecessary."_

→ Interpreted as: remove the auto-test-run block entirely, and audit the rest of the hooks for pruning. Tests stay in the TDD loop (tester/implementer agents), not at session boundaries.

**Q8. Default-branch handling.**
Options: Auto-detect with env-var override (recommended), env-var only, settings.json field.
**A:** Auto-detect with env-var override.

---

## Round 3 — Final scope before implementation

**Q9. Hook pruning. (multi-select)**
**A:**

- Remove auto-test-run from session-end ✅
- Remove `git pull --ff-only` from session-start ✅
- Keep test-first-check, auto-format, wiki-drift-check as-is ✅
- Make Python venv detection optional if the project is Python; if not, recommend the user to remove the block after the first run.

→ Implemented: venv block fires only when Python markers (`pyproject.toml` / `requirements.txt` / `setup.py`) are present. When no markers are present, the hook drops a one-time nudge (markered via `.claude/tmp/venv-nudge-shown`) telling the user to delete the venv block.

**Q10. Wiki-link integrity check (broken `[[obsidian-links]]`).**
Options: fold into wiki-drift-check, separate hook, skip.
**A:** _"We need to keep the wiki actions apart from the main workflow. Agents should only touch wiki docs if they have the enough context and know the exact file to touch. If the change is complex, add a wiki-todo for the wiki maintainer to review later."_

→ Interpreted as: do **not** add an automated wiki-link lint hook. Wiki integrity is the wiki-maintainer's job during `/wiki-lint`. The existing rule #16 ("Append, don't bury") already covers the deferral pattern — no new rule needed.

**Q11. Walkthrough location.**
Options: HUMAN.md, new `docs/getting-started.md` (chosen), README, skip.
**A:** New `docs/getting-started.md`.

**Q12. Commit cadence.**
**A:** One commit per logical group.

---

## Decisions summary

| #   | Decision                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------ |
| 1   | LICENSE: MIT.                                                                                                |
| 2   | requirements.md: add Risks, Assumptions, Success metrics, optional Personas.                                 |
| 3   | New page: `docs/wiki/glossary.md`.                                                                           |
| 4   | architecture.md: add Security, Observability, Environments.                                                  |
| 5   | CI: `.github/workflows/ci.yml.example` (GitHub Actions, multi-stack).                                        |
| 6   | Schema versioning: skip for now.                                                                             |
| 7   | Hooks: drop auto-test-run; soften pull to non-mutating divergence report; gate venv check on Python markers. |
| 8   | Default branch: auto-detect via `origin/HEAD`, env-var override, `main` fallback.                            |
| 9   | Wiki integrity: stays manual via `/wiki-lint`. No new automation hook.                                       |
| 10  | Walkthrough: new `docs/getting-started.md`.                                                                  |

---

## Commits filed

- `docs: add MIT LICENSE`
- `docs(wiki): expand requirements + add glossary`
- `docs(wiki): add security, observability, environments to architecture`
- `chore(hooks): prune scope and harden default-branch resolution`
- `chore(ci): add GitHub Actions example workflow`
- `docs: add getting-started walkthrough`
- `docs: file template-hardening interview transcript` (this file)
