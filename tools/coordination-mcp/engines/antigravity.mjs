// Antigravity CLI adapter. Like Codex this sandboxes at the OS level, and it
// carries its own print timeout rather than relying on the runner's kill path.
export default {
  name: 'antigravity',
  efforts: ['low', 'medium', 'high'],
  buildArgs({ settings, role, readOnly, workspace, model, effort }) {
    const args = ['--add-dir', workspace, '--agent', role, '--sandbox',
      '--mode', readOnly ? 'plan' : 'accept-edits',
      '--print-timeout', `${settings.workerTimeoutSeconds}s`, '--print'];
    if (model && model !== 'inherit') args.push('--model', model);
    if (effort) args.push('--effort', effort);
    return args;
  },
  nativeAgent({ name, description, access, body, startup, modelFor, config, helpers }) {
    const path = `.agents/agents/${name}.md`;
    const meta = { name, description: helpers.expand(description, path, 'shared'),
      model: modelFor('antigravity') ?? 'inherit', subagent: true, mainAgent: true, commandExecutionPolicy: 'sandbox' };
    if (access === 'read-only') meta.tools = config.readOnlyTools;
    return { path, content: helpers.yaml(meta, startup + helpers.expand(body, path, 'shared')) };
  },
};
