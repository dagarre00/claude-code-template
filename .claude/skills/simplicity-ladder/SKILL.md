---
name: simplicity-ladder
description: Subagent-side, preloaded into the developer. How to pick the smallest correct implementation at Green — trace the flow first, then climb the ladder (needed at all, already in the repo, stdlib, platform, installed dependency, one line, minimum code), fix bugs at the shared root, and mark deliberate shortcuts.
when_to_use: Trigger on "simplest solution", "minimal", "YAGNI", "over-engineering", "do we need this", "add a dependency", "new helper", "new abstraction", "bug fix", "shortcut".
user-invocable: false
---

# Simplicity Ladder

Runs at Green (`tdd-loop` § Green, step 1), after Red is confirmed and before any production code — and again before adding any file, helper, abstraction or dependency.

## Read first

- Every file the case touches, and every caller of each function you will change. Trace the real flow end to end: the ladder shortens the solution, never the reading. The smallest diff in the wrong place is a second bug.
- `architecture.md § Layers` and `§ Conventions`, and the project's dependency manifest.

## Steps

1. Climb, and stop at the first rung that holds:
   1. **Does the test force it?** Anything the case does not ask for is skipped and named in the report.
   2. **Already in this codebase?** Grep for the helper, type or pattern before writing one; reuse it.
   3. **Standard library?** Use it.
   4. **Platform feature?** `<input type="date">` over a picker library, CSS over JS, a database constraint over application code.
   5. **Already-installed dependency?** Use it.
   6. **One line?** One line.
   7. **Only then** the minimum code that makes the test pass.

   Two rungs work → take the higher one. Two stdlib options of the same size → the one that is correct on edge cases; less code, not a flimsier algorithm.
2. **A new dependency** is a last resort: never one for what a few lines do. If you add one, name it in your report with why rungs 2–5 fell short.
3. **Bug fix = root cause.** Grep every caller of the function before editing it. One guard in the shared function beats one per caller, and patching only the path the todo names leaves its siblings broken.
4. **Mark a deliberate shortcut** that has a known ceiling (a global lock, an O(n²) scan, a naive heuristic) with a comment in the language's syntax — `shortcut: <ceiling>; revisit when <trigger>` — and list it in your report. A shortcut with no trigger is not allowed.
5. Report what you skipped, one line each: `skipped: <X> — add when <Y>`.

## Never simplify away

Input validation at a trust boundary, error handling that prevents data loss, security, accessibility, and anything a Behavior case or the plan asks for. Nor the layer rule: a port `§ Layers` requires is not a speculative abstraction, even with one adapter (rule 23). Nor the test: rule 2 has no size floor, so a one-line implementation still has its failing test first.

## Anti-patterns

- An interface with one implementation (ports excepted), a factory with one product, config for a value that never changes, scaffolding "for later".
- Re-implementing a helper that already lives a few files over.
- Clever over boring; more files than the case needs.
- Prose in the report defending a simplification — one `skipped:` line is the whole explanation.
