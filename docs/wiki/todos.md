---
aliases: [Work queue]
type: reference
domains: [software]
status: stable
sources: []
contradicts: []
open_questions: []
created: 2026-04-15
updated: 2026-09-23
---

# Todos

> [!abstract] Essence
> The priority-ordered work queue. `/project:work` takes the top item (or a batch sharing context) and removes it when shipped — git history is the record of finished work.

## Tags

- `[complex]` — decompose with the `planner` before implementing.
- `[infra]` — deployment, CI, environment or configuration work, backed by a `docs/wiki/concepts/<slug>.md` page instead of an entity; otherwise an ordinary cycle, tests included.
- `[wiki]` — wiki cleanup for `/project:wiki`, never `/project:work`.
- `[adversary]` — filed by an adversarial review:

  ```markdown
  - [ ] [adversary] <one-line claim> — <severity>/<category>, F<N> of <sha>, entity <slug>
  ```

  Severity picks the section: `critical` → P0, `major` → P1, `minor` → P2. `nit` findings are never filed. The reasoning is in the round commit (`git log --grep="adversary round"`). Otherwise ordinary todos, worked in priority order.

## P0 saturation threshold

**`P0_MAX = 10`.** At ten open P0 items, P0 no longer means "next" and a real emergency is indistinguishable from the nine ahead of it. Count every P0 item, whoever filed it:

```bash
awk '/^## Now \(P0/{f=1;next} /^## /{f=0} f && /^- \[ \]/' docs/wiki/todos.md | wc -l
```

Checked in exactly two places: when filing findings (`finding-disposition`), and when an argument steers `/project:work` off P0. Change the number here to tune it.

## Filed-findings backlog

**`FINDINGS_MAX = 40`.** Filing is the default for `minor` findings, so this backlog grows by design — and a queue nothing drains is where findings are forgotten while everyone believes they were handled. Count every open line carrying the tag, wherever on the line it sits (`|| true` because `grep -c` exits 1 on the healthy count of zero):

```bash
grep -c '^- \[ \] .*\[adversary\]' docs/wiki/todos.md 2>/dev/null || true
```

Not an alarm but a re-triage trigger: every `/project:wiki` health pass re-grades, merges and closes these, each closure with a one-line reason in its commit, and `/project:work` recommends that pass once the count reaches `FINDINGS_MAX`. A finding untouched through two re-triages had the wrong severity — close it or promote it.

## Now (P0 — next)

_(Empty — run `/project:interview` to populate.)_

## Next (P1)

_(Empty.)_

## Later (P2)

_(Empty.)_

## Backlog

_(Empty — the long tail, pruned during `/project:review`.)_
