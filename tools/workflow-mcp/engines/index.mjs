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
import { explainMisfit, modelFits } from '../model-fit.mjs';

const registered = [claude, codex, antigravity];

// What a flag is for, so the config editor can show every flag an adapter passes
// without offering to change it: `guarantee` flags enforce a rule (read-only, leaf
// worker, no ambient context) and must never be editable; `config` flags come from
// a setting; `plumbing` is what the harness needs to run and read a worker;
// `hygiene` is cache and session tidiness.
export const FLAG_KINDS = Object.freeze(['guarantee', 'config', 'plumbing', 'hygiene']);

for (const engine of registered) {
  if (!engine?.name || typeof engine.buildArgs !== 'function'
    // Every flag buildArgs passes needs a note (test/engine-flags.test.mjs holds the
    // two in step); here only the shape is checked, so a malformed one fails at load.
    || !engine.flagNotes || typeof engine.flagNotes !== 'object'
    || Object.values(engine.flagNotes).some(note => !FLAG_KINDS.includes(note?.kind) || typeof note?.why !== 'string')
    || !Array.isArray(engine.efforts) || !engine.efforts.length
    // Offered by the config editor's model dropdown. Their shape (MODEL, below) is
    // held by test/config-ui.test.mjs, since that constant is not yet defined here.
    || !Array.isArray(engine.knownModels) || engine.knownModels.some(id => typeof id !== 'string')
    // The models this engine runs (model-fit.mjs). Required, so a fourth CLI cannot be
    // added without saying which models are its own — and everything the adapter itself
    // offers has to be inside it, or the editor would suggest what the loader refuses.
    || !Array.isArray(engine.modelPrefixes) || !engine.modelPrefixes.length
    || engine.modelPrefixes.some(prefix => typeof prefix !== 'string' || !prefix)
    || (engine.modelExcludes !== undefined && (!Array.isArray(engine.modelExcludes)
      || engine.modelExcludes.some(prefix => typeof prefix !== 'string' || !prefix)))
    || [...engine.knownModels, ...Object.keys(engine.modelAliases ?? {})].some(id => !modelFits(engine, id))
    // Optional: how to ask the tool for its models, and aliases it accepts for the newest
    // of a family. Both only feed the editor's dropdowns and are never trusted as a launch.
    || (engine.listModels !== undefined && (!Array.isArray(engine.listModels.args)
      || engine.listModels.args.some(arg => typeof arg !== 'string') || typeof engine.listModels.parse !== 'function'))
    || (engine.modelAliases !== undefined && (!engine.modelAliases || typeof engine.modelAliases !== 'object'
      || Object.values(engine.modelAliases).some(note => typeof note !== 'string')))
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
    || typeof engine.writesReportFile !== 'boolean'
    // Optional: names a script under this directory that turns a captured raw
    // transcript into a report, for an engine that needs post-processing
    // rather than a native flag (antigravity). Absent for an engine whose
    // buildArgs writes reportFile itself (codex) or that needs neither (claude).
    || (engine.extractReportFrom !== undefined && typeof engine.extractReportFrom !== 'string')
    // Optional: a per-dispatch agent definition the engine launches as
    // (antigravity), which dispatch.mjs writes before the command is built.
    || (engine.agentDefinition !== undefined && typeof engine.agentDefinition !== 'function')
    // Optional, and only ever a measured answer: false where an engine's workers
    // were shown to have no working web access. Unmeasured stays undefined.
    || (engine.providesWeb !== undefined && typeof engine.providesWeb !== 'boolean')
    // Optional: how a worker on this engine must spell a configured command on a
    // given platform, where the engine's own shell cannot run it as written.
    || (engine.spellCommand !== undefined && typeof engine.spellCommand !== 'function')
    // Optional: true where the engine's only way to read or search a file is its
    // shell, so the prompt must not read as forbidding that.
    || (engine.filesThroughShell !== undefined && typeof engine.filesThroughShell !== 'boolean')) {
    throw new Error(`Malformed engine adapter: ${engine?.name ?? 'unnamed'}`);
  }
}

export const ENGINES = Object.freeze(Object.fromEntries(registered.map(e => [e.name, e])));
export const engineNames = Object.freeze(registered.map(e => e.name));

// Conservative: an alias like "opus", a full id like "claude-opus-5", or a
// vendor path. Anything else is a typo or an injection attempt, and either way
// must not reach a command line.
export const MODEL = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,159}$/;

export function buildCommand(settings, task) {
  const { engine: name, profile, access, workspace, reportFile, agent } = task;
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
  // Whatever the model came from — an override, a role's pin, an engine default in a
  // config nothing validated — it is only ever handed to the engine that can run it.
  if (model != null && !modelFits(engine, model)) {
    throw new Error(`Refusing to launch ${name} with a model it does not run: ${explainMisfit(ENGINES, name, model)}`);
  }

  // Passed to every adapter; only codex's buildArgs does anything with it
  // (wires it in as -o). Antigravity gets its report_file a different way —
  // dispatch.mjs wraps its command and runs extractReportFrom afterward,
  // because there is no argv flag agy accepts for this. Harmless for claude
  // to receive and ignore.
  const args = engine.buildArgs({ settings, config, profile, access, workspace, model, effort,
    reportFile, agent, readOnly: access === 'read-only' });

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
