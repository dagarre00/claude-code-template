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
