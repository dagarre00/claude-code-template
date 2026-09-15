// Antigravity (agy) adapter.
//
// agy discovers no AGENTS.md and no `.agents/skills/` in print mode — measured
// with sentinel files, and agy says so itself: "no active workspace is currently
// loaded, workspace-level skills from .agents/skills/ are not present". What it
// does load in print mode, by name, is a custom agent from `.agents/agents/` in
// one of its workspace folders when --agent names it. Every worker is launched as
// one, defined per dispatch by agentDefinition() below and written by dispatch.mjs
// beside the prompt — never in the worktree, and never in the repository's own
// `.agents/`, where Claude Code's plugin loader would publish it as a native
// subagent (see AGENTS.md § Delegating work).
//
// The agent definition is what earns the two enforcement claims below. Measured
// 2026-09-13 (agy 1.2.2): a read-only worker told to create a file and define a
// subagent did both when launched plainly, and answered NO SUCH TOOL to both, with
// nothing created, when launched as this agent. It also drops agy's default
// prompt sections, which is where two measured failures came from: the artifacts
// section, which invites `ArtifactMetadata` on an ordinary write and gets it
// refused as "not a valid artifact path", and the file-link section, which filled
// reports with absolute file:/// links into the worker's own worktree — carried
// into a plan, those pointed the next worker at someone else's checkout.
//
// What it does NOT do is confine reads. A worker can still read outside its
// worktree, with or without `allowNonWorkspaceAccess: false` (measured with a
// canary file). extract-agy-result.mjs audits that on every run instead.
const READ_TOOLS = ['view_file', 'list_dir', 'grep_search', 'find_by_name', 'run_command'];
const WRITE_TOOLS = ['write_to_file', 'replace_file_content', 'multi_replace_file_content'];

export default {
  name: 'antigravity',
  efforts: ['low', 'medium', 'high'],
  readsProjectDocs: false,
  // Earned by the agent's `tools:` list, which leaves out define_subagent,
  // invoke_subagent and every other agent-spawning tool. agy validates that list
  // strictly — an unknown name fails the run with "tool ... not found in
  // registry" rather than being ignored — so a typo cannot quietly widen it.
  enforcesLeafWorker: true,
  // Earned the same way: a read-only agent has no tool that writes a file.
  // `--mode plan` is still passed, but it is inert while slash command expansion
  // is disabled ("warning: --mode plan has no effect..."), and nothing relies on it.
  enforcesReadOnly: true,
  // Measured once, and the agent definition below carries no web tools anyway:
  // headless agy auto-denies read_url_content unless each URL is pre-granted, and
  // search_web failed on its own ("no summary returned from GenerateContent"). A
  // role that declares `capabilities: [web]` is warned off this engine.
  providesWeb: false,
  // stdout is the NDJSON event stream --output-format stream-json requires —
  // --input-format stream-json refuses to pair with any other output format. The
  // terminal {"event":"result"} line carries response, status and denied_actions,
  // so dispatch.mjs captures stdout to a file and runs extractReportFrom over it.
  reportIsStdout: false,
  writesReportFile: true,
  extractReportFrom: 'extract-agy-result.mjs',
  // --print always requires a value, and in text mode that value IS the prompt —
  // which would put a 35KB worker prompt on the command line, far past the
  // ~32K Windows limit. stream-json takes the prompt from stdin instead, with
  // no size limit, so --print is given an empty value.
  promptFormat: 'stream-json',

  // The custom agent a worker runs as. `excludeDefaultComponents` drops agy's
  // own prompt sections and built-in tools, `inheritMcp: false` keeps the user's
  // global MCP servers out of the worker, and `tools:` is the whole toolset. No
  // web tools: headless agy denies read_url_content unless each URL is granted,
  // and search_web failed on its own in the one measured researcher run.
  agentDefinition({ role, access, workspace }) {
    const name = `workflow-${role}`;
    const tools = access === 'write' ? [...READ_TOOLS, ...WRITE_TOOLS] : READ_TOOLS;
    const content = [
      '---',
      `name: ${name}`,
      `description: Workflow leaf worker for the ${role} role (${access}).`,
      'excludeDefaultComponents: true',
      'inheritMcp: false',
      'tools:',
      ...tools.map(tool => `  - ${tool}`),
      '---',
      'You are a leaf worker dispatched by a conductor. Your complete instructions arrive as the first user message. '
        + `Your workspace is ${workspace}; resolve every relative path against it, and pass it as Cwd to run_command. `
        + 'Your final message is your report.',
      ''
    ].join('\n');
    return { name, content };
  },

  buildArgs({ settings, readOnly, workspace, model, effort, agent }) {
    // Both enforcement claims rest on the agent, so a command without one is
    // refused rather than quietly launched with every default tool.
    if (!agent?.name || !agent?.dir) {
      throw new Error('antigravity workers run as a custom agent: pass the agent that agentDefinition() '
        + 'produced and dispatch wrote, or the worker gets every default tool');
    }
    const args = [
      '--add-dir', workspace,
      // agy resolves --agent by name from its workspace folders; this one holds
      // only the definition. An absolute path to the file is accepted and
      // silently ignored (measured), so the name is the only form that works.
      '--agent', agent.name, '--add-dir', agent.dir,
      // No --sandbox, and this is the flag that decides whether agy workers run
      // at all. With it, every shell call needs the `escalate_admin` permission
      // rather than `command`, and headless mode cannot prompt for either — the
      // worker exits 0, reports SUCCESS, and returns an empty response with
      // `denied_actions: [{action: "escalate_admin"}]`. `escalate_admin` also
      // cannot be granted per command, so keeping the sandbox would mean granting
      // Bash escalation wholesale — broader than the exact-match `command(<line>)`
      // rules that replace it. See tools/workflow-mcp/engine-setup.md.
      '--mode', readOnly ? 'plan' : 'accept-edits',
      // agy carries its own print-mode timeout rather than relying on the
      // caller to kill it.
      '--print-timeout', `${settings.workerTimeoutSeconds}s`,
      // The skills are inlined in the prompt; expansion would only add its
      // built-in ones on top.
      '--disable-slash-commands',
      '--input-format', 'stream-json', '--output-format', 'stream-json'
    ];
    if (model && model !== 'inherit') args.push('--model', model);
    if (effort) args.push('--effort', effort);
    // Must stay last. --print consumes the next argument as its value, so a flag
    // placed after it is swallowed and the real prompt discarded: agy exits 2
    // with `--print took "--effort" as its prompt`. The attached empty value
    // satisfies the parser while the prompt arrives over stdin.
    args.push('--print=');
    return args;
  }
};
