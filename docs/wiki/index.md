---
name: index
description: Catalog of every wiki page, one line each. Updated by wiki-maintainer on every ingest.
type: wiki-index
updated: 2026-05-16
status: draft
---

# Wiki Index

> Catalog of the wiki. One line per page. Sorted by section. The `wiki-maintainer` agent keeps this in sync.

## Project basics

- [[requirements]] — what the project does (living spec)
- [[architecture]] — stack, patterns, testing strategy
- [[git-conventions]] — branching and commit conventions
- [[commands]] — working shell commands (build, test, lint, run)
- [[glossary]] — project vocabulary (domain terms, aliases)

## Work tracking

- [[todos]] — priority-ordered work queue
- [[completed]] — shipped work with backrefs
- [[gotchas]] — known failure points
- [[wiki-todos]] — cleanup queue for the wiki-maintainer
- [[log]] — chronological ops log

## Entities

_(one page per feature / module / component — populated by `/work` and `/interview`)_

## Concepts

- [[concepts/handoff-format]] — schema for the tester→implementer handoff JSON (incl. `attempt` for the two-strike rule)

_(patterns, conventions, domain ideas — promoted by the wiki-maintainer when a pattern recurs)_

## Decisions (ADRs)

_(architectural decisions — filed via the `decision-recording` skill)_

## Summaries

_(one page per ingested raw source — produced by the wiki-maintainer)_
