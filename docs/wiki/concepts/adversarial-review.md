---
aliases: [Adversarial review, Second-model review, Red-team review]
type: concept
abstraction: pattern
domains: [agents, software]
status: developing
sources:
  - docs/raw/research/adversarial-review-croovies.md
implements: []
specializes: []
contrasts_with: []
alternative_to: []
depends_on: []
contradicts: []
open_questions:
  - Should a rejected finding that recurs across cycles auto-escalate to a human checkpoint?
created: 2026-07-31
updated: 2026-07-31
---

# Adversarial review

> [!abstract] Essence
> A second agent, holding none of the author's context, reads the change's diff and hunts for what is wrong. It is strictly read-only: it raises findings, never edits. The author triages every finding, acts or refuses in writing, and the reviewer reads the result once more before the work is called done.

## Model

The author of a change is the worst reader of it. A `developer` that wrote both the test and the implementation has already convinced itself the two agree — the gap it cannot see is exactly the gap review exists to find. Freshness is therefore the active ingredient, not intelligence: a reviewer that inherited the author's reasoning inherits its blind spot along with it.

Three properties make the pattern work, and dropping any one collapses it:

1. **Context-free.** The reviewer reads the wiki and the diff, never the author's transcript, plan, or justifications. In this project that means a separate agent on a different model tier ([[decisions/2026-07-31-adversarial-review-for-complex-work]]).
2. **Read-only.** Findings are the entire output. A reviewer that can edit starts fixing what it finds, and the author loses both the decision and the record of it.
3. **Adversarial framing.** The brief is "find what is wrong", not "check this over". A reviewer asked to approve will approve.

This is distinct from the periodic `reviewer` audit. Adversarial review is **diff-scoped and per-change**, catching defects before they are committed; `/project:review` is **whole-repo and periodic**, catching drift between the wiki and code that has already shipped. Neither substitutes for the other, and both are read-only for the same reason.

## Detail

**The mailbox.** Findings travel as a file, not as conversation. The reviewer writes `.claude/handoff/<slug>-findings.md` (gitignored scratch); the author reads it, annotates each finding with its disposition, and the reviewer re-reads the file plus the new diff. A file makes the review durable across a context recycle and makes "which findings were ignored" answerable after the fact.

**Anchoring.** Every finding cites the commit it was made against (`git rev-parse HEAD`) plus `path:line`. Without an anchor, a finding raised against a since-changed tree is unfalsifiable.

**The six categories.** The source data ranks what these reviews actually catch, and the sweep is ordered accordingly rather than left to whatever the reviewer notices first:

| Category                | Share of driven commits | Notes                                                    |
| ----------------------- | ----------------------- | -------------------------------------------------------- |
| Correctness / logic     | 34%                     | Wrong result, missed branch, off-by-one, bad error path   |
| Concurrency / races     | 22%                     | Interleaving, shared mutable state, non-atomic read-modify-write |
| Durability / data       | 19%                     | Partial writes, lost updates, unsafe migrations, no rollback |
| Security / injection    | 9%                      | Unvalidated input, injection, leaked secrets, authz holes |
| Test integrity          | 9%                      | Tests asserting nothing, over-mocked boundaries, tautologies |
| Other                   | 7%                      | Dead code, stale docs                                     |

Correctness is the largest single bucket, but concurrency + durability + security together are half of all fixes — the ones that corrupt data or leak a secret rather than misalign a button. A sweep that stops at "does the logic look right" misses the half that causes incidents.

**Triage is the author's.** Each finding ends as **Fixed**, **Rejected** (with a stated reason), or **Deferred** (with a todo filed). Silence is not a disposition — see behavioral rule 20.

**Bounded rounds.** Two adversary rounds maximum. If findings of the same severity survive the second, the disagreement is real and goes to a `human-checkpoint` rather than a third lap.

## Boundaries

- **Not a substitute for Red.** The adversary runs after Green. It never replaces writing the failing test first (behavioral rule 2) and it never authorizes skipping the periodic audit.
- **Not free.** A second full pass per change is a real cost, which is why this project gates it on `[complex]`/batched cycles instead of running it every time.
- **A read-only reviewer can still be wrong.** Findings are hypotheses, not verdicts. An unverifiable finding ("this might race") without a concrete failure scenario is noise, and the author is entitled to reject it in writing.
- **Freshness decays.** If the adversary is re-dispatched enough times within one cycle it accumulates the author's framing anyway, which is a second reason for the two-round cap.

## Provenance

- Pattern, read-only constraint, mailbox-as-file, and the anchoring brief ← `docs/raw/research/adversarial-review-croovies.md` (digested in [[summaries/adversarial-review-croovies]]).
- Category shares and the 4-in-5 hit rate ← same, self-reported over 83 tickets / 122 commits.
- Gating to `[complex]`/batched work, the Opus-vs-Sonnet split, the severity vocabulary, and the two-round cap are this project's additions ← [[decisions/2026-07-31-adversarial-review-for-complex-work]].
