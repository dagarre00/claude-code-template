---
aliases: [Adversarial review post, croovies post]
type: summary
domains: [agents, software]
status: stable
sources:
  - docs/raw/research/adversarial-review-croovies.md
depends_on: []
contradicts: []
open_questions:
  - Does the 4-in-5 hit rate hold for small single-todo changes, or is it an artifact of ticket-sized diffs?
created: 2026-07-31
updated: 2026-07-31
---

# Adversarial reviews with Claude Code (croovies)

> [!abstract] Essence
> A practitioner report arguing that agent-written code needs a second model, with none of the author's context, pointed at the diff and told to find what's wrong — read-only, findings passed through a file. Over 83 reviewed tickets, four out of five turned up a real fix, and half of the resulting commits were the incident kind (concurrency, durability, security).

## Summary

The post reframes agent-assisted development as a management problem: once an agent writes the code, the human's job becomes accountability for a result they did not watch get produced. Unwatched output degrades — not from stupidity, but from the absence of a checker. Adversarial review is the cheapest available check: a second model reads the diff, raises findings, and is forbidden from touching the code. The author model triages and acts; the reviewer then reads the result again.

The mechanism is deliberately low-tech. No live channel between the two sessions is required — the reviewer writes findings to a file, and that file is handed to the author. What matters is only that the reviewer is a **different model or at least a context-free one**, that it is **read-only**, and that it runs **before the work is called done**.

## Key claims

- Agents left unchecked produce slop, for the same reason any unchecked worker does ← `docs/raw/research/adversarial-review-croovies.md`
- The reviewer must not have touched the author's context; a different vendor's model, or a fresh session of the same one, both qualify ← same
- The reviewer raises findings only and never edits, commits, pushes, or resets ← same
- The review anchors to a commit: run `git rev-parse HEAD` and `git status` first, and tie every finding to that SHA ← same
- Findings pass through a file (or a PR comment) rather than a live channel ← same
- 67 of 83 reviewed tickets (≈4 in 5) ended in a real code change ← same
- Across the 122 resulting commits: correctness 34%, concurrency 22%, durability 19%, security 9%, test integrity 9%, other 7% ← same
- Roughly half of driven commits were "incident kind" — data corruption or secret leakage, not cosmetic ← same

## Boundaries

- The numbers are one practitioner's self-reported sample, using Codex as the reviewer against a Claude author. They are not a controlled comparison, and the 83-ticket base rate depends on that person's ticket size and domain.
- The post prescribes a *posture*, not a protocol: it explicitly says the wording of the brief does not matter. Triage rules, severity vocabulary, stop conditions, and what to do with a rejected finding are all left open — this project fills those in via [[concepts/adversarial-review]].
- No claim is made about cost. "Costs nothing but tokens" is rhetorical; a second full-context pass per change is a real budget line, which is why this project gates it — see [[decisions/2026-07-31-adversarial-review-for-complex-work]].

## Updates to the wiki

- Pattern captured as [[concepts/adversarial-review]].
- Scope and gating decided in [[decisions/2026-07-31-adversarial-review-for-complex-work]].
- Implemented as the `adversary` agent, the `adversarial-review` skill, and `/project:adversary`; wired into `/project:work` step 7a.
