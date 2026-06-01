---
name: 2026-05-31-route-hook-warnings-to-actor-context
description: Route each hook's actionable warning to whoever must act on it (the model's context), not stderr — reversing the original stderr-only design.
type: wiki-decision
updated: 2026-05-31
status: approved
---

# Route hook warnings to the actor's context, not stderr

## Context

The five lifecycle hooks (see [[entities/hooks]]) originally wrote **every** warning to **stderr**, on the stated rationale that this "observes and reminds without polluting the context window." But most of these disciplines are the _agent's_ to keep — sync before work, test-first, wiki-in-the-same-change, push-before-recycle. stderr surfaces only in the hook transcript, which the model never reads and which, in a headless / web / CI run, may have **no human reading it either**. The warnings were dead letters: shouting in the one direction neither party listens.

The warnings split cleanly by who must act:

| Warning | Who acts | Was routed to |
| --- | --- | --- |
| upstream divergence / uncommitted / venv (session-start) | the agent | stderr ❌ |
| test-first nudge (PreToolUse) | the agent | stderr ❌ |
| wiki-drift (was Stop) | the agent | stderr ❌ |
| dirty tree (session-end, Stop) | the agent | stderr ❌ |
| auto-format output (PostToolUse) | nobody | stderr ✓ |

## Decision

Route each warning to the channel that reaches its actor, **once per state**:

- **SessionStart → stdout** (injected into context). Git-state warnings start every session in the model's view.
- **PreToolUse / PostToolUse → `hookSpecificOutput.additionalContext`** (model-facing, non-blocking, no `permissionDecision` set). `test-first-check` stays at PreToolUse; **`wiki-drift-check` moves Stop → PostToolUse(Write|Edit)** so it reaches the agent mid-flow.
- **Stop → stderr only.** A Stop hook can reach the model only via `decision:block`, which forces another turn and fights the "warn, never block" rule. So `session-end`'s dirty-tree nag stays a human FYI; its model-facing delivery is deferred to the next SessionStart.
- **Pure side-effects (auto-format) → stderr.** Correctly out of context.

Low pollution is preserved with dedup markers in `.claude/tmp/*-warned` (gitignored): each in-flow reminder fires once per state. `session-start` clears them each session; `wiki-drift-check` also clears its marker when the wiki is touched.

## Consequences

- The agent now starts every session knowing the git state, and gets the test-first / wiki-drift nudges _while it can still act_ — not in a transcript it never reads.
- Headless/web/CI runs (no human) are no longer the worst case for these reminders.
- New dependency on `hookSpecificOutput.additionalContext`, whose support varies by Claude Code version. The hooks emit well-formed JSON, so on an unsupported version it degrades to a transcript line rather than vanishing — no regression. Confirm your version if you rely on in-context delivery.
- The old "warnings to stderr is deliberate" stance in [[entities/hooks]] is reversed; that page now documents the per-actor routing.

## Alternatives considered

- **Keep everything on stderr.** Rejected: the actionable warnings never reach the actor; in headless runs nobody reads them.
- **Make Stop hooks inject via `decision:block`.** Rejected: forces extra turns and can loop, violating "warn, never block."
- **Fire wiki-drift on every edit (no dedup).** Rejected: floods the context window. The once-per-drift-state marker keeps it honest but quiet.
