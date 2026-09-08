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
  // agents.enabled=false removes delegation. Measured: a worker asked what
  // agent-spawning tools it has answers NONE.
  enforcesLeafWorker: true,
  // --sandbox read-only is an OS-level sandbox, so a read-only worker cannot
  // write anywhere — not even the scratch file a skill asks it for. Measured:
  // an adversary told to write its findings to .handoff/ reported "mailbox
  // delivery blocked by the read-only filesystem" and the tree stayed clean.
  enforcesReadOnly: true,
  // `codex exec`'s default text output interleaves the worker's final message
  // with the full transcript of every command it ran and that command's
  // complete raw output — measured at 6.9MB/43,015 lines for a single
  // wiki-maintainer health-pass dispatch, almost entirely large file reads and
  // one rejected multi-file apply_patch echoed back in full. None of that is
  // model reasoning (`reasoning summaries: none` is on by default and holds
  // here — zero "thinking:" sections in that 43K-line file); it is the action
  // log. -o writes just the final message to reportFile instead, so the
  // conductor's routine path never has to wade through it.
  reportIsStdout: false,
  writesReportFile: true,
  buildArgs({ readOnly, workspace, model, effort, reportFile }) {
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
    if (reportFile) args.push('-o', reportFile);
    args.push('-'); // Reads the prompt from stdin; must stay the final argument.
    return args;
  }
};
