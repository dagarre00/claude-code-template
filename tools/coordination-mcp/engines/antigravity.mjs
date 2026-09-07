// Antigravity CLI adapter. Like Codex this sandboxes at the OS level, and it
// carries its own print timeout rather than relying on the runner's kill path.
export default {
  name: 'antigravity',
  efforts: ['low', 'medium', 'high'],
  terminal: '--print=',
  // agy's --print always requires a value, and in text mode that value IS the
  // prompt — which would put a 10KB+ worker prompt on the command line, past the
  // ~32K Windows limit for anything realistic. stream-json takes the prompt from
  // stdin instead, with no size limit, so --print is given an empty value.
  promptFormat: 'stream-json',
  // agy cannot commit either, for a different reason than Codex: every shell
  // command needs a `command(...)` allow-rule, headless mode auto-denies anything
  // unlisted because it cannot prompt, and those rules live only in a user-global
  // file (docs/harnesses.md §12). The runner commits for every engine, so a write
  // worker here never needs the terminal at all.
  // agy does not load AGENTS.md in print mode, so its workers were running with
  // no behavioural rules at all until the manager started supplying them. Its own
  // docs describe walking up from the working directory and loading GEMINI.md /
  // AGENTS.md, but measured here it does not: an identical prompt costs 15739
  // input tokens in an empty directory and 15743 in this repository beside a 21KB
  // AGENTS.md, and asked to name a rule from it the worker answers NONE with no
  // tool call. Tested in a trusted workspace at the repository root, so this is
  // not the trust gate; the TUI was not tested, and workers only run print mode.
  readsProjectDocs: false,
  // No --agent flag. Selecting a named agent made agy refuse every write, even
  // for a write role with an explicit write-tool allowlist, and `agy agents`
  // lists nothing from .agents/agents, so the definition does not appear to be
  // picked up as intended. The role is not lost: the manager already prepends the
  // worker contract and the full canonical role body to every prompt, for every
  // engine. --mode alone carries the access distinction, verified directly:
  // plan refuses the write, accept-edits performs it.
  buildArgs({ settings, readOnly, workspace, model, effort }) {
    const args = ['--add-dir', workspace, '--sandbox',
      '--mode', readOnly ? 'plan' : 'accept-edits',
      '--print-timeout', `${settings.workerTimeoutSeconds}s`,
      '--input-format', 'stream-json', '--output-format', 'stream-json'];
    if (model && model !== 'inherit') args.push('--model', model);
    if (effort) args.push('--effort', effort);
    // Must stay last. --print consumes the next argument as its value, so a flag
    // after it is swallowed and the real prompt is discarded: agy exits 2 with
    // `--print took "--effort" as its prompt`. The attached empty value satisfies
    // the parser while the prompt arrives over stdin as stream-json.
    args.push('--print=');
    return args;
  }
};
