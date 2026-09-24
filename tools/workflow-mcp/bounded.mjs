#!/usr/bin/env node
// Runs a command the conductor itself needs — a worktree's setup, the project's
// test suite before a cycle, an install — under a time limit, with its whole
// process tree stopped at the limit or when this runner is itself stopped
// (process-tree.mjs, watchdog.mjs), and only a bounded tail of its output
// printed.
//
// Typed straight into a conductor's shell, such a command runs for as long as it
// likes; a shell tool that gives up on it moves it to the background or stops the
// shell and leaves its children running — measured on Windows, a stopped shell's
// grep ran on for an hour and a half. Its full output also lands in the
// conductor's context, where an `npm install` is thousands of tokens of noise.
//
// Usage: node bounded.mjs [--cwd <dir>] [--timeout <seconds>] [--tail <bytes>] -- <command line>
//        node bounded.mjs --setup <dispatchDir>    the worktree setup prepare_worktree wrote there
// Exit:  the command's own code; 124 on timeout; 127 when it could not start;
//        2 when this runner could not run it at all. --setup stops at the first
//        command that fails and exits with its code.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runBounded } from './process-tree.mjs';

export const DEFAULT_TIMEOUT_SECONDS = 1800;
export const DEFAULT_TAIL_BYTES = 2000;

// One command line through the shell, bounded. Never throws.
export async function runLine(command, { cwd = process.cwd(), timeoutSeconds = DEFAULT_TIMEOUT_SECONDS,
  tailBytes = DEFAULT_TAIL_BYTES } = {}) {
  const started = Date.now();
  const run = await runBounded({ command, cwd, timeoutMs: timeoutSeconds * 1000, tailBytes, guard: true });
  const code = run.timed_out ? 124 : run.error ? 127 : run.status ?? 128;
  return { command, cwd, exit_code: code, timed_out: run.timed_out, error: run.error,
    seconds: Math.round((Date.now() - started) / 100) / 10, output_tail: run.output };
}

const describe = result => `${result.exit_code === 0 ? 'ok  ' : 'FAIL'} \`${result.command}\` — `
  + (result.timed_out ? `stopped at the ${result.limit}s limit, with everything it started`
    : result.error ? `could not start (${result.error})` : `exit ${result.exit_code}`)
  + `, ${result.seconds}s`;

// Every setup command prepare_worktree recorded for a worktree, in order, in it.
// Output is printed only for the command that failed: a successful install is
// noise the conductor would otherwise pay to read.
export async function runSetup(dir) {
  const setup = JSON.parse(readFileSync(resolve(dir, 'setup.json'), 'utf8'));
  const results = [];
  for (const command of setup.commands) {
    const result = { ...await runLine(command, { cwd: setup.workspace, timeoutSeconds: setup.timeout_seconds }),
      limit: setup.timeout_seconds };
    results.push(result);
    if (result.exit_code !== 0) break;
  }
  writeFileSync(resolve(dir, 'setup-result.json'), JSON.stringify({ checked_at: new Date().toISOString(),
    ok: results.length === setup.commands.length && results.every(result => result.exit_code === 0),
    results: results.map(({ output_tail, ...rest }) => rest) }, null, 2) + '\n');
  return results;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.dirname, 'bounded.mjs')) {
  const args = process.argv.slice(2);
  const at = flag => { const i = args.indexOf(flag); return i === -1 ? null : args[i + 1]; };
  try {
    if (args[0] === '--setup') {
      if (!args[1] || !existsSync(resolve(args[1], 'setup.json'))) throw new Error('Usage: node bounded.mjs --setup <dispatchDir>');
      const results = await runSetup(resolve(args[1]));
      for (const result of results) console.log(describe(result));
      const failed = results.find(result => result.exit_code !== 0);
      if (failed?.output_tail?.trim()) console.log(failed.output_tail.trimEnd());
      if (!failed) console.log(`Setup done: ${results.length} command(s).`);
      process.exitCode = failed?.exit_code ?? 0;
    } else {
      const split = args.indexOf('--');
      if (split === -1 || !args[split + 1]) {
        throw new Error('Usage: node bounded.mjs [--cwd <dir>] [--timeout <seconds>] [--tail <bytes>] -- <command line>');
      }
      const timeoutSeconds = Number(at('--timeout') ?? DEFAULT_TIMEOUT_SECONDS);
      const tailBytes = Number(at('--tail') ?? DEFAULT_TAIL_BYTES);
      if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 1 || !Number.isInteger(tailBytes) || tailBytes < 0) {
        throw new Error('--timeout and --tail take whole numbers');
      }
      const result = { ...await runLine(args.slice(split + 1).join(' '),
        { cwd: resolve(at('--cwd') ?? process.cwd()), timeoutSeconds, tailBytes }), limit: timeoutSeconds };
      if (result.output_tail.trim()) console.log(result.output_tail.trimEnd());
      console.log(describe(result));
      process.exitCode = result.exit_code;
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
