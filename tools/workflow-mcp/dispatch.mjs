// Ties the pieces together into one dispatch: compose the prompt, resolve the
// engine, write the two files, and hand back a command the conductor can run.
//
// This tool does not spawn anything. That is the whole scope decision: the MCP
// is a prompt factory, and the conductor — which already has a shell — runs the
// process itself. It keeps the control plane small enough to reason about, and
// means a failed worker is debugged by re-running a command line a human can
// read, not by reading a supervisor's logs.
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { loadCanonical } from './canonical.mjs';
import { loadConfig, resolveEngine } from './config.mjs';
import { composePrompt } from './compose.mjs';
import { ENGINES, buildCommand, stdinPayload } from './engines/index.mjs';

// Quote one argument for the shell the conductor will paste this into. Only ever
// used to build the human-readable/runnable `command` string; the `args` array
// is the authoritative form and never passes through a shell.
const quote = value => /^[A-Za-z0-9_@%+=:,./-]+$/.test(value) ? value : `'${value.replaceAll("'", `'\\''`)}'`;

export function prepareDispatch(root, input = {}) {
  const { conductorEngine, cli_engine, workspace, task_id = randomUUID() } = input;
  const canonical = loadCanonical(root);
  const config = loadConfig(root);

  const composed = composePrompt(canonical, {
    ...input, task_id, workspace, workerCommands: config.workerCommands });
  const engine = cli_engine ?? resolveEngine(config, composed.role, conductorEngine);

  // All three files live beside each other so a human can read exactly what was
  // sent and re-run it byte for byte. The prompt is the readable form; the stdin
  // file is the wire form, which differs only for antigravity's NDJSON envelope;
  // report_file is where an engine that supports it (currently codex only, via
  // `-o`) writes just the worker's final message — computed before buildCommand
  // so the adapter can wire it into argv.
  const dir = resolve(root, '.worktrees', '.dispatch', task_id);
  mkdirSync(dir, { recursive: true });
  const prompt_file = resolve(dir, 'prompt.txt');
  const stdin_file = resolve(dir, 'stdin.txt');
  const report_file = resolve(dir, 'report.txt');
  writeFileSync(prompt_file, composed.prompt);
  writeFileSync(stdin_file, stdinPayload(engine, composed.prompt));

  const roleConfig = config.roles?.[composed.role] ?? {};
  const command = buildCommand(config, {
    engine,
    profile: composed.profile,
    access: composed.access,
    workspace,
    reportFile: report_file,
    model: input.model_override ?? roleConfig.models?.[engine] ?? undefined,
    effort: input.thinking_budget ?? roleConfig.effort?.[engine] ?? undefined
  });

  // Stated per dispatch, not buried in a doc: the conductor is the one choosing
  // an engine for a task, and it can only weigh that choice if it is told what
  // the engine cannot enforce below the prompt.
  const adapter = ENGINES[engine];
  const warnings = [];
  if (!adapter.enforcesLeafWorker) {
    warnings.push(`${engine} exposes subagent tools to workers and offers no flag to remove them, so the `
      + 'no-recursive-dispatch rule is prompt-level here rather than process-level. The subagent '
      + 'inherits this worker\'s sandbox and worktree, so the exposure is unbounded work, not '
      + 'privilege escalation. Prefer another engine for open-ended tasks, and read the report.');
  }
  if (composed.access === 'read-only' && !adapter.enforcesReadOnly) {
    warnings.push(`${engine} cannot enforce read-only below the prompt, so for this role the no-edits `
      + 'rule is a promise rather than a property. Run `git status --porcelain` in the worktree '
      + 'afterwards: anything it touched voids the round (behavioral rule 12).');
  }
  // Only worth a warning where nothing already solves it: claude's stdout is
  // already just the final message (reportIsStdout), and codex gets a separate
  // report_file below (writesReportFile). Antigravity has neither.
  if (!adapter.writesReportFile && !adapter.reportIsStdout) {
    warnings.push(`${engine} has no way to separate the worker's report from its full tool-call `
      + 'transcript — everything lands in stdout together, and on a large task that can reach '
      + 'megabytes. Capture it to a file and read from the end rather than inline.');
  }

  return {
    task_id,
    ...composed,
    warnings,
    prompt: undefined,                       // on disk, not in the tool response
    prompt_bytes: composed.prompt.length,
    engine: command.engine,
    executable: command.executable,
    args: command.args,
    model: command.model,
    effort: command.effort,
    workspace,
    // Run the process here. Claude Code has no --cd flag and works in the
    // process's working directory, so a command that did not enter the worktree
    // would run the worker against the conductor's own checkout — exactly what
    // the worktree exists to prevent. Codex (--cd) and agy (--add-dir) are told
    // as well, but the working directory is what makes all three agree.
    cwd: workspace,
    prompt_file,
    stdin_file,
    // Non-null only for an engine that actually writes to it (adapter.writesReportFile);
    // read this instead of stdout for the routine "what did the worker report" path —
    // stdout still has everything, for the rare case of debugging a failed run.
    report_file: adapter.writesReportFile ? report_file : null,
    command: `cd ${quote(workspace)} && ${quote(command.executable)} `
      + `${command.args.map(quote).join(' ')} < ${quote(stdin_file)}`
  };
}
