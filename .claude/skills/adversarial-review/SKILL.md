---
name: adversarial-review
description: How to run and answer an adversarial diff review in this project — dispatching the read-only adversary, the mailbox file format, the six-category sweep, severity vocabulary, and the triage protocol for each finding. Use when finishing a [complex] or batched cycle, or whenever a change needs a second set of eyes before commit. Trigger on "adversarial review", "second model", "review the diff", "findings", "mailbox", "triage findings", "red team the change", "before I call it done".
type: skill
---

# Adversarial Review — Dispatch, Mailbox, Triage

Runs over the commits just landed. A read-only `adversary` (Opus, fresh context) reads them and writes numbered findings to a scratch mailbox; the author triages every one and records the dispositions **in the commits that answer them**.

**A review files work, it does not do work.** The default disposition is a todo in `docs/wiki/todos.md` — findings are not fixed in the cycle that surfaced them. The one exception is a `critical` or `major`, which is put to the human via `human-checkpoint`: they decide whether it is fixed now or queued like the rest. This keeps a review from silently reordering the work queue, and keeps one review from becoming an open-ended fix-and-re-review loop.

**Review small.** The single biggest driver of a review that never converges is a review scope that is too large: a big diff yields many findings, the fixes enlarge the diff, and the next round finds more. Since the `developer` commits per Behavior case (`tdd-loop`), scope each review to one case or a few closely-related ones. If you are reaching round 3, the unit was too big — split it, don't keep reviewing it.

## Read first

- `docs/wiki/gotchas.md` — the adversary reads this too; know what it will hold you to.
- The entity `## Behavior` cases for the diff — findings are scored against the spec, not against taste.

## When it fires

- **Automatically:** `/project:work` step 7a, when the todo is tagged `[complex]` or 2+ todos are batched — the same trigger that dispatched the `planner`.
- **On demand:** `/project:adversary`, for any branch or dirty tree.
- **Never:** as a substitute for Red (behavioral rule 2) or for the periodic `/project:review`.

## Steps

1. **Fix the review scope, and keep it small.** The developer commits per case, so the scope is a commit range — typically `git diff <sha-before-the-cases>...HEAD`, covering one case or a few closely-related ones. Not the whole branch, and not the whole cycle if the cycle was large. Nothing landed → skip and say so.

2. **Pick the mailbox path.** `.claude/handoff/<slug>-findings.md`. Gitignored scratch, same lifecycle as the plan file — it is a working surface for one review, not a record. `mkdir -p .claude/handoff` if needed. Use exactly that name: the ignore glob matches only names ending in `-findings.md`, so a suffixed variant surfaces as untracked and fails the clean-tree gate at the end of the cycle.

3. **Dispatch the `adversary`** with *only*:
   - the commit range from step 1,
   - the entity slug(s) and the Behavior case IDs that range covers,
   - the mailbox path to write,
   - the test command from `docs/wiki/commands.md`.

   **Do not pass** the plan file, your reasoning, the developer's transcript, or a summary of what the change "is supposed to do" beyond the Behavior case IDs. Every sentence of author framing you leak costs you the independence you are paying for.

4. **Read the mailbox.** If it is empty or the adversary reports no findings, it must still state what it checked — an unexplained pass is a failed review, so re-dispatch once with that instruction.

5. **Triage every finding** — see the protocol below. Note each disposition in the mailbox as you work; it is your scratchpad for step 6. Default is **Filed as a todo**, not fixed. Sort the findings by severity first: if any is `critical` or `major`, run one `human-checkpoint` covering all of them and get an explicit answer before touching code. Everything `minor` and below goes straight to the queue.

6. **Commit the dispositions — this is the record** (behavioral rule 20). Any approved fix is its own commit; the todo lines and the round summary land together:

   ```bash
   git add <fixed-files>                                           # approved criticals/majors only
   git commit -m "fix(<slug>): reject empty token — adversary F1"
   git add docs/wiki/todos.md
   git commit -m "$(cat <<'MSG'
   docs(<slug>): adversary round 1 — 3 findings, 1 fixed, 1 filed, 1 rejected, 2 nits

   F1 critical correctness — Fixed in a1b2c3d (human approved): empty token now
      rejected before lookup.
   F2 major durability — Filed P1 (human declined immediate fix): retry loop is
      unbounded on a 5xx from the token service.
   F3 minor test-integrity — Rejected: the boundary is covered by the integration
      test in tests/integration/test_auth.py; narrowing the mock would duplicate it.
   Nits: 2 (naming ×1, stale comment ×1) — not filed.
   MSG
   )"
   ```

   Every finding gets a line, including the filed ones — the todo says *what* to do, the commit says *why it was not done now*. Use `--allow-empty` if the round produced neither a fix nor a todo (everything rejected); a round that changed nothing is precisely the one whose reasons must survive. `git log --grep="adversary round"` is how a later reader audits the review.

6a. **Check P0 saturation.** After staging the todo lines, count the open P0 items:

   ```bash
   awk '/^## Now \(P0/{f=1;next} /^## /{f=0} f && /^- \[ \]/' docs/wiki/todos.md | wc -l
   ```

   At or above `P0_MAX` (10 — defined in `docs/wiki/todos.md § P0 saturation threshold`), stop and run `human-checkpoint`. **The queue is the finding now, not any individual item.** Reviews are producing criticals faster than cycles retire them, and a real emergency is no longer distinguishable from the nine ahead of it.

   Bring to the checkpoint: the count and how much of it is `[adversary]`-filed versus human-filed, the oldest three entries with their age, and a recommendation. The realistic options are to drain P0 before more feature work, to re-grade entries that are not truly P0, or to pause adversarial review until the queue recovers. Do not pick for them, and do not let the count silently keep climbing.

7. **Re-dispatch only if something was fixed.** With findings filed rather than fixed, most rounds change no code and there is nothing to re-review — the review is done at step 6, and the queue owns the rest. If an approved fix did land, dispatch once over **the fix commits only** (`git diff <sha-before-fixes>...HEAD`), never the original range: re-reading the whole thing is what manufactures fresh findings each round. It confirms the fix, contests rejections once, and stops.

8. **Stop condition — two rounds, then resize.** If findings survive round two, do **not** open round three. The usual cause is that the reviewed unit was too big, so the remedy is to split it: pick the smallest coherent piece, review that alone, and repeat. A disagreement about a specific `critical`/`major` goes back to the same `human-checkpoint` that gated it — record the outcome as that finding's disposition.

9. **Clean up.** Delete `.claude/handoff/<slug>-findings.md` and any plan scratch. Both are gitignored and nothing needs saving from them — the dispositions are in the commits and the work is in `todos.md`.

## Mailbox format

Gitignored scratch, written by the adversary and deleted at step 9. It only has to survive long enough for you to triage from it, so keep it plain — the durable version of each finding is the one-line disposition you write into the commit.

```markdown
# Findings — <slug>

**Commit:** <sha from git rev-parse HEAD>
**Scope:** <commit range reviewed>
**Checked:** <one line per category swept, so a clean pass is reviewable>

## F1 — critical — correctness — <one-line claim>

**Where:** `path/to/file.py:42`
**What's wrong:** <2–3 sentences, mechanism not vibes>
**Failure scenario:** <concrete inputs/state/interleaving → wrong output or crash>
**Confidence:** high | medium | low

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

Severity now has **procedural consequences** — it decides whether the human is interrupted — so assign it accurately. Inflating a `minor` to `major` to force attention wastes the human's time; deflating a `critical` to avoid the interruption is the failure this gate exists to prevent.

| Severity   | Meaning                                                                 | What happens to it                                        |
| ---------- | ----------------------------------------------------------------------- | ---------------------------------------------------------- |
| `critical` | Data corruption, secret exposure, or wrong result on a normal path      | **Ask the human** to fix now (`human-checkpoint`); todo only if they decline |
| `major`    | Wrong result on an edge path, or a test that does not test its Behavior | **Ask the human** to fix now; todo only if they decline     |
| `minor`    | Real but contained — poor error message, narrow missing validation      | Todo — never fixed in this cycle. **One line, no failure scenario** |
| `nit`      | Style, naming, comment                                                  | **Not itemised** — tallied at the end of the mailbox, never filed |

### The reporting floor — write up what earns it

The adversary sweeps all six categories at full depth. What the floor governs is how much prose each finding gets back:

- **`critical`/`major`** — full write-up with a concrete failure scenario. A human is about to be interrupted to decide fix-now, and the scenario is what they decide on.
- **`minor`** — one line: the claim and where. No scenario, no reproduction, no patch.
- **`nit`** — not written up at all. One tallied line at the end of the mailbox (`Nits: 3 (naming ×2, stale comment ×1)`), and nothing filed.

This is a cost decision made on evidence, not a lowering of standards. Across projects on this template, roughly **one filed finding in seven** was ever acted on, and `minor`+`nit` were **144 of 146** open entries. Every one of those carried a full failure scenario written for a queue that reads them at most once. The sweep is the expensive part worth paying for; persuading nobody is not.

Two guards against this becoming a quality cut:

- **The floor is on reporting, never on looking.** A `critical` in a category you skipped is a review that failed. Depth of sweep is unchanged.
- **Doubt grades up, not down.** "If you are unsure between two grades, take the lower one" still holds *between `critical` and `major`*. But a finding you are unsure is a nit is a `minor` — the tally is only for things you are certain do not matter.

## Triage protocol

**The default disposition is Filed, not Fixed.** A review is a triage pass, not a work order: it tells you what is wrong, and the queue decides when that gets addressed. Fixing findings the moment they land is what turns one review into an open-ended fix-and-re-review loop, and it lets a reviewer silently reprioritise work you already scheduled.

Every finding ends in exactly one disposition, written into the commit that answers it. Behavioral rule 20: silence is not a disposition.

- **Filed** *(the default)* — append a line to `docs/wiki/todos.md` at the priority its severity maps to (below). Do not fix it now, regardless of how small it looks; a two-line fix is still a change nobody reviewed, made outside the Red-first loop.
- **Fixed** — only for a `critical` or `major` the human explicitly approved fixing now. Name what changed. A behavior fix still needs its failing test first (rule 2).
- **Rejected** — state the reason in one sentence. Legitimate: the scenario cannot occur given a documented invariant (cite it); the finding misreads the code (say what it missed); it is out of scope for this entity's Behavior cases. **Not** legitimate: "unlikely", "we can fix later" (that is Filed), or silence. If the invariant you cite is not written down anywhere, it is not an invariant — write it into the entity page or `gotchas.md` as part of the rejection.

### The approval gate — `critical` and `major` only

Do not fix a `critical` or `major` on your own initiative, and do not quietly file it either. Run `human-checkpoint` with: the finding's claim, its concrete failure scenario, what fixing it now would touch, and your recommendation. Then:

- **Approved** → fix it now, in its own commit, failing test first. Disposition: Fixed.
- **Declined, or you cannot reach the human** → Filed at P0 (`critical`) or P1 (`major`), and say so prominently in your report. A `critical` may be filed rather than fixed **only** on this path — an unapproved `critical` that quietly becomes a todo is the exact silence rule 20 forbids.

Batch the asks: one checkpoint listing every `critical`/`major` from the round, not one interruption per finding.

### Severity → priority

| Severity   | Section in `docs/wiki/todos.md` |
| ---------- | ------------------------------- |
| `critical` | `## Now (P0 — next)`            |
| `major`    | `## Next (P1)`                  |
| `minor`    | `## Later (P2)`                 |
| `nit`      | *not filed* — tallied in the round commit only |

Todo line format — one per finding, so the queue is traceable back to the review:

```markdown
- [ ] [adversary] <one-line claim> — <severity>/<category>, F<N> of <sha>, entity <slug>
```

## Wiki update

- Filed findings → `docs/wiki/todos.md`, one line each at the severity's priority. This is where most findings end.
- An approved fix is its own commit — code + wiki together, naming the finding it closes.
- A finding that revealed a project-specific trap → `gotcha-recording`, inline, same commit. Worth doing even when the finding itself is only Filed: the trap is real now, whenever the fix happens.
- A finding whose rejection encodes a design stance → `decision-recording`, inline, same commit.
- `/project:work` records the round in `log.md` as counts only (`Adversary: N findings — Fi filed, Fx fixed, R rejected`). The counts are an index; the dispositions themselves are in the commits, reachable with `git log --grep="adversary round"`. Do not write a separate review report; that is `/project:review`'s artifact, not this one's.

## Swapping in an external reviewer

Cross-vendor independence is stronger than a second context on the same family. To use an external agent CLI (Codex or similar) as the adversary, keep the mailbox contract identical and replace step 3 with a non-interactive invocation of that CLI in the repo root, briefed with the agent's own prompt plus: *"You are read-only: review and discuss only; do not edit files, commit, push, or reset the tree. Run `git rev-parse HEAD` and `git status` first and anchor every finding to that commit. Write findings as a numbered list to `<mailbox path>`."* Everything downstream — triage, re-review, stop condition — is unchanged. This project does not ship that dependency.

## Anti-patterns

- **Leaking author context into the dispatch.** Pasting the plan or "here's what I was going for" turns the adversary into a rubber stamp. The Behavior case IDs are the whole brief.
- **Letting the adversary fix things.** It raises, you decide. A reviewer that edits erases both the decision and the record of it.
- **Absorbing findings silently.** Filing three and ignoring two without a written reason is how a review becomes theatre.
- **Filing as if it were disposal.** Filed findings have exactly one consumer — `/project:wiki-lint`'s re-triage pass (behavioral rule 22) — and it only runs if someone runs it. When your filing pushes the open `[adversary]` count to `FINDINGS_MAX` (`docs/wiki/todos.md § Filed-findings backlog`), say so in the cycle report. A backlog that grows every round and drains never means the reviews are producing paperwork, not fixes.
- **Fixing findings because they are small.** A `minor` that takes two lines is still filed. "While I'm here" is how a review becomes an unplanned refactor, and it skips the Red-first loop.
- **Fixing a `critical` without asking.** The gate is not paperwork — it is the human's call whether the branch stops for this. Fix without approval and you have made a scheduling decision that was not yours.
- **Inflating severity to force a fix.** Severity drives the interruption, so grading a `minor` as `major` spends the human's attention on your preference.
- **Letting the record evaporate.** Deleting the mailbox before the dispositions are in commit messages leaves only a count in `log.md`. Counts are not dispositions: a rejection with no surviving reason is indistinguishable from silence a cycle later, which is exactly what rule 20 forbids.
- **Re-reviewing the whole diff each round.** The fixes made it bigger, so round 2 finds new surface and you never converge. Round 2 reads the fixes only.
- **Treating round 3 as the next step.** Findings surviving two rounds mean the unit is too big. Split it and review the pieces; a third lap on the same oversized diff produces a fourth.
- **Round three.** Two rounds, then the human. A third lap is two agents negotiating, not reviewing.
- **Treating findings as verdicts.** They are hypotheses with a failure scenario attached. Reject the unverified ones in writing and move on.
- **Running it instead of the periodic audit.** Diff-scoped review never sees drift in code it did not touch.
