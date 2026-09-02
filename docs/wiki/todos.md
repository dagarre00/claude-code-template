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
- `[infra]` — deployment, CI, environment, or configuration work. Maps to a `docs/wiki/concepts/<slug>.md` page instead of an entity page (`/project:work` step 1); everything else about the cycle is unchanged, tests included.
- `[adversary]` — filed by an adversarial review rather than by a human. Format:

  ```markdown
  - [ ] [adversary] <one-line claim> — <severity>/<category>, F<N> of <sha>, entity <slug>
  ```

  Severity sets the section it lands in: `critical` → P0, `major` → P1, `minor` → P2. **`nit` findings are not filed at all** — the adversary tallies them in the round commit and they end there (`adversarial-review` § The reporting floor), because a queue that took 46 of them and acted on none was not a queue. The reasoning behind the filing is in the review's commit — `git log --grep="adversary round"`. These are ordinary todos: `/project:work` picks them up in priority order like any other.

## P0 saturation threshold

**`P0_MAX = 10`.** Ten open items in `## Now (P0 — next)` means P0 no longer means "next" — the queue is absorbing findings faster than cycles retire them, and a genuine emergency would be indistinguishable from the nine things ahead of it.

Count with:

```bash
awk '/^## Now \(P0/{f=1;next} /^## /{f=0} f && /^- \[ \]/' docs/wiki/todos.md | wc -l
```

The count is **all** P0 items, not just `[adversary]` ones — a saturated P0 is a scheduling problem whoever filed it. Two places act on it, and only two, so the threshold does not become a nag:

- **When filing** (`adversarial-review` skill, step 6a): crossing the threshold runs `human-checkpoint`. This is the moment of causation.
- **When `/project:work` is steered off P0** (step 1): its default is already to take the top item, so the normal path drains P0 first and needs no interruption. Only an argument that selects non-P0 work while P0 is saturated triggers a checkpoint.

To change the threshold for a project, edit the number here — both call sites reference this section rather than hard-coding it.

## Filed-findings backlog

**`FINDINGS_MAX = 40`.** Rule 20 makes *filed* the default disposition for every `minor` finding, so this queue grows by design — and a queue nothing drains is where findings go to be forgotten while everyone believes they were handled. Real numbers from projects running this template: 146 open `[adversary]` items after eleven days, 98 of them `minor` and 46 `nit`, with roughly one in seven ever fixed.

Count with:

```bash
grep -c '^- \[ \] \[adversary\]' docs/wiki/todos.md 2>/dev/null || true
```

The `|| true` is not decoration: `grep -c` exits 1 when the count is zero, which is the *healthy* state of this queue. Without it the command fails in any chained or `set -e` context, and both call sites below carry the same guard.

Unlike `P0_MAX`, this is not a saturation alarm — a long `minor` tail is normal and mostly harmless. It is a **re-triage trigger**, and exactly two things act on it:

- **`/project:wiki-lint`** re-triages the whole `[adversary]` backlog on each pass: re-grade what was mis-severed, merge duplicates, close what later work already fixed. Closing a finding here needs the same one-line reason in the commit body that rejecting one needs (rule 20) — a queue pruned silently is a queue deleted.
- **`/project:work` step 12** surfaces `/project:wiki-lint` as due once the count reaches `FINDINGS_MAX`.

If a finding survives two re-triage passes untouched, its severity was wrong when it was filed. Close it with that as the reason, or promote it — leaving it is the only option that teaches nothing.

## Now (P0 — next)

_(Empty — run `/project:interview` to populate.)_

## Next (P1)

_(Items waiting for capacity. Should map to entity pages.)_

## Later (P2)

- [ ] [adversary] Migrate remaining Claude commands (/project:init, /project:agent-scout, /project:handoff) into .agents/skills/ if needed — minor/other, F5 of bd5d7d6, entity agy-integration

## Backlog

_(Long-tail. Periodically pruned during `/project:review`.)_
