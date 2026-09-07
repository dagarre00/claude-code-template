// Antigravity (agy) adapter.
//
// This is the engine that validates the architecture: agy discovers no
// repository files in print mode at all — not AGENTS.md, not `.agents/skills/`,
// not `.gemini/skills/` or `.gemini/commands/`, and `agy agents` lists nothing.
// Measured with sentinel files, and agy says so itself: "no active workspace is
// currently loaded, workspace-level skills from .agents/skills/ are not
// present". Loading them needs the folder registered as a project, which is
// user-global state this template will not write.
//
// So there is nothing to suppress here, and nothing to generate for it. A worker
// on agy runs on the composed prompt and only the composed prompt, which is what
// every other engine is configured above to imitate.
export default {
  name: 'antigravity',
  efforts: ['low', 'medium', 'high'],
  readsProjectDocs: false,
  // The one place agy is weaker than the other two. Its workers are handed
  // `define_subagent` and `invoke_subagent` — measured by asking one — and agy
  // exposes no flag to remove them: there is no tool allowlist, and its
  // permission rules live only in user-global config this template will not
  // write. So the leaf-worker rule is prompt-level here and process-level
  // elsewhere, and dispatch says so out loud rather than implying parity.
  //
  // Bounded, not unbounded: a spawned subagent inherits this process's --sandbox
  // and its worktree, so it cannot commit, push, or reach outside the checkout.
  // The exposure is wasted tokens and unbounded work, capped by --print-timeout,
  // not a privilege escalation.
  enforcesLeafWorker: false,
  // --print always requires a value, and in text mode that value IS the prompt —
  // which would put a 35KB worker prompt on the command line, far past the
  // ~32K Windows limit. stream-json takes the prompt from stdin instead, with
  // no size limit, so --print is given an empty value.
  promptFormat: 'stream-json',
  buildArgs({ settings, readOnly, workspace, model, effort }) {
    const args = [
      '--add-dir', workspace,
      '--sandbox',
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
