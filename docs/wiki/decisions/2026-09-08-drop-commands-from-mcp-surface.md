---
aliases: [Commands off MCP, Worker-safe command references]
type: decision
domains: [agents, software]
status: accepted
sources: []
supersedes: []
superseded_by: []
contradicts: []
open_questions: []
created: 2026-09-08
updated: 2026-09-08
---

# Drop commands from the MCP surface; make dispatch discipline explicit

> [!abstract] Essence
> Top-level workflow commands (`work`, `review`, `adversary`, `wiki`, `interview`, `init`) are a conductor concern and are reached natively (Claude Code's `project` plugin today) or by reading `.agents/commands/<name>.md` directly — never through the `workflow` MCP server, which now exposes worker-dispatch primitives only. Every file that is actually inlined into a dispatched worker's prompt was audited and rewritten so it never names a command as if the worker could invoke it, and the "MCP is the only dispatch path" rule was hardened to explicitly cover same-engine dispatch.

## Status

Accepted as of 2026-09-08.

## Context

The `workflow` MCP server previously exposed top-level commands three ways at once: Claude Code's native plugin reading `.agents/commands/` in place, an MCP tool (`get_workflow`) that returned a command's body by name, and a per-command MCP prompt (`project-<name>`) generated from the same source. This was redundant — Claude Code is the only conductor in active use right now, and a conductor that can read `.agents/commands/` directly never needs a tool round-trip to reach one.

Separately, auditing what actually reaches a **dispatched worker** (role body + worker-filtered rules + worker contract + declared skills, per `compose.mjs`) turned up 64 places across all 7 role files, 8 worker-bound skills, and one unmarked rule (`rules.md` rule 16) that referenced a top-level command as if it were something the worker itself could act on — e.g. "escalate via `/project:interview`". A dispatched worker has no repo access, no slash-command picker, and dispatches nothing itself (that's the entire point of the worktree/prompt-suppression architecture); a command reference in its own prompt is dead text at best and a false affordance at worst.

## Decision

1. Remove `get_workflow`, `list_commands`, and the per-command MCP prompt registration from the `workflow` server. MCP goes back to being worker-dispatch plumbing only (`list_roles`, `build_worker_prompt`, `prepare_worktree`, `list_worktrees`, `remove_worktree`, `sync`, `check`). `canonical.mjs`'s command loading is unchanged — `generate.mjs` still needs it for the AGENTS.md catalog table.
2. Commands keep their existing native surface (Claude Code's plugin) and nothing else, for now. `generate.mjs`'s "How this repository works" section documents the fallback for any other conductor: read `.agents/commands/<name>.md` directly.
3. Every role file and every skill actually declared in a command's `skills:` map was swept: any reference to a command as an invocable thing was reworded to a plain outcome ("flag it for the conductor to route to a fresh spec pass" instead of naming `/project:interview`). Frontmatter `description:` fields were left alone — `compose.mjs` never inlines them into a worker prompt, only the body.
4. "MCP is the only dispatch path" (`generate.mjs`'s "Delegating work" section, and `.agents/commands/work.md`'s dispatch intro) now says explicitly that this holds even when a role's configured engine equals the conductor's own — dispatching `developer` on Sonnet from a Claude Code conductor is still a `prepare_worktree`/`build_worker_prompt` call, never a shortcut through the conductor's native Task/Agent tool.

## Consequences

- **Positive:** no duplicate surface for the same six commands; a worker's prompt never contains a reference it cannot act on; the same-engine dispatch loophole is closed in wording, not just in current code behavior.
- **Negative:** Codex and Antigravity have no native command surface at all right now — a human using either as conductor must point it at `.agents/commands/<name>.md` manually. Both CLIs' own native extension mechanisms (Codex's deprecated `~/.codex/prompts/`, Antigravity's home-directory-scoped plugins) are user-machine-scoped, not project-portable, so generating into either was rejected rather than deferred — see Alternatives.
- **Follow-ups:** none filed; this was implemented directly, not queued.

## Alternatives considered

- **Generate a native command artifact for Codex and Antigravity too.** Rejected: Codex's custom-prompt slash commands are deprecated by OpenAI in favor of "skills," and both mechanisms install to the user's home directory, not the project — neither is a zero-setup, git-tracked artifact a `sync` step could produce for every contributor.
- **Keep the MCP `get_workflow`/prompt exposure as a convenience alongside the native plugin.** Rejected as the original state being corrected: two live paths to the same six commands is exactly the duplication this decision removes, and it invited the confusion that prompted this change (a user seeing both `/project:work` and `mcp__workflow__project-work` in the same command list with no explanation of the difference).
- **Rename `.agents/commands/` away from Claude Code's plugin-discovery convention** (an earlier draft of this change) to force every CLI through MCP uniformly. Rejected: Claude Code's native plugin command surface is real, project-local, and already working — removing it to chase uniformity with two CLIs that have no equivalent mechanism available would have made the *working* case strictly worse to fix a documentation duplication.

## References

- Implementation: `tools/workflow-mcp/server.mjs`, `tools/workflow-mcp/tools.mjs`, `tools/workflow-mcp/generate.mjs`.
- What actually reaches a dispatched worker is defined in `tools/workflow-mcp/compose.mjs` and `workerRules()` in `tools/workflow-mcp/canonical.mjs`.
- Related: [[gotchas#The connected workflow MCP server does not see mid-session edits to its own source]], hit while verifying this change.
