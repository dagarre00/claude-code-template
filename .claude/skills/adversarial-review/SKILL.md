---
name: adversarial-review
description: How to run and answer an adversarial diff review in this project — dispatching the read-only adversary, the mailbox file format, the six-category sweep, severity vocabulary, and the triage protocol for each finding. Use when finishing a [complex] or batched cycle, or whenever a change needs a second set of eyes before commit. Trigger on "adversarial review", "second model", "review the diff", "findings", "mailbox", "triage findings", "red team the change", "before I call it done".
type: skill
---

# Adversarial Review — Dispatch, Mailbox, Triage

Runs after Green, before the bundled commit. A read-only `adversary` (Opus, fresh context) reads the diff and writes numbered findings to a mailbox file; the author triages every one in writing; the adversary re-reads once. The pattern and its rationale live in `docs/wiki/concepts/adversarial-review.md` — this is the procedure.

## Read first

- `docs/wiki/concepts/adversarial-review.md` — why the three constraints (context-free, read-only, adversarial framing) are load-bearing.
- `docs/wiki/gotchas.md` — the adversary reads this too; know what it will hold you to.
- The entity `## Behavior` cases for the diff — findings are scored against the spec, not against taste.

## When it fires

- **Automatically:** `/project:work` step 7a, when the todo is tagged `[complex]` or 2+ todos are batched — the same trigger that dispatched the `planner`.
- **On demand:** `/project:adversary`, for any branch or dirty tree.
- **Never:** as a substitute for Red (behavioral rule 2) or for the periodic `/project:review`.

## Steps

1. **Confirm there is a diff to review.** `git status --porcelain` non-empty, or a base ref to diff against. Nothing to review → skip and say so; do not dispatch on a clean tree.

2. **Pick the mailbox path.** `.claude/handoff/<slug>-findings.md`, matching the entity slug. Gitignored scratch — same lifecycle as the plan file. `mkdir -p .claude/handoff` if needed.

3. **Dispatch the `adversary`** with *only*:
   - the diff scope (`git diff` + `git diff --staged`, or `git diff <base>...HEAD`),
   - the entity slug(s) and the Behavior case IDs this cycle covers,
   - the mailbox path to write,
   - the test command from `docs/wiki/commands.md`.

   **Do not pass** the plan file, your reasoning, the developer's transcript, or a summary of what the change "is supposed to do" beyond the Behavior case IDs. Every sentence of author framing you leak costs you the independence you are paying for.

4. **Read the mailbox.** If it is empty or the adversary reports no findings, it must still state what it checked — an unexplained pass is a failed review, so re-dispatch once with that instruction.

5. **Triage every finding** — see the protocol below. Annotate each one in the mailbox file with its disposition. Fixes are ordinary work: for a behavior change, the failing test comes first (rule 2), and a finding that contradicts the spec means fixing the entity Behavior case before the code (rule 3).

6. **Re-dispatch the adversary once** with the new diff and the annotated mailbox. It confirms fixes, contests rejections once, and stops.

7. **Stop condition.** Two rounds maximum. If `critical` or `major` findings survive round two, do not open round three — run `human-checkpoint` with both positions stated.

8. **Clean up.** Delete the mailbox file after the cycle's commit, like the plan scratch. The record that survives is the commits the findings drove plus the `log.md` entry.

## Mailbox format

The adversary writes this; the author annotates the `**Disposition:**` line in place.

```markdown
# Findings — <slug>

**Commit:** <sha from git rev-parse HEAD>
**Scope:** <diff range or "uncommitted tree">
**Round:** 1
**Checked:** <one line per category swept, so a clean pass is reviewable>

## F1 — critical — correctness — <one-line claim>

**Where:** `path/to/file.py:42`
**What's wrong:** <2–3 sentences, mechanism not vibes>
**Failure scenario:** <concrete inputs/state/interleaving → wrong output or crash>
**Confidence:** high | medium | low
**Suggested follow-up:** <gotcha | ADR | todo | none>
**Disposition:** _(author fills: Fixed <sha//description> | Rejected — <reason> | Deferred — <todo filed>)_

## F2 — …

## Out of scope

- <pre-existing problems outside the diff — for /project:review, not this cycle>
```

## The six-category sweep

Work them in this order — it is ordered by what these reviews actually catch, and the second half is where the incidents live.

| # | Category           | Look for                                                                                  |
| - | ------------------ | ----------------------------------------------------------------------------------------- |
| 1 | **correctness**    | Wrong branch taken, off-by-one, silent `None`/nil, swallowed exception, error path that returns success, Behavior case not actually implemented |
| 2 | **concurrency**    | Shared mutable state, non-atomic read-modify-write, check-then-act, unawaited work, lock ordering, assumptions of single-threaded execution |
| 3 | **durability**     | Partial write with no rollback, lost update, unbounded retry, non-idempotent handler, migration with no down path, data written before it is validated |
| 4 | **security**       | Unvalidated input crossing a trust boundary, injection (SQL/shell/template), secret in code or log, authz check missing on a new path, unsafe deserialization |
| 5 | **test-integrity** | Test asserting nothing, tautological assertion, mock so wide the real boundary is untested, test that would pass without the implementation, missing case for a `[x]`-ticked Behavior |
| 6 | **other**          | Dead code, stale wiki claim in the same diff, misleading name, comment that contradicts the code |

## Severity vocabulary (closed)

| Severity   | Meaning                                                                 | Author's obligation                          |
| ---------- | ----------------------------------------------------------------------- | -------------------------------------------- |
| `critical` | Data corruption, secret exposure, or wrong result on a normal path      | Fix before commit, or `human-checkpoint`      |
| `major`    | Wrong result on an edge path, or a test that does not test its Behavior | Fix before commit, or Reject with a reason    |
| `minor`    | Real but contained — poor error message, narrow missing validation      | Fix or file a todo                            |
| `nit`      | Style, naming, comment                                                  | Optional; never blocks the commit             |

## Triage protocol

Every finding ends in exactly one disposition, written into the mailbox. Behavioral rule 20: silence is not a disposition.

- **Fixed** — name what changed. A behavior fix needs its failing test first.
- **Rejected** — state the reason in one sentence. Legitimate reasons: the scenario cannot occur given a documented invariant (cite it); the finding misreads the code (say what it missed); it is out of scope for this entity's Behavior cases. **Not** legitimate: "unlikely", "we can fix later" (that is Deferred), or silence. If the invariant you cite is not written down anywhere, it is not an invariant — write it into the entity page or `gotchas.md` as part of the rejection.
- **Deferred** — file a real line in `docs/wiki/todos.md` with a priority and reference the finding. A Deferred `critical` is not allowed; escalate instead.

## Wiki update

- Fixes ship in the cycle's normal bundled commit — code + wiki together, no separate review commit.
- A finding that revealed a project-specific trap → `gotcha-recording`, inline, same commit.
- A finding whose rejection encodes a design stance → `decision-recording`, inline, same commit.
- Findings deferred → `docs/wiki/todos.md`.
- `/project:work` records the round in `log.md` (`Adversary: N findings — F fixed, R rejected, D deferred`). Do not write a separate review report; that is `/project:review`'s artifact, not this one's.

## Swapping in an external reviewer

Cross-vendor independence is stronger than a second context on the same family. To use an external agent CLI (Codex or similar) as the adversary, keep the mailbox contract identical and replace step 3 with a non-interactive invocation of that CLI in the repo root, briefed with the agent's own prompt plus: *"You are read-only: review and discuss only; do not edit files, commit, push, or reset the tree. Run `git rev-parse HEAD` and `git status` first and anchor every finding to that commit. Write findings as a numbered list to `<mailbox path>`."* Everything downstream — triage, re-review, stop condition — is unchanged. This project does not ship that dependency; see `docs/wiki/decisions/2026-07-31-adversarial-review-for-complex-work.md`.

## Anti-patterns

- **Leaking author context into the dispatch.** Pasting the plan or "here's what I was going for" turns the adversary into a rubber stamp. The Behavior case IDs are the whole brief.
- **Letting the adversary fix things.** It raises, you decide. A reviewer that edits erases both the decision and the record of it.
- **Absorbing findings silently.** Fixing three and ignoring two without a written reason is how a review becomes theatre.
- **Round three.** Two rounds, then the human. A third lap is two agents negotiating, not reviewing.
- **Treating findings as verdicts.** They are hypotheses with a failure scenario attached. Reject the unverified ones in writing and move on.
- **Running it instead of the periodic audit.** Diff-scoped review never sees drift in code it did not touch.
