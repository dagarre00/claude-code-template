---
name: hooks
description: Lifecycle hooks wired in settings.json — session-start, test-first-check, auto-format, wiki-drift-check, session-end. What each does, when it fires, the channel it speaks on, and why.
type: wiki-entity
updated: 2026-05-31
status: shipped
---

# Entity: Hooks

Five shell hooks wired through `.claude/settings.json`. They enforce — or rather _remind_ — the project's disciplines at the right lifecycle moments. **None of them hard-block** (the test-first hook used to; it no longer does). They nudge; the agent keeps the discipline.

## Behavior

- [x] `session-start.sh` (SessionStart) warns on upstream divergence, detects an unactivated Python venv, warns on uncommitted changes (also absorbing the previous session's dirty-tree nag), records HEAD SHA to `.claude/tmp/session-start-sha`, and resets the per-session dedup markers. Actionable lines go to **stdout** → injected into the model's context.
- [x] `test-first-check.sh` (PreToolUse Write|Edit) reminds — never blocks — when production code is edited on `feat/*`/`fix/*` with no test in the session's changes. Emits `hookSpecificOutput.additionalContext` (model-facing), **once per session**.
- [x] `auto-format.sh` (PostToolUse Write|Edit) runs a formatter by file extension. Pure side-effect; output stays on **stderr**.
- [x] `wiki-drift-check.sh` (PostToolUse Write|Edit) warns if source code changed this session but no `docs/wiki/` page has been touched. Emits `additionalContext` (model-facing), **once per drift-state** — the marker clears the moment a wiki page is touched, so a later code-without-wiki edit re-warns.
- [x] `session-end.sh` (Stop) appends a session entry to `docs/wiki/log.md` when new commits landed, and reminds (stderr) if the tree is dirty.

## Channel — why warnings go where they go

The guiding rule is **route each warning to whoever must act on it, and only once per state**. Most of these disciplines are the _agent's_ to keep (sync before work, test-first, wiki-in-the-same-change, push-before-recycle), so the warning has to reach the **model's context**, not a transcript a headless/web/CI run has no human to read. The channel is dictated by what each hook event can do:

- **SessionStart → stdout.** SessionStart stdout is injected into context. The git-state warnings (divergence, dirty tree, venv) start every session _in the model's view_. This is also where the previous session's "you left work uncommitted" lands — see the Stop note below.
- **PreToolUse / PostToolUse → `hookSpecificOutput.additionalContext`.** Both events can inject context non-blocking via the `additionalContext` field, reaching the agent mid-flow (right when it can still act) without changing the permission flow. `test-first-check` and `wiki-drift-check` use this. No `permissionDecision` is set, so nothing is auto-allowed or blocked.
- **Stop → stderr only (human FYI).** A Stop hook can _only_ reach the model by returning `decision:block`, which forces another turn and would fight the project's "warn, never block" rule (and can loop). So `session-end`'s dirty-tree reminder stays on stderr for a human watching the transcript; the **model-facing** delivery of that same fact is deferred to the next **SessionStart** (which prints it to stdout). The real safety net against lost work is the command-level commit+push step (`/project:work`) and behavioral rule 19 — the hook is only a backstop.
- **Pure side-effects → stderr.** `auto-format` has nothing the model needs to act on; its output correctly stays out of context.

**Low pollution by design.** Each in-flow reminder fires **once per state**, not on every edit: dedup markers live in `.claude/tmp/*-warned` (gitignored). `session-start.sh` clears them at the top of each session so every session re-warns once. `wiki-drift-check` additionally clears its marker as soon as the wiki is touched.

## Gotchas

- `additionalContext` support per hook event varies by Claude Code version. The hooks emit it as well-formed JSON on stdout: on a version that supports it, it's injected into context; on an older one it degrades to a transcript line (visible to a human) rather than vanishing — no regression, but confirm your version if you rely on the in-context delivery.
- Hooks fire on **every** matching event. Keep them fast and side-effect-free where possible; the dedup markers exist precisely because PostToolUse/PreToolUse fire on every Write/Edit.
- The session SHA marker (`.claude/tmp/session-start-sha`) scopes "this session's changes" for `test-first-check` and `wiki-drift-check`. If it's missing, both fall back to staged+unstaged diff only.
- In `session-end.sh`, the dirty-tree check runs **before** the `log.md` append — otherwise the append would make the tree look dirty every time.
- `wiki-drift-check` ignores `.sh` and other non-code extensions (it keys off `.py|.js|.ts|…`), so editing the hooks themselves does not trip a drift warning.
- Hooks only fire when `.claude/settings.json` is loaded — a fresh clone with no settings has no hooks.
- All paths use `$CLAUDE_PROJECT_DIR` (not `$PWD`) so hooks work regardless of the agent's working directory.
