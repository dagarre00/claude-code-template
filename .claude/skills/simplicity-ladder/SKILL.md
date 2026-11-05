---
name: simplicity-ladder
description: Subagent-side, preloaded into the developer. How to pick the smallest correct implementation at Green — trace the flow first, climb the ladder (needed at all, already in repo, stdlib, platform, installed dependency, one line, minimum code), fix bugs at the shared root, and mark deliberate shortcuts.
user-invocable: false
---

# Simplicity Ladder

Runs at Green (`tdd-loop § Green`, step 1) before writing production code, and before adding any file, helper, abstraction, or dependency.

## Read first

- Every file the case touches and every caller of modified functions (trace the flow end to end).
- `architecture.md § Layers`, `§ Conventions`, and the dependency manifest.

## Steps

1. Climb and stop at the first rung that holds:
   1. **Does the test force it?** Skip anything the case does not ask for and list it under `skipped:`.
   2. **Already in this codebase?** Grep for existing helpers, types, or patterns and reuse them.
   3. **Standard library?** Use it.
   4. **Platform feature?** (`<input type="date">`, CSS, DB constraint, etc.) Use it.
   5. **Already-installed dependency?** Use it.
   6. **One line?** Write one line.
   7. **Only then** write the minimum code that passes the test.
2. **New dependency = last resort:** Never add one for what a few lines do. If added, state in the report why rungs 2–5 fell short.
3. **Bug fix = root cause:** Grep all callers before editing; fix the shared function rather than patching one caller.
4. **Mark deliberate shortcuts** that have a known ceiling (`O(n²)` scan, coarse lock, naive heuristic) with a code comment `shortcut: <ceiling>; revisit when <trigger>` and report it. Shortcuts without a trigger are forbidden.
5. Report skipped items as one line each: `skipped: <X> — add when <Y>`.

## Never simplify away

Trust-boundary input validation, data-loss error handling, security, accessibility, Behavior cases, required `§ Layers` ports (rule 23), or the failing test first (rule 2).

## Anti-patterns

- Single-implementation interfaces (ports excepted), single-product factories, unrequested config/scaffolding.
- Duplicating an existing helper.
- Defending simplifications with long prose (one `skipped:` line suffices).
