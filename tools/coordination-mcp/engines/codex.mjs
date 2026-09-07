// Codex adapter. Isolation is an OS-level sandbox plus approval_policy, so there
// is no per-command allowlist to grant; workspace-write already covers the git
// mutations a write worker performs inside its worktree. Unverified — see
// docs/harnesses.md §12.
export default {
  name: 'codex',
  efforts: ['minimal', 'low', 'medium', 'high', 'xhigh'],
  terminal: '-',
  // Read-only roles only. The workspace-write sandbox deliberately protects .git
  // — a writable .git/hooks would let an agent plant a hook that runs outside the
  // sandbox the next time a human uses git — so a Codex worker edits files but
  // cannot commit, and a write worker with no commits is rejected at integration.
  // Verified here: the worker wrote its file, then failed with
  // `Unable to create .git/worktrees/<id>/index.lock: Permission denied`, and
  // emitted a diff instead. Codex's own answer is `codex apply` on the host.
  // The documented escape (writable_roots pointing at .git) does not help us:
  // openai/codex#18918 has Windows applying DENY ACLs to .git inside
  // writable_roots, and openai/codex#27418 has the sandbox force-protecting the
  // resolved gitdir of a linked worktree even with explicit permission. Both are
  // open, and this project always dispatches into linked worktrees.
  writeRoles: false,
  buildArgs({ readOnly, workspace, model, effort }) {
    const args = ['exec', '--ephemeral', '--color', 'never', '--cd', workspace,
      '--sandbox', readOnly ? 'read-only' : 'workspace-write', '-c', 'approval_policy="never"',
      // Clear the whole table rather than disabling one server by name: a
      // `mcp_servers.<name>.enabled=false` override creates a server entry with
      // no transport, and Codex then refuses to load the config at all
      // ("invalid transport in mcp_servers.coordination"), killing every worker
      // before it starts. Clearing it also cuts the worker off from every other
      // MCP server, which is what a bounded task should have anyway.
      '-c', 'agents.enabled=false', '-c', 'mcp_servers={}'];
    if (model && model !== 'inherit') args.push('--model', model);
    if (effort) args.push('-c', `model_reasoning_effort=${JSON.stringify(effort)}`);
    args.push('-'); // Reads the prompt from stdin; must stay the final argument.
    return args;
  }
};
