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
// Only for a role that declares `capabilities: [web]`. Measured 2026-09-24 on agy
// 1.2.9, headless, as a custom agent with exactly these tools: search_web returns
// a cited summary with no grant (the "no summary returned from GenerateContent"
// failure measured on 1.2.2 was fixed upstream); read_url_content is denied
// (`read_url`) unless the user-global settings allow `read_url(<domain>)` or
// `read_url(*)` — grant_antigravity_setup adds it — and then saves the page under
// agy's own brain directory, which view_file may read.
export const WEB_TOOLS = ['search_web', 'read_url_content'];

export default {
  name: 'antigravity',
  efforts: ['low', 'medium', 'high'],
  // The ids the config editor's dropdown offers when the tool cannot be asked — see claude.mjs.
  knownModels: ['gemini-3.8-flash'],
  // Every id this engine can run starts with one of these — see claude.mjs. `claude-` and
  // `gpt-oss-` are here because `agy models` really lists Claude and open-weight GPT-OSS
  // models next to the Gemini ones (2026-09-21; test/model-fit.test.mjs holds that output).
  // A model the tool lists that is not covered — another vendor's — is added here,
  // deliberately, not accepted because it happens to be well-formed.
  modelPrefixes: ['gemini-', 'claude-', 'gpt-oss-'],
  // `agy models` prints one `id<TAB>name` line per model, with each model listed once per
  // effort (`gemini-3.8-flash-high`, `-medium`, `-low`). Effort is its own setting here
  // and the config names the model without that suffix (`gemini-3.8-flash`, as every
  // measured dispatch did), so the variants are folded into one entry.
  listModels: {
    args: ['models'],
    parse(stdout) {
      const models = new Map();
      for (const line of stdout.split(/\r?\n/)) {
        const [id, label] = line.split('\t');
        if (!id || label === undefined || !/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(id)) continue;
        const base = id.replace(/-(high|medium|low)$/, '');
        if (!models.has(base)) models.set(base, label.replace(/\s*\((high|medium|low)\)\s*$/i, '').trim() || base);
      }
      if (!models.size) throw new Error('agy printed no models');
      return [...models].map(([id, label]) => ({ id, label }));
    }
  },
  // What each flag buildArgs passes is for — see claude.mjs.
  flagNotes: {
    '--add-dir': { kind: 'plumbing', why: 'Gives the worker its worktree as workspace, and separately the folder that holds its agent definition.' },
    '--agent': { kind: 'guarantee', why: 'Runs the worker as a custom agent whose tool list has no write tools (read-only roles) and no sub-agent tools. That is what enforces both rules on this engine.' },
    '--mode': { kind: 'guarantee', why: 'plan for read-only roles, accept-edits for write roles. No --sandbox is passed on purpose: with it, a headless worker cannot run any shell command.' },
    '--print-timeout': { kind: 'config', value: '<seconds>s', why: 'From workerTimeoutSeconds (General → Worker time limit). agy stops itself and still reports; the runner stops every engine a minute later regardless.' },
    '--disable-slash-commands': { kind: 'hygiene', why: 'The skills are already in the prompt; this stops agy adding its own built-in ones on top.' },
    '--input-format': { kind: 'plumbing', why: 'The prompt is sent as stream-json.' },
    '--output-format': { kind: 'plumbing', why: 'The transcript comes back as stream-json, and the report is extracted from it.' },
    '--model': { kind: 'config', value: '<model>', why: 'The role\'s own pin, else the engine\'s default for its profile. Left out when blank or inherit, so the tool uses its own default.' },
    '--effort': { kind: 'config', value: '<effort>', why: 'The role\'s own pin, else the engine\'s default effort for its profile.' },
    '--print': { kind: 'plumbing', value: '(prompt on stdin)', why: 'Non-interactive mode. Always last: the real prompt arrives on stdin, and a flag placed after it would be swallowed as its value.' }
  },
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
  // A role that declares `capabilities: [web]` gets WEB_TOOLS in its agent
  // definition; reading a URL also needs the `read_url` grant, which `check`
  // reports as antigravity setup until it exists (availability.mjs).
  providesWeb: true,
  // stdout is the NDJSON event stream --output-format stream-json requires —
  // --input-format stream-json refuses to pair with any other output format. The
  // terminal {"event":"result"} line carries response, status and denied_actions,
  // so dispatch.mjs captures stdout to a file and runs extractReportFrom over it.
  reportIsStdout: false,
  writesReportFile: true,
  extractReportFrom: 'extract-agy-result.mjs',
  // --print-timeout below; run-worker.mjs's own limit stands a minute behind it.
  enforcesTimeout: true,
  // --print always requires a value, and in text mode that value IS the prompt —
  // which would put a 35KB worker prompt on the command line, far past the
  // ~32K Windows limit. stream-json takes the prompt from stdin instead, with
  // no size limit, so --print is given an empty value.
  promptFormat: 'stream-json',

  // The custom agent a worker runs as. `excludeDefaultComponents` drops agy's
  // own prompt sections and built-in tools, `inheritMcp: false` keeps the user's
  // global MCP servers out of the worker, and `tools:` is the whole toolset —
  // web tools only for a role that declares it needs the web.
  agentDefinition({ role, access, workspace, capabilities = [] }) {
    const name = `workflow-${role}`;
    const tools = [...READ_TOOLS, ...(access === 'write' ? WRITE_TOOLS : []),
      ...(capabilities.includes('web') ? WEB_TOOLS : [])];
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
