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
  // The ids the config editor's dropdown offers when the tool cannot be asked — see claude.mjs.
  knownModels: ['gpt-6-astra', 'gpt-5.6-terra', 'gpt-5.6-luna'],
  // Every id this engine can run starts with one of these — see claude.mjs.
  modelPrefixes: ['gpt-', 'codex-', 'o1', 'o3', 'o4'],
  // gpt-oss is the open-weight family: `agy models` serves it, `codex debug models` does
  // not, and `codex --model gpt-oss-…` without its `--oss` provider setup cannot start.
  modelExcludes: ['gpt-oss'],
  // How to ask the tool which models it has, so the editor's list is the tool's own and
  // never goes stale. `codex debug models` prints its model catalog as JSON; a model
  // it marks `hide` is one it keeps out of its own picker.
  listModels: {
    args: ['debug', 'models'],
    parse(stdout) {
      let catalog;
      try { catalog = JSON.parse(stdout); } catch { throw new Error('codex printed a model catalog that is not JSON'); }
      if (!Array.isArray(catalog?.models)) throw new Error('codex printed no model catalog (no "models" list)');
      return catalog.models.filter(model => typeof model?.slug === 'string' && model.visibility !== 'hide')
        .map(model => ({ id: model.slug, label: model.display_name ?? model.slug }));
    }
  },
  // What each flag buildArgs passes is for — see claude.mjs. `-c key=value` flags are
  // keyed as `-c key`, since the key is what says what they do.
  flagNotes: {
    'exec': { kind: 'plumbing', why: 'Non-interactive mode: run the prompt to completion and exit.' },
    '--ephemeral': { kind: 'hygiene', why: 'Does not keep session files for the run.' },
    '--color': { kind: 'hygiene', why: 'No terminal colour codes in the captured output.' },
    '--cd': { kind: 'plumbing', why: 'Runs in the dispatch\'s own worktree.' },
    '--sandbox': { kind: 'guarantee', why: 'An OS-level sandbox. Read-only roles cannot write anything; write roles can write only inside their worktree.' },
    '-c approval_policy': { kind: 'plumbing', why: 'Never asks for approval, because nobody is there to answer.' },
    '-c project_doc_max_bytes': { kind: 'guarantee', why: 'Codex reads no AGENTS.md: the worker gets only the prompt it was composed.' },
    '-c mcp_servers': { kind: 'guarantee', why: 'No MCP servers at all, so a worker cannot call the workflow server or any other tool server.' },
    '-c agents.enabled': { kind: 'guarantee', why: 'A worker is a leaf: it cannot start sub-agents.' },
    '--model': { kind: 'config', value: '<model>', why: 'The role\'s own pin, else the engine\'s default for its profile. Left out when blank or inherit, so the tool uses its own default.' },
    '-c model_reasoning_effort': { kind: 'config', value: '<effort>', why: 'The role\'s own pin, else the engine\'s default effort for its profile.' },
    '-c tool_output_token_limit': { kind: 'config', value: '<limit>', when: 'only when set in the config', why: 'Caps how much of one file read or command output a worker keeps in its own history. From the Codex-only setting toolOutputTokenLimit.' },
    '-c model_auto_compact_token_limit': { kind: 'config', value: '<limit>', when: 'only when set in the config', why: 'When a worker summarizes its own history. From the Codex-only setting modelAutoCompactTokenLimit.' },
    '-o': { kind: 'plumbing', value: '<report file>', why: 'Writes the worker\'s final report to its own file, apart from the transcript.' },
    '-': { kind: 'plumbing', value: '(prompt on stdin)', why: 'Reads the prompt from standard input. Always the last argument.' }
  },
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
  // Codex runs a worker's commands through PowerShell on Windows, as a separate
  // sandbox account for which PowerShell refuses to run npm.ps1. Measured
  // 2026-09-14: `npm test` exited 1 with PSSecurityException and `npm.cmd test`
  // exited 0, in the same sandbox, one after the other. So a worker on codex is
  // told the .cmd spelling; claude and agy ran `npm test` on the same machine and
  // are left alone. Anything that already names a shim, or is not npm/npx, is
  // returned unchanged.
  // Codex has no file-reading tool apart from its shell: a worker reads with
  // `Get-Content`/`cat` and searches with `rg`. Measured 2026-09-14: two read-only
  // adversaries told that everything off the allowlist is forbidden stopped with
  // "this session exposes no dedicated filesystem-reading tool" and reviewed
  // nothing. So its prompt says read-only shell reads are its file tools.
  filesThroughShell: true,
  spellCommand(command, platform) {
    return platform === 'win32' ? command.replace(/^(npm|npx)(?= )/, '$1.cmd') : command;
  },
  // tool_output_token_limit and model_auto_compact_token_limit are real config.toml
  // keys (confirmed against Codex's own docs, not measured in this repo the way
  // the -o transcript numbers above are) that bound how much of a large file read
  // or command output the worker keeps in its own history before truncating, and
  // when it hands its history to an auto-summarization pass. Both are optional and
  // unset by default: -o already keeps the *conductor* from paying for a bloated
  // transcript, but a long task can still burn the *worker's own* context on large
  // reads and force early lossy compaction. Set per-project in
  // .agents/config.json's engines.codex block; see engine-setup.md.
  buildArgs({ readOnly, workspace, model, effort, reportFile, config }) {
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
    if (config?.toolOutputTokenLimit) args.push('-c', `tool_output_token_limit=${config.toolOutputTokenLimit}`);
    if (config?.modelAutoCompactTokenLimit) {
      args.push('-c', `model_auto_compact_token_limit=${config.modelAutoCompactTokenLimit}`);
    }
    if (reportFile) args.push('-o', reportFile);
    args.push('-'); // Reads the prompt from stdin; must stay the final argument.
    return args;
  }
};
