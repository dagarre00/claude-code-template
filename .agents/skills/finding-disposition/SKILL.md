---
name: finding-disposition
description: Conductor-only. How to run a review round and dispose of every finding — what to send the plan-adversary and adversary (and never send), Applied/Escalated/Rejected for brief findings, Filed/Fixed/Rejected for diff findings, the critical/major human gate, the round commit, P0 saturation, re-review, the round cap, and recording counts for dispatch_stats. Trigger on "triage findings", "dispose of findings", "adversary round", "plan review round", "file the findings", "round commit".
type: skill
---

# Finding Disposition

The reviewers' own procedures are `plan-review` and `adversarial-review`; they receive nothing from this file. Every dispatch below runs through `worker-dispatch`.

**Every finding gets exactly one written disposition, and the record is committed.** Silence is not a disposition; "unlikely" is not a reason. Rejecting by citing an unwritten invariant → write the invariant into the entity page or `gotchas.md` as part of the rejection.

## Read first

- `docs/wiki/gotchas.md` and the entity `## Behavior` cases the round covers — findings are scored against them.

## Brief round — before Red (`plan-adversary`)

1. **Subject — exactly one.** The plan (`[complex]`/batched: pass `instructions_file: .handoff/<slug>-plan.md`) or the todo line verbatim plus the `$ARGUMENTS` instruction (simple cycle, inline in `instructions`).
2. **Send only** the subject, the entity slug(s), the case IDs, the test command, and the branch name. **Never** your opinion of the plan or a defence of the todo — pre-answering the objection gets you a rubber stamp.
3. **Read the report.** No findings and no `Checked:` line → re-dispatch once demanding it.
4. **Dispose — Applied is the default**, because no code exists yet to make fixing expensive:

   | Disposition | When | Action |
   | --- | --- | --- |
   | **Applied** | Right, and the fix is a plan edit, a sharper todo line, or an added case ID | Edit `.handoff/<slug>-plan.md` — the file the developer's dispatch sends — or the todo line. |
   | **Escalated** | The **spec** is wrong, ambiguous or missing | `human-checkpoint` recommending `/project:interview`. The cycle stops. |
   | **Rejected** | Misreads the brief, or outside this cycle's cases | One sentence. Worth-doing out-of-scope work becomes an ordinary todo line. |

   A `blocker` you disagree with is a `human-checkpoint`, never a rejection. When a finding turns on code you cannot settle by reading, dispatch `triage` with the brief and the findings verbatim; the disposition stays yours.
5. **Re-plan only for a structural blocker** (wrong decomposition, impossible order), once, with the findings attached. Everything smaller you apply. A second disagreement is a `human-checkpoint`.
6. **Record** in the cycle's `work` log entry — no commit exists yet to carry it:

   ```markdown
   - Plan review: 3 findings — 2 applied, 1 rejected
     - P1 blocker spec-fidelity — Applied: B3 had no step; plan step 4 now covers it.
     - P3 note scope — Rejected: the retry policy is entity `billing`, not this cycle.
   ```

## Diff round — after the cases land (`adversary`)

1. **Scope small.** A commit range covering one case or a few closely related ones (`<sha-before>..HEAD`). Nothing landed → skip and say so.
2. **Send only** `diff_range`, the entity slug(s), the case IDs, the test command. **Never** the plan file, your reasoning, or what the change "is supposed to do". Read the compose response first: an empty or truncated diff is reported there.
3. **Check independence.** `inspect_dispatch` warnings about reads outside the workspace or skills not sent mean the reviewer may have read author material — say so if you use the findings.
4. **Triage.** Optionally dispatch `triage` with the same `diff_range`, slug, case IDs and the findings verbatim. It recommends; you own severity and disposition. Never accept a severity downgrade on the sole ground that a failure was not reproduced live.
5. **Dispose — Filed is the default**, because fixing mid-cycle skips Red-first and reorders the queue:
   - **Filed** — a todo line at the severity's section: `critical` → `## Now (P0 — next)`, `major` → `## Next (P1)`, `minor` → `## Later (P2)`. Line format: `docs/wiki/todos.md § Tags` (`[adversary]`). `nit` is never filed.
   - **Fixed** — only a `critical`/`major` the human approved. Its own commit, failing test first, via a `developer` dispatch: `fix(<slug>): <what> — adversary F<n>`.
   - **Rejected** — one sentence citing the invariant, what the finding misread, or the scope boundary.
6. **The human gate.** Any `critical` or `major` → **one** `human-checkpoint` covering all of them: claim, failure scenario, what a fix touches, your recommendation. Declined or unreachable → Filed at P0/P1, said prominently in the cycle report. A human instruction such as "fix all the findings" is the approval at that scope.
7. **Commit the record.**

   ```bash
   git add docs/wiki/todos.md docs/wiki/log.md   # plus a gotcha or ADR the triage produced
   git commit -m "$(cat <<'MSG'
   docs(<slug>): adversary round 1 — 3 findings, 1 fixed, 1 filed, 1 rejected, 2 nits

   F1 critical correctness — Fixed in a1b2c3d (human approved): empty token rejected before lookup.
   F2 major durability — Filed P1 (human declined immediate fix): unbounded retry on 5xx.
   F3 minor test-integrity — Rejected: covered by tests/integration/test_auth.py.
   Nits: 2 — not filed.
   MSG
   )"
   ```

   `--allow-empty` when every finding was rejected. `git log --grep="adversary round"` is the audit.
8. **P0 saturation.** After staging todo lines, count open P0 items (`docs/wiki/todos.md § P0 saturation threshold`). At or above `P0_MAX` → `human-checkpoint` with the count, the `[adversary]` share, the three oldest entries, and a recommendation (drain P0, re-grade, or pause adversarial review).
9. **Re-review only if something was fixed**, with `diff_range` over the fix commits only. **Three rounds, then stop.** Findings still open at the cap: file the `critical`/`major` ones per step 5 (the human gate in step 6 still applies) and list the `minor`/`nit` ones in the round commit as unfiled, reason "round cap" — never open a fourth round. A unit still generating findings at round three was too big; split it before the *next* review.

## Record the yield — every round

Pass the counts to `record_decision` on the reviewer's dispatch, so `dispatch_stats` can say whether a review role earns its tokens:

```json
{ "findings": { "raised": { "blocker": 1, "risk": 1, "note": 2 },
                "dispositions": { "applied": 1, "rejected": 1 } },
  "reviewed_task_ids": ["<developer task ids the diff came from>"] }
```

Use `critical/major/minor/nit` and `filed/fixed/rejected` for a diff round. `reviewed_task_ids` attributes the findings to the author dispatches, which is what lets engines be compared on escaped defects rather than on acceptance alone.

## Anti-patterns

- **Leaking author context** into either dispatch.
- **Fixing findings because they are small.** A two-line `minor` is still filed.
- **Fixing a `critical` without asking**, or quietly filing one.
- **Filing as disposal.** Filed findings are consumed by the `/project:wiki` re-triage; when the open `[adversary]` count reaches `FINDINGS_MAX` (`docs/wiki/todos.md § Filed-findings backlog`), say so in the cycle report.
- **Filing brief findings for later.** You are about to implement their subject.
- **Re-reviewing the whole diff**, or opening a fourth round.
- **Letting the record evaporate** — counts in the log are an index, not dispositions.
