// Engine registry. Everything CLI-specific lives in one module per engine; the
// rest of the tool derives its engine list from here and contains no engine
// names of its own.
//
// This is an explicit registry rather than a directory scan on purpose: importing
// whatever .mjs happened to sit in this folder would turn a dropped file into
// executable code that builds command lines.
//
// To add a fourth CLI: write ./<name>.mjs exporting
// { name, efforts, promptFormat, readsProjectDocs, buildArgs }, add it to the
// list below, and add an `engines.<name>` block to .agents/config.json. The
// conformance tests then hold it to the same contract as the other three —
// clean argv, no permission bypass, a read-only mode, and suppressed project
// context. Nothing else in the repository needs to change, and in particular
// nothing needs to be generated for it.
import claude from './claude.mjs';
import codex from './codex.mjs';
import antigravity from './antigravity.mjs';

const registered = [claude, codex, antigravity];

for (const engine of registered) {
  if (!engine?.name || typeof engine.buildArgs !== 'function'
    || !Array.isArray(engine.efforts) || !engine.efforts.length
    || !['text', 'stream-json'].includes(engine.promptFormat)
    // Every adapter must answer whether it can enforce the leaf-worker rule and
    // the read-only rule below the prompt. Leaving either undefined would let a
    // new CLI inherit an assumption of parity it may not have earned.
    || typeof engine.enforcesLeafWorker !== 'boolean'
    || typeof engine.enforcesReadOnly !== 'boolean'
    // Same reasoning for whether the conductor can read a worker's report
    // without wading through its full tool-call transcript: reportIsStdout
    // (stdout is already just the report, nothing else needed) and
    // writesReportFile (a flag isolates the report into its own file) are
    // mutually exclusive solutions to the same problem — an adapter with
    // neither has that problem and must say so rather than the caller finding
    // out from a multi-megabyte stdout capture.
    || typeof engine.reportIsStdout !== 'boolean'
    || typeof engine.writesReportFile !== 'boolean') {
    throw new Error(`Malformed engine adapter: ${engine?.name ?? 'unnamed'}`);
  }
}

export const ENGINES = Object.freeze(Object.fromEntries(registered.map(e => [e.name, e])));
export const engineNames = Object.freeze(registered.map(e => e.name));

// Conservative: an alias like "opus", a full id like "claude-opus-5", or a
// vendor path. Anything else is a typo or an injection attempt, and either way
// must not reach a command line.
const MODEL = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,159}$/;

export function buildCommand(settings, task) {
  const { engine: name, profile, access, workspace, reportFile } = task;
  const engine = ENGINES[name];
  const config = settings.engines?.[name];
  if (!engine || !config) throw new Error(`Unknown engine: ${name}`);

  const model = task.model ?? config.models[profile];
  const effort = task.effort ?? config.effort[profile];
  if (effort != null && !engine.efforts.includes(effort)) {
    throw new Error(`Engine ${name} does not support effort "${effort}"; supported: ${engine.efforts.join(', ')}`);
  }
  if (model != null && (typeof model !== 'string' || !MODEL.test(model))) {
    throw new Error(`Invalid model for ${name}: ${JSON.stringify(model)}`);
  }

  // Passed to every adapter; only one (codex, via writesReportFile) does
  // anything with it. Harmless for the others to receive and ignore.
  const args = engine.buildArgs({ settings, config, profile, access, workspace, model, effort,
    reportFile, readOnly: access === 'read-only' });

  // The adapter is the only engine-specific code in the tool, so the contract it
  // must honour is checked here rather than trusted.
  if (!Array.isArray(args) || args.some(arg => typeof arg !== 'string' || /[\0\r\n]/.test(arg))) {
    throw new Error(`Engine ${name} produced an invalid argv`);
  }
  if (args.some(arg => /dangerous|bypassPermissions|--yolo|full-access/i.test(arg))) {
    throw new Error(`Engine ${name} attempted a permission bypass`);
  }
  return { engine: name, executable: config.executable, args,
    model: model ?? 'inherit', effort: effort ?? 'inherit',
    promptFormat: engine.promptFormat };
}

// The exact bytes to pipe to the process. Engines that read a plain prompt get
// the text; agy needs one NDJSON envelope per message. Returning this from one
// place means the conductor always runs `<argv> < stdin-file` and never has to
// know which engine it is driving.
export function stdinPayload(name, prompt) {
  const engine = ENGINES[name];
  if (!engine) throw new Error(`Unknown engine: ${name}`);
  return engine.promptFormat === 'stream-json'
    ? JSON.stringify({ event: 'user', message: { role: 'user', content: [{ type: 'text', text: prompt }] } }) + '\n'
    : prompt;
}
