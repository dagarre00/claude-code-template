---
aliases: [Adversary gating decision]
type: decision
domains: [agents, software]
status: accepted
sources:
  - docs/raw/research/adversarial-review-croovies.md
supersedes: []
superseded_by: []
contradicts: []
open_questions: []
created: 2026-07-31
updated: 2026-07-31
---

# Gate adversarial review on complex and batched work, run it on a fresh Opus agent

> [!abstract] Essence
> `/project:work` dispatches a read-only `adversary` agent (Opus, fresh context) over the diff before the bundled commit — but only for `[complex]` or batched cycles, the same trigger that already dispatches the `planner`. Simple single todos are covered on demand via `/project:adversary`.

## Status

Accepted as of 2026-07-31.

## Context

[[concepts/adversarial-review]] reports four out of five agent-written changes containing a real defect the author missed, half of them the incident kind. This project had no per-change check: the `developer` verified its own work, and the only second reader was `/project:review` — whole-repo, periodic, and explicitly barred from the work loop by behavioral rule 12, which called reviewer-in-`/project:work` "the cardinal violation".

Two forces pull against each other. Running a second full pass on every cycle is the strongest defect posture and matches the source's thesis, but it doubles the agent cost of trivial one-line todos and slows the loop the template is built around. Running it only on request preserves cost but depends on the human remembering — which is the exact failure the source describes.

The rule-12 prohibition also needed resolving rather than ignoring: it was written against the *periodic whole-repo auditor*, and its reasoning (a developer must not audit its own work, an auditor must not carry developer context) argues **for** a context-free adversary, not against one.

## Decision

We will gate the adversarial pass on the `[complex]` tag or a 2+ todo batch — the trigger that already marks a cycle as risky enough to plan — and run it as a distinct `adversary` agent on Opus with a fresh context, while the `developer` runs Sonnet. Behavioral rule 12 is **amended** to define both review roles in one place rather than to forbid review in the loop: the periodic `reviewer` still never runs there, the per-change `adversary` does, and both are read-only and context-free. New rule 20 adds the requirement that every finding gets an explicit written disposition.

## Consequences

- **Positive:** the highest-risk cycles get a second reader automatically, with no reliance on human memory. The reviewer is both a different model tier and a different context, satisfying the source's independence requirement with no external dependency.
- **Positive:** rule 12's intent is preserved and sharpened rather than diluted — a developer still never audits its own work, the periodic `reviewer` stays out of the loop, and the read-only invariant now binds both roles explicitly. An agent reading rule 12 alone gets the whole boundary, with no second rule to cross-reference.
- **Negative:** simple single todos ship unreviewed by default. The 4-in-5 defect rate presumably applies to them too, just over smaller diffs; `/project:adversary` exists to close that gap manually.
- **Negative:** an Opus pass per complex cycle is a real cost line, and the two-round cap means some disagreements land on the human instead of resolving themselves.
- **Follow-ups:** none blocking. If the gate proves too narrow in practice, supersede this ADR rather than quietly widening the trigger.

## Alternatives considered

- **Mandatory on every cycle:** rejected for cost and loop latency on trivial todos. Closest to the source's thesis, and the natural supersede target if the gate turns out to be too narrow.
- **Opt-in command only, work loop untouched:** rejected — it leaves the discipline to human memory, which is the failure mode the source is written about. Kept as the *additional* manual path, not the only one.
- **Reuse the existing `reviewer` agent with a diff scope:** rejected. Its invariants are whole-repo, worktree-isolated, and it writes a tracked ADR report; overloading it would blur two genuinely different scopes and break rule 12's separation.
- **Shell out to an external CLI (Codex or similar) as the source does:** rejected for a template others clone — it adds an undeclared dependency. Cross-vendor independence is stronger, so the `adversarial-review` skill documents the swap for projects that want it.

## References

- Relates to: [[concepts/adversarial-review]], [[summaries/adversarial-review-croovies]]
- Implemented by: `.claude/agents/adversary.md`, `.claude/skills/adversarial-review/SKILL.md`, `.claude/commands/project/adversary.md`
