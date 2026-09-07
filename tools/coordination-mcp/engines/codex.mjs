// Codex adapter. Isolation is an OS-level sandbox plus approval_policy, so there
// is no per-command allowlist to grant; workspace-write already covers the git
// mutations a write worker performs inside its worktree. Unverified — see
// docs/harnesses.md §12.
export default {
  name: 'codex',
  efforts: ['minimal', 'low', 'medium', 'high', 'xhigh'],
  buildArgs({ readOnly, workspace, model, effort }) {
    const args = ['exec', '--ephemeral', '--color', 'never', '--cd', workspace,
      '--sandbox', readOnly ? 'read-only' : 'workspace-write', '-c', 'approval_policy="never"',
      '-c', 'agents.enabled=false', '-c', 'mcp_servers.coordination.enabled=false'];
    if (model && model !== 'inherit') args.push('--model', model);
    if (effort) args.push('-c', `model_reasoning_effort=${JSON.stringify(effort)}`);
    args.push('-'); // Reads the prompt from stdin; must stay the final argument.
    return args;
  },
  // TOML rather than YAML, and no commands/skills of its own: Codex reaches those
  // through the MCP prompts the coordination server registers per command.
  nativeAgent({ name, description, access, body, startup, modelFor, effortFor, helpers }) {
    const path = `.codex/agents/${name}.toml`;
    const meta = { name, description: helpers.expand(description, path, 'shared'),
      model_reasoning_effort: effortFor('codex'),
      developer_instructions: startup + helpers.expand(body, path, 'shared') };
    if (modelFor('codex')) meta.model = modelFor('codex');
    if (access === 'read-only') meta.sandbox_mode = 'read-only';
    return { path, content: `# Generated from ${helpers.source}; DO NOT EDIT.\n`
      + Object.entries(meta).map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join('\n') + '\n' };
  },
};
