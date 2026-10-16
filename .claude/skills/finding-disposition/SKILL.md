---
name: finding-disposition
description: Conductor-only. How to run a review round and dispose of every finding — briefing plan-adversary and adversary, Applied/Escalated/Rejected for brief findings, Filed/Fixed/Rejected for diff findings, the critical/major human gate, the round commit, P0 saturation, re-review, the round cap, and the yield record.
user-invocable: false
---

# Finding Disposition

Reviewers use `plan-review` and `adversarial-review`; they receive nothing from this file. Every dispatch runs through `subagent-dispatch`.

**Every finding gets one written disposition, and the record is committed.** Silence is not a disposition; "unlikely" is not a reason. Rejecting via an unwritten invariant requires writing that invariant into the entity page or `gotchas.md` as part of the rejection.

## Read first

- `docs/wiki/gotchas.md` and the entity `## Behavior` cases the round covers.

## Brief round — before Red (`plan-adversary`)

1. **Subject (exactly one):** `.handoff/<slug>-plan.md` (`[complex]`/batched cycle) or the verbatim todo line plus `$ARGUMENTS` instruction (simple cycle).
2. **Send only:** subject, entity slug(s), case IDs, test command, and branch name — never your opinion or defense.
3. **Verify report:** If no findings and no `Checked:` line, re-dispatch once demanding it.
4. **Dispose (`Applied` is default):**

   | Disposition | When | Action |
   | --- | --- | --- |
   | **Applied** | Valid, and fixable via plan edit, sharper brief, or added case ID | On a planned cycle, edit `.handoff/<slug>-plan.md`. On a simple cycle, pass the refinement in the `developer`'s `Inputs:` brief (and if you update `docs/wiki/todos.md`, stage it with the step-6 commit). |
   | **Escalated** | The **spec** is wrong, ambiguous, or missing | `human-checkpoint` recommending `/project:interview`. Stop the cycle. |
   | **Rejected** | Misreads the brief, or outside this cycle's cases | One sentence. Out-of-scope work worth doing becomes an ordinary todo line. |

   A contested `blocker` is a `human-checkpoint`, never a unilateral rejection. Optionally dispatch `triage` when a finding hinges on code you have not read.
5. **Re-plan** only for a structural blocker (wrong decomposition or impossible order), once, with findings attached. A second disagreement → `human-checkpoint`.
6. **Commit the record** in the cycle's `work` log entry (`docs/wiki/log.md`, plus `docs/wiki/todos.md` if edited) as `docs(<slug>): plan review` before dispatching `developer` (`/project:work` step 4a):

   ```markdown
   - Plan review: 3 findings — 2 applied, 1 rejected
     - P1 blocker spec-fidelity — Applied: B3 had no step; plan step 4 now covers it.
     - P3 note scope — Rejected: retry policy belongs to entity `billing`, not this cycle.
   ```

## Diff round — after the cases land (`adversary`)

1. **Scope small:** `<sha-before>..HEAD` covering the cycle's commits. If `git diff --stat <range>` is empty, skip and say so.
2. **Send only:** commit range, entity slug(s), case IDs, test command — plus previous round findings on re-review (step 9). Never send `.handoff/`, conductor reasoning, or intent prose.
3. **Check independence:** Flag any report citing `.handoff/` or `log.md`. `HEAD` and tracked files must be unchanged.
4. **Triage (optional):** Dispatch `triage` with the range, slug, case IDs, and verbatim findings. Never downgrade severity solely because a failure was not reproduced live.
5. **Dispose (`Filed` is default):**
   - **Filed:** Add a todo line (`docs/wiki/todos.md § Tags`, tagged `[adversary]`): `critical` → `## Now (P0 — next)`, `major` → `## Next (P1)`, `minor` → `## Later (P2)`. `nit` is never filed.
   - **Fixed:** Only a human-approved `critical`/`major`. Dispatch `developer` for a failing test + fix commit: `fix(<slug>): <what> — adversary F<n>` (include `Wiki-Update: none (adversary fix)` footer if the entity page needs no change).
   - **Rejected:** One sentence citing the invariant, misread, or scope boundary.
6. **Human gate:** Group all `critical` and `major` findings into **one** `human-checkpoint` (claim, failure scenario, files touched, recommendation). If declined or unreachable in `fast` mode → file at P0/P1 and highlight in the cycle report.
7. **Commit the round record** (stage `docs/wiki/todos.md` plus any gotcha/ADR from triage; do **not** stage `log.md` here — the cycle's `work` or standalone `adversary` log entry records the final tally once the review finishes):

   ```bash
   git add docs/wiki/todos.md   # plus any gotcha or ADR the triage produced
   git commit --allow-empty -m "$(cat <<'MSG'
   docs(<slug>): adversary round 1 — 3 findings, 1 fixed, 1 filed, 1 rejected, 2 nits

   F1 critical correctness — Fixed in a1b2c3d (human approved): empty token rejected before lookup.
   F2 major durability — Filed P1 (human declined immediate fix): unbounded retry on 5xx.
   F3 minor test-integrity — Rejected: covered by tests/integration/test_auth.py.
   Nits: 2 — not filed.
   MSG
   )"
   ```

   `--allow-empty` handles rounds where every finding was rejected or Fixed in its own commit. `git log --grep="adversary round"` is the audit trail.
8. **P0 saturation:** Count open P0 items (`docs/wiki/todos.md § P0 saturation threshold`). At or above `P0_MAX` → `human-checkpoint` with the count, `[adversary]` share, three oldest entries, and a recommendation.
9. **Re-review only if something was Fixed**, over the fix commits only, attaching prior findings and their disposition lines. Stop after **3 rounds** maximum: at round 3, gate/file any open `critical`/`major` items and list open `minor`/`nit` items in the round commit as unfiled (`reason: round cap`).

## Record the yield — every round

Record exact counts per severity and disposition in the round commit and the cycle's log entry (if run via `dispatch-handoff`, name the external harness and model so its counts are not attributed to the role's pinned model). When open `[adversary]` todos reach `FINDINGS_MAX` (`docs/wiki/todos.md § Filed-findings backlog`), note it in the cycle report.

## Anti-patterns

- **Leaking author context** into either reviewer's brief.
- **Fixing `minor` findings inline** or **fixing a `critical`/`major` without human approval**.
- **Filing brief findings for later** when you are about to implement their subject.
- **Re-reviewing the whole diff** or opening a fourth round.
