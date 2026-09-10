# Workflow review follow-up — 2026-09-10

This appends to the [workflow resume report](2026-09-10-workflow-resume-report.md), which was committed before the independent review completed. The source report is unchanged.

## Review outcome

The workflow MCP created `pdf-install-rollback-review` at `6d5b819` and composed a read-only Claude `claude-opus-5`, high-effort adversary over `b797c08..ff67506`. The adversary checked all six prescribed categories, ran the focused installer suite (16 passed in 0.26 seconds), and returned one major and four minor findings, no criticals, and two unfiled nits. Its checkout stayed clean.

- F1, major/durability: a second failure while restoring the backup is swallowed; the addon is absent from its original location and the caller is not told the retained backup path or restore cause. The double-failure Windows scenario is plausible but was not live-reproduced. Pending the human's fix-now-or-queue decision; the review round is not closed.
- F2, minor/durability: backup cleanup failures silently leave stale addon trees. Filed on this verified mechanism only; possible duplicate loading by FreeCAD is unverified.
- F3, minor/test-integrity: the staged entry-point guard lacks a test. Filed for coverage; the reviewer's stronger claim that it is unreachable was not adopted. A guard after copying should remain defense in depth.
- F4, minor/concurrency: an interleaving can skip restore when another installation occupies the target, leaving an unreported backup. Filed; no sequential-use invariant was invented to reject it.
- F5, minor/correctness: removing the temporary backup directory unreserves the name before the rename. Filed as a safe spurious-failure risk; high-entropy naming alone does not establish that the window cannot occur.

The developer supplied technical triage through a fourth MCP dispatch, `pdf-install-rollback-triage`, in the existing worker checkout. It read the relevant files and changed nothing. It agreed F1 concealed recovery information but proposed downgrading it because the double failure was not live-reproduced; the conductor retained the major grade for the demonstrated error-handling path. The developer also proposed rejecting F2/F4/F5; the conductor filed the contained mechanisms rather than treating best-effort cleanup, unspecified concurrency, or low likelihood as sufficient rejection reasons. No finding was fixed in this review.

## Additional workflow measurements

The triage dispatch reported prompt size 26,475, duration 14.61 seconds, 56,673 total tokens and 176,877 cache-read tokens. Including the three implementation/verification runs in the first report, agy reported **441,623 total tokens** and **3,325,217 cache-read tokens**. These are CLI counters, not monetary costs; they still exclude the conductor and Claude adversary. The Claude plain-text result did not expose comparable usage counters.

Additional optimization: a judgement-only triage should receive minimal role instructions and findings, and should not need the full TDD procedure and write access. That is a proposed toolkit change, not permission to merge reviewer and developer roles or to skip written dispositions. Preserve independent review and conductor-owned severity decisions; do not accept an author's severity downgrade solely because a modeled failure has not been observed live.

## Checkpoint and next action

B22 code and tests are pushed; 320 tests passed independently. The newly discovered double-failure diagnostic gap remains. The recommended fix is a narrowly scoped regression test that makes both replacement and restore fail, then error reporting that names the retained backup path and preserves both causes. The user must choose whether to fix now or queue it under the repository's adversarial-review gate. The remaining PDF Cycle 1 packaging/resource cases have not started in this resumed session.

The workflow recommendations remain: first add reliable result validation and a structured Windows launcher, then bounded resume/status records and smaller retry/triage prompts. This session made no workflow implementation, model-default or user-permission-setting changes.
