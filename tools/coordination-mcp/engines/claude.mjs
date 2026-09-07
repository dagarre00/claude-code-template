// Claude Code adapter. Permissions here are application-level: a permission mode
// plus tool allow/deny lists, unlike the OS sandboxes the other engines use.
export default {
  name: 'claude',
  efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
  buildArgs({ config, role, readOnly, model, effort }) {
    const mode = config.writePermissionMode;
    if (!['acceptEdits', 'default', 'dontAsk'].includes(mode)) throw new Error('Unsafe/unsupported Claude permission mode');
    const args = ['--print', '--agent', role, '--no-session-persistence', '--strict-mcp-config',
      '--permission-mode', readOnly ? 'plan' : mode, '--permission-prompts', 'none',
      '--disallowedTools', 'Agent,Task'];
    // acceptEdits covers file edits and read-only shell, but mutating commands
    // still route to a prompt — and --permission-prompts none denies those. A
    // write worker that cannot `git add`/`git commit` produces no deliverable,
    // which merge_and_cleanup_worker then rejects. Read-only roles need nothing
    // here: plan mode already permits the git reads a review depends on.
    if (!readOnly) {
      const allowed = config.writeAllowedTools ?? [];
      if (!Array.isArray(allowed) || allowed.some(rule => typeof rule !== 'string' || !rule.trim() || /[\0\r\n]/.test(rule))) {
        throw new Error('writeAllowedTools must be an array of nonempty single-line rules');
      }
      if (allowed.some(rule => /dangerous|bypassPermissions/i.test(rule))) throw new Error('writeAllowedTools must not grant permission bypass');
      if (allowed.length) args.push('--allowedTools', ...allowed);
    }
    if (model && model !== 'inherit') args.push('--model', model);
    if (effort) args.push('--effort', effort);
    return args;
  },
  // Native agent file for engines that discover roles from disk rather than over
  // MCP. readOnlyTools is the native counterpart of plan mode: the MCP path
  // restricts a reviewer by permission mode, this path by an explicit allowlist.
  nativeAgent({ name, description, access, body, startup, modelFor, config, helpers }) {
    const path = `.claude/agents/${name}.md`;
    const meta = { name, description: helpers.expand(description, path, 'claude'), model: modelFor('claude') ?? 'inherit' };
    if (access === 'read-only') meta.tools = config.readOnlyTools;
    return { path, content: helpers.yaml(meta, startup + helpers.expand(body, path, 'claude')) };
  },
};
