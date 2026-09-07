// Codex adapter. Isolation is an OS-level sandbox plus approval_policy, so there
// is no per-command allowlist to grant. workspace-write covers file edits inside
// the worktree but deliberately protects .git, which is one of the two reasons
// no worker on any engine commits its own output.
//
// Known limit, accepted rather than worked around: Codex always lists the
// project's skill CATALOG (`.agents/skills/` names and descriptions, roughly a
// kilobyte), and there is no way to turn that off in 0.153.4 — `skills.enabled`
// is not a config field, and the `skip_host_skill_discovery` feature flag is
// still under development and measurably inert. Bodies are not loaded, and the
// skills the worker must actually follow are inlined in the prompt, so the
// effect is a little duplication of names rather than hidden instructions.
export default {
  name: 'codex',
  efforts: ['minimal', 'low', 'medium', 'high', 'xhigh'],
  readsProjectDocs: true,
  promptFormat: 'text',
  buildArgs({ readOnly, workspace, model, effort }) {
    const args = [
      'exec', '--ephemeral', '--color', 'never', '--cd', workspace,
      '--sandbox', readOnly ? 'read-only' : 'workspace-write',
      '-c', 'approval_policy="never"',
      // AGENTS.md is written for the conductor — command catalog, dispatch and
      // integration rules — none of which a worker may act on and all of which
      // it would pay for. The composed prompt carries the worker-scoped subset.
      '-c', 'project_doc_max_bytes=0',
      // Clear the whole table rather than disabling one server by name: an
      // `mcp_servers.<name>.enabled=false` override creates an entry with no
      // transport, and Codex then refuses to load the config at all, killing
      // every worker before it starts.
      '-c', 'mcp_servers={}',
      // No recursive dispatch. The contract says it; this enforces it.
      '-c', 'agents.enabled=false'
    ];
    if (model && model !== 'inherit') args.push('--model', model);
    if (effort) args.push('-c', `model_reasoning_effort=${JSON.stringify(effort)}`);
    args.push('-'); // Reads the prompt from stdin; must stay the final argument.
    return args;
  }
};
