---
name: design-system-check
description: How to make a UI change in this project against docs/wiki/design-system.md — read the token roles before writing, reference roles instead of raw values, and verify the page's assertions before commit. Use for any change that touches visual output. Trigger on "UI change", "component", "styling", "CSS", "add a button", "design system", "design tokens", "colour", "typography", "spacing", "contrast", "accessibility", "dark mode", "responsive".
type: skill
---

# Checking a UI Change Against the Design System

`docs/wiki/design-system.md` **asserts**; the project's token file **holds the values**. That split only survives if every UI commit verifies it — otherwise the page becomes decoration within a few cycles. This skill is that verification.

Not a stack skill. It says nothing about React, Tailwind, or SwiftUI — those belong in a `frontend-impl` skill that `/project:agent-scout` recommends once the stack is real. This is the project-level procedure that sits above whatever the stack is.

## Precondition

If the change touches visual output and `docs/wiki/design-system.md` does **not** exist, stop. Either the project has no UI surface (then this is not a UI change — reread the task) or the page was never created. Create it from the template in the `wiki-update` skill before writing code; a UI built before its token roles exist is what the page prevents. Do not invent tokens to get unblocked — an unanswerable value is an `open_questions` entry or a `human-checkpoint`.

## Procedure

### 1. Read before writing

From `design-system.md`, read: **Design intention** (it is the tiebreaker for every subjective call — read it even when you think the change is mechanical), **Token binding** (where values live), the token section you are about to touch, **State & feedback patterns**, and the **Accessibility contract**.

Then check the **Component inventory**. If the thing you are building is already listed, you are extending it — open its entity page. If it is absent, spec it as an entity with Behavior cases *first* (`spec-writing`); the inventory is a manifest of what exists, and building past it is how a codebase ends up with four buttons.

### 2. Reference roles, never values

Write `accent`, not the hex it resolves to. Every raw value in a diff is one of three things:

- A token reference you forgot to use → fix it.
- A **missing token** → add the role to `design-system.md` *and* the value to the token file, in the same commit (rule 1). A new role needs a stated purpose in the role table, not just a name.
- A deliberate one-off → it goes in the page's `## Boundaries` with a reason. If you cannot write the reason, it is not deliberate.

### 3. Verify before commit

Run the raw-value sweep over the staged diff:

```bash
git diff --cached -U0 -- '*.css' '*.scss' '*.ts' '*.tsx' '*.js' '*.jsx' '*.vue' '*.svelte' \
  | grep '^+' | grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(|[0-9]+px|[0-9]+ms'
```

This **over-reports by design** — `1px` borders, media-query widths, and third-party overrides all hit. It is a prompt to classify each line under step 2, not a gate that should come back empty. A clean result on a diff that changed visual output means the sweep missed the file type; widen the globs.

Then, only for what the change actually touched:

- **Colour pairing changed** → measure the contrast ratio and update the `Measured` column. Measure it; do not estimate it. An estimated ratio is worse than an empty cell, because it launders a guess into a spec that later work will trust.
- **Interactive element added** → focus visible, hit target ≥ the stated minimum, reachable and operable by keyboard.
- **Animation added** → `prefers-reduced-motion` behaves as the page states.
- **New state rendered** (loading, empty, error, success, disabled) → matches the canonical treatment, rather than inventing a second one.

### 4. Update the page in the same commit

- New or changed component → its **Component inventory** row and status.
- New role, step, or breakpoint → the relevant table.
- Measured ratios → the contrast table.
- Bump `updated`.

Wiki and code ship together (rule 1). A token added to code in one commit and to the page in the next is drift that already happened.

## Anti-patterns

- **Adding a token to code but not to the page.** This is the drift the assert/hold split exists to prevent, and it is invisible to the wiki — nothing will catch it later.
- **Filling `Measured` by eye.** See step 3. Leave it `<TBD>` rather than guessing.
- **Building a component absent from the inventory.** Spec it as an entity first; the Behavior cases are what the tests come from.
- **Treating Design intention as preamble.** It is the section that settles "which of these two reasonable options" without a human. Skipping it is how a codebase drifts while every individual commit looks fine.
- **Silencing the sweep by narrowing the globs.** The grep is a prompt, not a gate.
