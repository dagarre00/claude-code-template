---
name: adversarial-review
description: Subagent-side, preloaded into the adversary. How the read-only adversary reviews a diff — category sweep, severity vocabulary, reporting floor, and report format; the conductor's side is finding-disposition.
user-invocable: false
---

# Adversarial Review — the sweep

Review the commit range named in your brief against the wiki. Raise findings; never fix them.

## The category sweep

Sweep all 8 categories in order at full depth:

| # | Category | Look for |
| - | --- | --- |
| 1 | **correctness** | Wrong branch, off-by-one, silent `None`/nil, swallowed exception, error path returning success, Behavior case not actually implemented |
| 2 | **concurrency** | Shared mutable state, non-atomic read-modify-write, check-then-act, unawaited work, lock ordering, assumed single-threading |
| 3 | **durability** | Partial write with no rollback, lost update, unbounded retry, non-idempotent handler, migration with no down path, unvalidated write |
| 4 | **security** | Unvalidated input crossing a trust boundary, injection (SQL/shell/template), secret in code or log, missing authz, unsafe deserialization |
| 5 | **architecture** | Import the `architecture.md § Layers` table forbids; business rules in controller/handler/repository; concrete dependency built outside composition root; change to architecture rules or check |
| 6 | **test-integrity** | Test asserting nothing, tautology, mock hiding the real boundary, test passing without the implementation, `[x]` case lacking a test |
| 7 | **complexity** | Code not forced by the cases: dead code, single-implementation abstraction (except required ports), hand-rolled stdlib/platform feature, replaceable dependency, duplicate helper, `shortcut:` without revisit trigger. Prefix claim with `delete:`, `stdlib:`, `native:`, `yagni:`, or `shrink:` and name the replacement |
| 8 | **other** | Stale wiki claim in the diff, misleading name, comment contradicting code |

Verify before asserting (read the test; grep for callers). Unverified findings are `confidence: low` or dropped. Score against the spec and declared layers, never personal taste.

## Severity (closed) and the reporting floor

| Severity | Meaning | Write-up |
| --- | --- | --- |
| `critical` | Data corruption, secret exposure, or wrong result on a normal path | Full, with concrete failure scenario |
| `major` | Wrong result on an edge path; test not testing its Behavior; layer violation | Full, with concrete failure scenario |
| `minor` | Real but contained — poor error message, narrow missing validation | One line: claim and `path:line` |
| `nit` | Style, naming, comment | Not itemised — one tally line |

- The floor governs **write-up, never depth of sweep**.
- Unsure between `critical` and `major` → `major` (explain why it might be higher). Unsure if `nit` → `minor`.
- `complexity` findings are `minor` at most (unless they also cause a wrong result, which is `correctness`).

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

Nothing above `nit` → state that explicitly with the `Checked:` lines. Name any implied gotcha or ADR inside the finding.

**Re-review round:** Given only the fix commit range and prior findings + dispositions, confirm each fix, accept or contest each rejection once, and stop — do not re-scan the original diff or open new lines of attack from round one.
