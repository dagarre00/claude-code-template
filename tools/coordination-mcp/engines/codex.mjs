// Codex adapter. Isolation is an OS-level sandbox plus approval_policy, so there
// is no per-command allowlist to grant; workspace-write covers the file edits a
// write worker makes inside its worktree, but not the Git store — see `commits`.
export default {
  name: 'codex',
  efforts: ['minimal', 'low', 'medium', 'high', 'xhigh'],
  terminal: '-',
  // Codex edits files but cannot commit them: workspace-write deliberately
  // protects .git, so `git add` fails with `Unable to create
  // .git/worktrees/<id>/index.lock: Permission denied`. It is one of the two
  // engines that forced the supervisor-commits convention — evidence and the
  // upstream issues are in docs/harnesses.md §12. Nothing is needed here: the
  // runner commits for every engine, so this adapter grants no git access.
  //
  // Codex reads AGENTS.md — verified: with one in its working directory it quoted
  // a passphrase that appears nowhere else, without a tool call. It is also the
  // one engine that can be told not to, so we tell it not to and the manager
  // supplies the worker-scoped subset instead of the conductor-facing whole.
  readsProjectDocs: false,
  buildArgs({ readOnly, workspace, model, effort }) {
    const args = ['exec', '--ephemeral', '--color', 'never', '--cd', workspace,
      '--sandbox', readOnly ? 'read-only' : 'workspace-write', '-c', 'approval_policy="never"',
      // Clear the whole table rather than disabling one server by name: a
      // `mcp_servers.<name>.enabled=false` override creates a server entry with
      // no transport, and Codex then refuses to load the config at all
      // ("invalid transport in mcp_servers.coordination"), killing every worker
      // before it starts. Clearing it also cuts the worker off from every other
      // MCP server, which is what a bounded task should have anyway.
      '-c', 'agents.enabled=false', '-c', 'mcp_servers={}',
      // AGENTS.md is written for the conductor: command catalog, agent catalog,
      // dispatch and integration rules — none of which a worker may act on, all
      // of which it pays for. Measured on an identical prompt in this repository:
      // 10004 tokens with project docs, 5199 without. The manager prepends the
      // worker-scoped subset instead, which is why suppressesProjectDocs is set.
      '-c', 'project_doc_max_bytes=0'];
    if (model && model !== 'inherit') args.push('--model', model);
    if (effort) args.push('-c', `model_reasoning_effort=${JSON.stringify(effort)}`);
    args.push('-'); // Reads the prompt from stdin; must stay the final argument.
    return args;
  }
};
