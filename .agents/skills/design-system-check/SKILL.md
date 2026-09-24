---
name: design-system-check
description: How to make a UI change against docs/wiki/design-system.md — read the token roles first, reference roles instead of raw values, and verify the page's assertions before the case is done. Given to the developer by /project:init on projects with a UI surface, through roles.developer.extraSkills in .agents/config.json. Trigger on "UI change", "component", "styling", "CSS", "add a button", "design system", "design tokens", "colour", "typography", "spacing", "contrast", "accessibility", "dark mode", "responsive".
type: skill
---

# Checking a UI Change Against the Design System

`docs/wiki/design-system.md` **asserts**; the project's token file **holds the values**. That split survives only if every UI change verifies it. This is the project-level procedure above any stack — framework specifics belong in their own skill once the stack is real.

## Precondition

A change to visual output with no `docs/wiki/design-system.md` → stop and report: either this is not a UI project (reread the task) or the page has to exist before any UI is built. Never invent tokens to get unblocked — an unanswerable value is an `open_questions` entry or a question for the human.

## Procedure

1. **Read before writing:** **Design intention** — the tiebreaker for every subjective call, even on a change that looks mechanical — **Token binding**, the token section you will touch, **State & feedback patterns** and the **Accessibility contract**. Then the **Component inventory**: a listed component means extending it (open its entity page); an unlisted one is specced as an entity with Behavior cases *first* — building past the inventory is how a codebase ends up with four buttons.

2. **Reference roles, never values.** Write `accent`, not its hex. Every raw value you write is one of:
   - a token reference you forgot → use it;
   - a **missing token** → add the role, with its purpose, to `design-system.md` *and* the value to the token file, in the same change;
   - a deliberate one-off → listed under the page's `## Boundaries` with its reason. No reason, not deliberate.

3. **Sweep what you changed.** Search the files you touched this case for raw values — `#[0-9a-fA-F]{3,8}\b|rgba?\(|[0-9]+px|[0-9]+ms` — and classify each hit under step 2. It over-reports by design (`1px` borders, media queries, third-party overrides); a clean result on a change that altered visual output means you searched the wrong files. Then, only for what the change touched:
   - **a colour pairing** → measure the contrast ratio and fill the `Measured` column. Never estimate it: a guessed ratio launders a guess into a spec later work trusts — leave it `<TBD>` instead;
   - **an interactive element** → visible focus, hit target at least the stated minimum, reachable and operable by keyboard;
   - **an animation** → `prefers-reduced-motion` behaves as the page states;
   - **a new state** (loading, empty, error, success, disabled) → the canonical treatment, not a second one.

4. **Update the page in the same change:** the component's inventory row and status, any new role, step or breakpoint, the measured ratios, and `updated`. A token added to code without the page is drift nothing will catch later.
