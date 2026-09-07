// Codex adapter. Isolation is an OS-level sandbox plus approval_policy, so there
// is no per-command allowlist to grant; workspace-write already covers the git
// mutations a write worker performs inside its worktree. Unverified — see
// docs/harnesses.md §12.
export default {
  name: 'codex',
  efforts: ['minimal', 'low', 'medium', 'high', 'xhigh'],
  terminal: '-',
  buildArgs({ readOnly, workspace, model, effort }) {
    const args = ['exec', '--ephemeral', '--color', 'never', '--cd', workspace,
      '--sandbox', readOnly ? 'read-only' : 'workspace-write', '-c', 'approval_policy="never"',
      '-c', 'agents.enabled=false', '-c', 'mcp_servers.coordination.enabled=false'];
    if (model && model !== 'inherit') args.push('--model', model);
    if (effort) args.push('-c', `model_reasoning_effort=${JSON.stringify(effort)}`);
    args.push('-'); // Reads the prompt from stdin; must stay the final argument.
    return args;
  }
};
