---
name: adversarial-review
description: Worker-side. How the read-only adversary reviews a diff — the category sweep, severity vocabulary, reporting floor and report format; the conductor's side is finding-disposition. Trigger on "adversarial review", "review the diff", "red team the change", "second model".
type: skill
---

# Adversarial Review — the sweep

You review a small diff — usually one Behavior case — that is embedded in your prompt, against the wiki. You raise findings; you never fix them.

## The category sweep

Work them in order, at full depth. Correctness is where most findings are; concurrency, durability and security are where the incidents are.

| # | Category | Look for |
| - | --- | --- |
| 1 | **correctness** | Wrong branch, off-by-one, silent `None`/nil, swallowed exception, an error path that returns success, a Behavior case not actually implemented |
| 2 | **concurrency** | Shared mutable state, non-atomic read-modify-write, check-then-act, unawaited work, lock ordering, assumed single-threading |
| 3 | **durability** | Partial write with no rollback, lost update, unbounded retry, non-idempotent handler, migration with no down path, data written before it is validated |
| 4 | **security** | Unvalidated input crossing a trust boundary, injection (SQL/shell/template), a secret in code or log, missing authz on a new path, unsafe deserialization |
| 5 | **architecture** | An import pointing outward across `architecture.md § Layers` (domain or application reaching an adapter, infrastructure, or a framework type); business rules in a controller, handler or repository; a concrete dependency constructed outside the composition root; a change to the architecture rules or their check |
| 6 | **test-integrity** | A test asserting nothing, a tautology, a mock so wide the real boundary is untested, a test that would pass without the implementation, a `[x]` case with no test |
| 7 | **other** | Dead code, a stale wiki claim in the same diff, a misleading name, a comment contradicting the code |

Verify before asserting: read the test before claiming it asserts nothing; grep for callers before claiming a path is unreachable. An unverified finding is `confidence: low` or dropped. Score against the spec and the declared layers, never against taste.

## Severity (closed) and the reporting floor

Severity has procedural consequences — `critical`/`major` interrupt the human — so grade accurately.

| Severity | Meaning | Write-up |
| --- | --- | --- |
| `critical` | Data corruption, secret exposure, or wrong result on a normal path | Full, with a concrete failure scenario |
| `major` | Wrong result on an edge path; a test that does not test its Behavior; a dependency that breaks the layer rule | Full, with a concrete failure scenario |
| `minor` | Real but contained — poor error message, narrow missing validation | One line: claim and location |
| `nit` | Style, naming, comment | Not itemised — one tally line |

- The floor governs **write-up, never depth of sweep**. A `critical` in a category you skipped is a failed review.
- Unsure between `critical` and `major` → `major`, saying why it might be higher. Unsure whether something is a `nit` → it is a `minor`.
- Don't pad the count; two honest findings beat twelve.

## Report format

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

## F2 — minor — security — <claim> — `path:line`

Nits: 3 (naming ×2, stale comment ×1)

## Out of scope

- <pre-existing problems outside the diff>
```

Nothing above `nit` → say so explicitly, with the `Checked:` lines. A gotcha or ADR a finding implies is named inside that finding.

**Re-review round:** you are given the range of the fix commits only. Confirm each fix, accept or contest each rejection once, and stop — no re-scan of the original diff, no new lines of attack that were open in round one.
