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
import { buildCommand, stdinPayload } from './engines/index.mjs';

// Quote one argument for the shell the conductor will paste this into. Only ever
// used to build the human-readable/runnable `command` string; the `args` array
// is the authoritative form and never passes through a shell.
const quote = value => /^[A-Za-z0-9_@%+=:,./-]+$/.test(value) ? value : `'${value.replaceAll("'", `'\\''`)}'`;

export function prepareDispatch(root, input = {}) {
  const { conductorEngine, cli_engine, workspace, task_id = randomUUID() } = input;
  const canonical = loadCanonical(root);
  const config = loadConfig(root);

  const composed = composePrompt(canonical, { ...input, task_id, workspace });
  const engine = cli_engine ?? resolveEngine(config, composed.role, conductorEngine);

  const roleConfig = config.roles?.[composed.role] ?? {};
  const command = buildCommand(config, {
    engine,
    profile: composed.profile,
    access: composed.access,
    workspace,
    model: input.model_override ?? roleConfig.models?.[engine] ?? undefined,
    effort: input.thinking_budget ?? roleConfig.effort?.[engine] ?? undefined
  });

  // Both files live beside each other so a human can read exactly what was sent
  // and re-run it byte for byte. The prompt is the readable form; the stdin file
  // is the wire form, which differs only for antigravity's NDJSON envelope.
  const dir = resolve(root, '.worktrees', '.dispatch', task_id);
  mkdirSync(dir, { recursive: true });
  const prompt_file = resolve(dir, 'prompt.txt');
  const stdin_file = resolve(dir, 'stdin.txt');
  writeFileSync(prompt_file, composed.prompt);
  writeFileSync(stdin_file, stdinPayload(engine, composed.prompt));

  return {
    task_id,
    ...composed,
    prompt: undefined,                       // on disk, not in the tool response
    prompt_bytes: composed.prompt.length,
    engine: command.engine,
    executable: command.executable,
    args: command.args,
    model: command.model,
    effort: command.effort,
    workspace,
    prompt_file,
    stdin_file,
    command: `${quote(command.executable)} ${command.args.map(quote).join(' ')} < ${quote(stdin_file)}`
  };
}
