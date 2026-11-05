---
name: design-system-check
description: How to make a UI change against docs/wiki/design-system.md — read token roles first, reference roles instead of raw values, and verify contrast/a11y/state assertions before completing the case. Preloaded into developer by /project:init on UI projects.
user-invocable: false
---

# Checking a UI Change Against the Design System

`docs/wiki/design-system.md` asserts roles and contracts; the project's token file holds raw values.

## Precondition

If a task changes visual output and `docs/wiki/design-system.md` does not exist, stop and report: either the task is not a UI change or `design-system.md` must be created first. Never invent tokens; record unknowns in `open_questions` or escalate.

## Procedure

1. **Read before writing:** `Design intention`, `Token binding`, relevant token sections, `State & feedback patterns`, `Accessibility contract`, and `Component inventory` (extend listed components via their entity page; spec unlisted ones with Behavior cases before building).
2. **Reference roles, never raw values** (write `accent`, not hex). Every raw value in touched files must be:
   - replaced with an existing token reference,
   - added as a new role in `design-system.md` **and** the token file in the same change, or
   - documented as a deliberate one-off under `design-system.md § Boundaries` with its reason.
3. **Sweep touched files** for raw values (`#[0-9a-fA-F]{3,8}\b|rgba?\(|[0-9]+px|[0-9]+ms`) and verify:
   - **Colour pairings:** measure actual contrast ratio and record in `Measured` (never guess; use `<TBD>` if unmeasurable).
   - **Interactive elements:** visible focus, minimum hit target met, keyboard operable.
   - **Animations:** respects `prefers-reduced-motion`.
   - **States** (loading, empty, error, success, disabled): uses canonical pattern.
4. **Update `docs/wiki/design-system.md` in the same change** (inventory status, new roles/steps/breakpoints, measured contrast ratios, `updated`).
