---
aliases: [Work queue]
type: reference
domains: [software]
status: stable
sources: []
contradicts: []
open_questions: []
created: 2026-04-15
updated: 2026-08-05
---

# Todos

> [!abstract] Essence
> Priority-ordered work queue. `/project:work` takes the top item (or a batch sharing context). When complete, items are removed — git history is the record of shipped work. Lines tagged `[wiki]` are wiki-cleanup deferrals for `/project:wiki-lint`, not `/project:work`.

## Tags

- `[wiki]` — wiki cleanup; `/project:wiki-lint` processes these, not `/project:work`.
- `[complex]` — decompose with the `planner` before implementing.
- `[adversary]` — filed by an adversarial review rather than by a human. Format:

  ```markdown
  - [ ] [adversary] <one-line claim> — <severity>/<category>, F<N> of <sha>, entity <slug>
  ```

  Severity sets the section it lands in: `critical` → P0, `major` → P1, `minor` → P2, `nit` → Backlog. The reasoning behind the filing is in the review's commit — `git log --grep="adversary round"`. These are ordinary todos: `/project:work` picks them up in priority order like any other.

## P0 saturation threshold

**`P0_MAX = 10`.** Ten open items in `## Now (P0 — next)` means P0 no longer means "next" — the queue is absorbing findings faster than cycles retire them, and a genuine emergency would be indistinguishable from the nine things ahead of it.

Count with:

```bash
awk '/^## Now \(P0/{f=1;next} /^## /{f=0} f && /^- \[ \]/' docs/wiki/todos.md | wc -l
```

The count is **all** P0 items, not just `[adversary]` ones — a saturated P0 is a scheduling problem whoever filed it. Two places act on it, and only two, so the threshold does not become a nag:

- **When filing** (`adversarial-review` skill, step 6): crossing the threshold runs `human-checkpoint`. This is the moment of causation.
- **When `/project:work` is steered off P0** (step 1): its default is already to take the top item, so the normal path drains P0 first and needs no interruption. Only an argument that selects non-P0 work while P0 is saturated triggers a checkpoint.

To change the threshold for a project, edit the number here — both call sites reference this section rather than hard-coding it.

## Now (P0 — next)

_(Empty — run `/project:interview` to populate.)_

## Next (P1)

_(Items waiting for capacity. Should map to entity pages.)_

## Later (P2)

_(Nice-to-have. Promote to Next when prioritized.)_

## Backlog

_(Long-tail. Periodically pruned during `/project:review`.)_
