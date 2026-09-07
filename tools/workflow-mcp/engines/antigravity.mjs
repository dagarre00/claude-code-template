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
  // The second thing agy cannot enforce below the prompt. `--mode plan` does
  // bind on its own — a worker told to create a file refuses and creates
  // nothing — but agy prints "warning: --mode plan has no effect while slash
  // command expansion is disabled", and it means it: with the flag below set,
  // the mode is inert and a read-only worker can call write_to_file. Dropping
  // --disable-slash-commands to recover the mode would load agy's own commands
  // and skills on top of the composed prompt, trading the context guarantee for
  // the access one. The prompt keeps read-only roles honest here; dispatch says
  // so out loud rather than implying parity.
  enforcesReadOnly: false,
  // --print always requires a value, and in text mode that value IS the prompt —
  // which would put a 35KB worker prompt on the command line, far past the
  // ~32K Windows limit. stream-json takes the prompt from stdin instead, with
  // no size limit, so --print is given an empty value.
  promptFormat: 'stream-json',
  buildArgs({ settings, readOnly, workspace, model, effort }) {
    const args = [
      '--add-dir', workspace,
      // No --sandbox, and this is the flag that decides whether agy workers run
      // at all. With it, every shell call needs the `escalate_admin` permission
      // rather than `command`, and headless mode cannot prompt for either — the
      // worker exits 0, reports SUCCESS, and returns an empty response with
      // `denied_actions: [{action: "escalate_admin"}]`. Measured on both a
      // read-only and a write role. `escalate_admin` also cannot be granted per
      // command (its target is the tool, not the command line), so keeping the
      // sandbox would mean granting Bash escalation wholesale — broader than the
      // exact-match `command(<line>)` rules that replace it. Isolation rests on
      // --add-dir, the worktree, and that allowlist. See docs/engine-setup.md.
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
