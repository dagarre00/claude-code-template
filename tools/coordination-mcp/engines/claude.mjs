// Claude Code adapter. Permissions here are application-level: a permission mode
// plus tool allow/deny lists, unlike the OS sandboxes the other engines use.
export default {
  name: 'claude',
  efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
  // No --agent flag. It delivered a second copy of the role body the manager
  // already inlines in every prompt — 8KB for developer, 10KB for
  // wiki-maintainer, roughly doubling the instruction payload per dispatch. Its
  // only unique contribution was the read-only `tools:` allowlist, and plan mode
  // was measured to refuse writes even when Write and Edit are explicitly
  // allowed, so that allowlist enforced nothing plan mode does not.
  buildArgs({ config, readOnly, model, effort }) {
    const mode = config.writePermissionMode;
    if (!['acceptEdits', 'default', 'dontAsk'].includes(mode)) throw new Error('Unsafe/unsupported Claude permission mode');
    const args = ['--print', '--no-session-persistence', '--strict-mcp-config',
      '--permission-mode', readOnly ? 'plan' : mode, '--permission-prompts', 'none',
      // Every dispatch runs in a differently-named worktree, and that path sits in
      // the system prompt as cwd — so without this the cached prefix breaks on
      // every single dispatch. Moving the per-machine sections into the first user
      // message makes the system prompt identical across workers and cacheable.
      '--exclude-dynamic-system-prompt-sections',
      '--disallowedTools', 'Agent,Task'];
    // acceptEdits covers file edits and read-only shell, but mutating commands
    // still route to a prompt — and --permission-prompts none denies those. This
    // is where an adopting project grants the mutating commands its write roles
    // genuinely need, such as its test runner. Git verbs are deliberately NOT
    // here: the runner commits for every engine, so a worker that ran `git
    // commit` would break a convention the other two engines cannot follow
    // anyway. Read-only roles need nothing: plan mode already permits the git
    // reads a review depends on.
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
  }
};
